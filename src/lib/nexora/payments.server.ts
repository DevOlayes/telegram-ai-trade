// Withdrawal service-charge payments: on-chain USDT (TRC-20) verification.
// The service charge is a STATIC amount (settings.service_fee, default $4.00).
import { applyBalance, db, getSettings, usd } from "./core.server";
import { sendMessage } from "./telegram.server";
import { recentTransfers, transferAmount, usdtContract } from "./tron.server";

export type WithdrawalRow = {
  id: string;
  user_id: string;
  amount: number;
  wallet_address: string;
  status: string;
  service_fee_amount: number;
  service_fee_status: string;
  service_fee_tx: string | null;
  fee_requested_at: string | null;
};

const SELECT =
  "id,user_id,amount,wallet_address,status,service_fee_amount,service_fee_status,service_fee_tx,fee_requested_at";

/** The service charge is fixed for every withdrawal. */
export function feeAmountFor(_id: string, baseFee: number) {
  return Number(Number(baseFee || 4).toFixed(2));
}

/**
 * Find a confirmed USDT TRC-20 transfer of the exact fee amount (within a small
 * decimal tolerance) sent to the configured fee wallet, that no other
 * withdrawal has already consumed.
 */
export async function findFeePayment(
  wd: WithdrawalRow,
  wallet: string,
  toleranceCents = 5,
) {
  if (!wallet) return null;
  const since = wd.fee_requested_at
    ? new Date(wd.fee_requested_at).getTime() - 10 * 60000
    : Date.now() - 6 * 3600000;
  const transfers = await recentTransfers(wallet, since);
  const expected = Math.round(Number(wd.service_fee_amount || 4) * 100);
  const contract = usdtContract();

  const { data: used } = await db()
    .from("withdrawals")
    .select("service_fee_tx")
    .not("service_fee_tx", "is", null);
  const taken = new Set((used ?? []).map((r) => r.service_fee_tx as string));

  for (const t of transfers) {
    // Server-side verification of every relevant field.
    if (!t.transaction_id) continue;
    if (t.to?.toLowerCase() !== wallet.toLowerCase()) continue;
    if (t.token_info?.address && t.token_info.address !== contract) continue;
    if (t.block_timestamp && t.block_timestamp < since) continue;
    const value = Math.round(transferAmount(t) * 100);
    if (Math.abs(value - expected) > toleranceCents) continue;
    if (taken.has(t.transaction_id)) continue;
    return t.transaction_id;
  }
  return null;
}

/** Verify one pending fee. Idempotent: the tx hash can only be claimed once. */
export async function verifyFee(withdrawalId: string) {
  const s = await getSettings();
  const { data } = await db().from("withdrawals").select(SELECT).eq("id", withdrawalId).maybeSingle();
  const wd = data as WithdrawalRow | null;
  if (!wd) return { paid: false };
  if (wd.service_fee_status === "paid" || wd.service_fee_status === "waived") return { paid: true };
  if (wd.service_fee_status !== "pending") return { paid: false };

  const tolerance = Math.round(Number((s as unknown as { fee_tolerance?: number }).fee_tolerance ?? 0.05) * 100);
  const tx = await findFeePayment(wd, String(s.fee_wallet ?? ""), tolerance);
  if (!tx) return { paid: false };

  // Atomic claim: only succeeds while the row is still pending and unclaimed.
  const { data: claimed, error } = await db()
    .from("withdrawals")
    .update({
      service_fee_status: "paid",
      service_fee_tx: tx,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", wd.id)
    .eq("service_fee_status", "pending")
    .is("service_fee_tx", null)
    .select("id");
  if (error || !claimed?.length) return { paid: false };

  const { data: user } = await db()
    .from("users")
    .select("telegram_id")
    .eq("id", wd.user_id)
    .maybeSingle();
  if (user) {
    await sendMessage(
      user.telegram_id,
      `✅ SERVICE CHARGE CONFIRMED\n\nWithdrawal: ${usd(wd.amount)}\nCharge:     ${usd(
        wd.service_fee_amount,
      )} (paid)\n\nStatus: being processed — you will be notified when it is sent.`,
    );
  }
  return { paid: true };
}

/** Sweep: verify or expire withdrawals waiting for the service charge. */
export async function sweepFees() {
  const s = await getSettings();
  const windowMin = Number(s.fee_window_minutes ?? 120);
  const { data } = await db()
    .from("withdrawals")
    .select(SELECT)
    .eq("service_fee_status", "pending")
    .limit(50);

  let paid = 0;
  let expired = 0;
  for (const row of (data ?? []) as WithdrawalRow[]) {
    const res = await verifyFee(row.id);
    if (res.paid) {
      paid++;
      continue;
    }
    const started = row.fee_requested_at ? new Date(row.fee_requested_at).getTime() : Date.now();
    if (Date.now() - started > windowMin * 60000) {
      // Atomic expiry so the reserved profit is only released once.
      const { data: closed } = await db()
        .from("withdrawals")
        .update({
          status: "expired",
          service_fee_status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("service_fee_status", "pending")
        .select("id");
      if (!closed?.length) continue;

      await applyBalance(
        row.user_id,
        { balance: Number(row.amount), profit: Number(row.amount) },
        { kind: "withdrawal_expired", amount: Number(row.amount), ref_id: row.id },
      );
      const { data: user } = await db()
        .from("users")
        .select("telegram_id")
        .eq("id", row.user_id)
        .maybeSingle();
      if (user) {
        await sendMessage(
          user.telegram_id,
          `⌛ WITHDRAWAL CANCELLED\n\nThe ${usd(
            row.service_fee_amount,
          )} service charge was not received in time.\n\n${usd(
            row.amount,
          )} is back in your balance. You can start a new withdrawal any time.`,
        );
      }
      expired++;
    }
  }
  return { fees_paid: paid, fees_expired: expired };
}

/**
 * Users who abandoned a withdrawal (expired/cancelled) and never completed one.
 * Used by the admin panel for targeted re-engagement — no automatic messaging.
 */
export async function abandonedWithdrawals(days = 14) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await db()
    .from("withdrawals")
    .select("id,user_id,amount,status,service_fee_status,created_at")
    .in("status", ["expired", "cancelled"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  if (!userIds.length) return [];

  const { data: done } = await db()
    .from("withdrawals")
    .select("user_id")
    .in("user_id", userIds)
    .in("status", ["paid", "approved", "completed"]);
  const completed = new Set((done ?? []).map((r) => r.user_id as string));

  const { data: users } = await db()
    .from("users")
    .select("id,telegram_id,username,first_name")
    .in("id", userIds);
  const byId = new Map((users ?? []).map((x) => [x.id as string, x]));

  const seen = new Set<string>();
  return rows
    .filter((r) => !completed.has(r.user_id as string))
    .filter((r) => (seen.has(r.user_id as string) ? false : seen.add(r.user_id as string)))
    .map((r) => ({ ...r, user: byId.get(r.user_id as string) ?? null }));
}

/** Send the recovery message to one abandoned-withdrawal user. */
export async function sendRecoveryMessage(userId: string) {
  const s = await getSettings();
  const { data: user } = await db()
    .from("users")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return false;
  await sendMessage(
    user.telegram_id,
    `💸 YOUR WITHDRAWAL IS STILL AVAILABLE\n\nYour previous request expired before the ${usd(
      s.service_fee,
    )} service charge was received — your profit was returned to your balance.\n\nOpen 💰 WALLET → 💸 WITHDRAW to start again.`,
  );
  return true;
}
