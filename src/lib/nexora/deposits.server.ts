// Automatic USDT (TRC-20) deposits: intent creation + on-chain matching.
// One shared collection wallet; each pending deposit carries a unique cents
// tag so an incoming transfer can be attributed to exactly one user.
import { applyBalance, db, getBalance, getSettings, track, usd } from "./core.server";
import { editMessage, kb, sendMessage } from "./telegram.server";
import { recentTransfers, transferAmount } from "./tron.server";

export type DepositRow = {
  id: string;
  user_id: string;
  amount: number;
  unique_amount: number;
  wallet_address: string;
  tx_hash: string | null;
  status: string;
  message_id: number | null;
  created_at: string;
};

/**
 * Create a deposit intent with an amount that is unique among all open
 * intents, so an on-chain transfer maps to exactly one user.
 */
export async function createDeposit(userId: string, amount: number, wallet: string) {
  const base = Math.floor(Number(amount));
  const { data: open } = await db()
    .from("deposits")
    .select("unique_amount")
    .eq("status", "pending");
  const taken = new Set((open ?? []).map((d) => Number(d.unique_amount).toFixed(2)));

  let unique = 0;
  for (let cents = 1; cents <= 99; cents++) {
    const candidate = Number((base + cents / 100).toFixed(2));
    if (!taken.has(candidate.toFixed(2))) {
      unique = candidate;
      break;
    }
  }
  if (!unique) return null;

  const { data, error } = await db()
    .from("deposits")
    .insert({
      user_id: userId,
      amount: base,
      unique_amount: unique,
      wallet_address: wallet,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) {
    console.error("createDeposit", error);
    return null;
  }
  await track(userId, "deposit_requested", { amount: base, unique });
  return data as DepositRow;
}

export async function openDeposit(userId: string) {
  const { data } = await db()
    .from("deposits")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as DepositRow | undefined) ?? null;
}

export async function cancelDeposit(userId: string, id: string) {
  await db()
    .from("deposits")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending");
}

async function creditDeposit(dep: DepositRow, txHash: string, received: number) {
  // Idempotency: the unique tx_hash column makes a double credit impossible.
  const { data: updated, error } = await db()
    .from("deposits")
    .update({
      status: "credited",
      tx_hash: txHash,
      amount: received,
      credited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", dep.id)
    .eq("status", "pending")
    .select("id");
  if (error || !updated?.length) return false;

  await applyBalance(
    dep.user_id,
    { balance: received },
    { kind: "deposit", amount: received, ref_id: dep.id, note: txHash },
  );
  await track(dep.user_id, "deposit_credited", { amount: received, tx: txHash });

  const { data: user } = await db()
    .from("users")
    .select("telegram_id")
    .eq("id", dep.user_id)
    .maybeSingle();
  if (!user) return true;

  const b = await getBalance(dep.user_id);
  const text =
    `✅ DEPOSIT CONFIRMED\n\n` +
    `Amount:  +${usd(received)}\n` +
    `Balance: ${usd(b.balance)}\n\n` +
    `Tx: ${txHash.slice(0, 10)}…${txHash.slice(-6)}`;
  const markup = kb([
    [{ text: "🚀 TRADE", data: "trade" }],
    [{ text: "🏠 MENU", data: "home" }],
  ]);
  if (dep.message_id) {
    await editMessage(user.telegram_id, dep.message_id, text, markup);
  } else {
    await sendMessage(user.telegram_id, text, markup);
  }
  return true;
}

/** Background sweep: match confirmed transfers to open intents, then expire. */
export async function matchDeposits() {
  const s = await getSettings();
  const wallet = String(s.fee_wallet ?? "");
  if (!wallet) return { deposits_credited: 0, deposits_expired: 0 };

  const { data } = await db().from("deposits").select("*").eq("status", "pending").limit(100);
  const pending = (data ?? []) as DepositRow[];
  if (!pending.length) return { deposits_credited: 0, deposits_expired: 0 };

  const oldest = Math.min(...pending.map((d) => new Date(d.created_at).getTime()));
  const transfers = await recentTransfers(wallet, oldest - 10 * 60000);

  const { data: usedRows } = await db()
    .from("deposits")
    .select("tx_hash")
    .not("tx_hash", "is", null);
  const used = new Set((usedRows ?? []).map((r) => r.tx_hash as string));

  let credited = 0;
  for (const t of transfers) {
    if (used.has(t.transaction_id)) continue;
    const received = Number(transferAmount(t).toFixed(2));
    const match = pending.find(
      (d) =>
        d.status === "pending" &&
        Math.round(Number(d.unique_amount) * 100) === Math.round(received * 100),
    );
    if (!match) continue;
    const ok = await creditDeposit(match, t.transaction_id, received);
    if (ok) {
      match.status = "credited";
      used.add(t.transaction_id);
      credited++;
    }
  }

  const windowMin = Number(s.deposit_window_minutes ?? 180);
  let expired = 0;
  for (const d of pending) {
    if (d.status !== "pending") continue;
    if (Date.now() - new Date(d.created_at).getTime() <= windowMin * 60000) continue;
    await db()
      .from("deposits")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", d.id)
      .eq("status", "pending");
    expired++;
    const { data: user } = await db()
      .from("users")
      .select("telegram_id")
      .eq("id", d.user_id)
      .maybeSingle();
    if (user && d.message_id) {
      await editMessage(
        user.telegram_id,
        d.message_id,
        `⌛ DEPOSIT REQUEST EXPIRED\n\nNo payment of ${Number(d.unique_amount).toFixed(
          2,
        )} USDT was received.\n\nStart a new deposit any time.`,
        kb([[{ text: "💳 DEPOSIT", data: "deposit" }], [{ text: "🏠 MENU", data: "home" }]]),
      );
    }
  }

  return { deposits_credited: credited, deposits_expired: expired };
}
