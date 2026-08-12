// Withdrawal service-charge payments: on-chain USDT (TRC-20) verification.
import { applyBalance, db, getSettings, usd } from "./core.server";
import { sendMessage } from "./telegram.server";
import { recentTransfers, transferAmount } from "./tron.server";

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

/** Unique cents suffix so each pending fee payment can be matched on-chain. */
export function feeAmountFor(id: string, baseFee: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 89;
  return Number((Number(baseFee) + (h + 1) / 100).toFixed(2));
}


/**
 * Look for a confirmed USDT transfer matching this withdrawal's exact fee
 * amount. Returns the tx hash when found.
 */
export async function findFeePayment(wd: WithdrawalRow, wallet: string) {
  if (!wallet) return null;
  const since = wd.fee_requested_at
    ? new Date(wd.fee_requested_at).getTime() - 10 * 60000
    : Date.now() - 6 * 3600000;
  const transfers = await recentTransfers(wallet, since);
  const expected = Math.round(Number(wd.service_fee_amount) * 1e6);

  const { data: used } = await db()
    .from("withdrawals")
    .select("service_fee_tx")
    .not("service_fee_tx", "is", null);
  const taken = new Set((used ?? []).map((r) => r.service_fee_tx));

  for (const t of transfers) {
    const decimals = t.token_info?.decimals ?? 6;
    const value = Math.round(Number(t.value) / Math.pow(10, decimals - 6));
    if (value === expected && !taken.has(t.transaction_id)) return t.transaction_id;
  }
  return null;
}

/** Verify one pending fee; credits nothing, only unlocks the withdrawal. */
export async function verifyFee(withdrawalId: string) {
  const s = await getSettings();
  const { data } = await db()
    .from("withdrawals")
    .select("id,user_id,amount,wallet_address,status,service_fee_amount,service_fee_status,service_fee_tx,fee_requested_at")
    .eq("id", withdrawalId)
    .maybeSingle();
  const wd = data as WithdrawalRow | null;
  if (!wd || wd.service_fee_status === "paid") return { paid: !!wd };

  const tx = await findFeePayment(wd, String(s.fee_wallet ?? ""));
  if (!tx) return { paid: false };

  await db()
    .from("withdrawals")
    .update({
      service_fee_status: "paid",
      service_fee_tx: tx,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", wd.id);

  const { data: user } = await db()
    .from("users")
    .select("telegram_id")
    .eq("id", wd.user_id)
    .maybeSingle();
  if (user) {
    await sendMessage(
      user.telegram_id,
      `✅ SERVICE CHARGE CONFIRMED\n\nWe found your payment on the blockchain.\n\nWithdrawal:\n${usd(
        wd.amount,
      )}\n\nStatus:\nBeing processed — you will be notified when it is sent.`,
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
    .select("id,user_id,amount,wallet_address,status,service_fee_amount,service_fee_status,service_fee_tx,fee_requested_at")
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
      await db()
        .from("withdrawals")
        .update({
          status: "expired",
          service_fee_status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      // Return the reserved profit to the user.
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
          `⌛ WITHDRAWAL CANCELLED\n\nThe service charge was not received in time.\n\n${usd(
            row.amount,
          )} has been returned to your balance. You can start a new withdrawal any time.`,
        );
      }
      expired++;
    }
  }
  return { fees_paid: paid, fees_expired: expired };
}
