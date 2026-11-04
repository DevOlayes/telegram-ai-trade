// Preview-runtime data adapter: the same query surface as d1.server.ts, but
// backed by the Lovable Cloud Postgres database (used only in the Lovable
// preview where the Cloudflare D1 binding does not exist).
// The atomic helpers here run as plain sequential reads/writes; the preview is
// used for the admin panel and broadcasts, not for live bot settlement.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const round2 = (v: number) => Math.round(v * 100) / 100;

export function pgDb() {
  const sb = supabaseAdmin;

  async function readBalanceRow(userId: string) {
    const { data, error } = await sb
      .from("balances")
      .select("balance,bonus,profit,referral_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as { balance: number; bonus: number; profit: number; referral_balance: number };
    const created = await sb
      .from("balances")
      .insert({ user_id: userId })
      .select("balance,bonus,profit,referral_balance")
      .single();
    if (created.error) throw created.error;
    return created.data as { balance: number; bonus: number; profit: number; referral_balance: number };
  }

  return {
    from: (table: string) => sb.from(table),

    async refundWithdrawalAtomic(input: {
      withdrawalId: string;
      expectedStatus: string;
      expectedFeeStatus?: string;
      status: string;
      feeStatus?: string;
      feeStatusIfPending?: string;
      kind: string;
    }) {
      const now = new Date().toISOString();
      const { data: w, error } = await sb
        .from("withdrawals")
        .select("id,user_id,amount,status,service_fee_status")
        .eq("id", input.withdrawalId)
        .maybeSingle();
      if (error) throw error;
      if (!w || w.status !== input.expectedStatus) throw new Error("Withdrawal state changed; refund skipped");
      if (input.expectedFeeStatus && w.service_fee_status !== input.expectedFeeStatus) {
        throw new Error("Withdrawal fee state changed; refund skipped");
      }
      const feeStatus =
        input.feeStatus
          ? input.feeStatus
          : input.feeStatusIfPending
            ? (w.service_fee_status === "pending" ? input.feeStatusIfPending : w.service_fee_status)
            : w.service_fee_status;
      const updated = await sb
        .from("withdrawals")
        .update({ status: input.status, service_fee_status: feeStatus, updated_at: now })
        .eq("id", w.id);
      if (updated.error) throw updated.error;
      const bal = await readBalanceRow(w.user_id);
      const next = {
        balance: round2(Number(bal.balance ?? 0) + Number(w.amount)),
        profit: round2(Number(bal.profit ?? 0) + Number(w.amount)),
      };
      const bump = await sb.from("balances").update({ ...next, updated_at: now }).eq("user_id", w.user_id);
      if (bump.error) throw bump.error;
      const tx = await sb.from("transactions").insert({
        user_id: w.user_id,
        kind: input.kind,
        amount: w.amount,
        balance_after: next.balance,
        ref_id: w.id,
      });
      if (tx.error) throw tx.error;
      return { id: w.id, user_id: w.user_id, amount: w.amount, status: input.status, service_fee_status: feeStatus, updated_at: now };
    },

    async creditDepositAtomic(input: { depositId: string; txHash: string; amount: number }) {
      const now = new Date().toISOString();
      const { data: d, error } = await sb
        .from("deposits")
        .select("id,user_id,amount,status")
        .eq("id", input.depositId)
        .maybeSingle();
      if (error) throw error;
      if (!d || d.status !== "pending") return null;
      const updated = await sb
        .from("deposits")
        .update({ status: "credited", tx_hash: input.txHash, amount: input.amount, credited_at: now, updated_at: now })
        .eq("id", d.id);
      if (updated.error) throw updated.error;
      const bal = await readBalanceRow(d.user_id);
      const next = { balance: round2(Number(bal.balance ?? 0) + Number(input.amount)) };
      const bump = await sb.from("balances").update({ ...next, updated_at: now }).eq("user_id", d.user_id);
      if (bump.error) throw bump.error;
      const tx = await sb.from("transactions").insert({
        user_id: d.user_id,
        kind: "deposit",
        amount: input.amount,
        balance_after: next.balance,
        ref_id: d.id,
        note: input.txHash,
      });
      if (tx.error) throw tx.error;
      return { id: d.id, user_id: d.user_id, amount: input.amount, tx_hash: input.txHash, credited_at: now };
    },

    async settleTradeAtomic(input: {
      tradeId: string;
      result: string;
      pnl: number;
      currentPrice: number;
      promoCap: number | null;
      kind: string;
    }) {
      const settledAt = new Date().toISOString();
      const { data: t, error } = await sb
        .from("trades")
        .select("id,user_id,amount,status")
        .eq("id", input.tradeId)
        .maybeSingle();
      if (error) throw error;
      if (!t || t.status !== "active") throw new Error("Trade already settled or missing");
      const bal = await readBalanceRow(t.user_id);
      const pnl =
        input.promoCap === null
          ? input.pnl
          : Math.min(input.pnl, Math.max(0, input.promoCap - Number(bal.profit ?? 0)));
      const settled = await sb
        .from("trades")
        .update({ status: "settled", result: input.result, pnl, current_price: input.currentPrice, settled_at: settledAt })
        .eq("id", t.id);
      if (settled.error) throw settled.error;
      const next = {
        balance: round2(Number(bal.balance ?? 0) + Number(t.amount) + pnl),
        profit: round2(Number(bal.profit ?? 0) + pnl),
      };
      const bump = await sb.from("balances").update({ ...next, updated_at: settledAt }).eq("user_id", t.user_id);
      if (bump.error) throw bump.error;
      const tx = await sb.from("transactions").insert({
        user_id: t.user_id,
        kind: input.kind,
        amount: pnl,
        balance_after: next.balance,
        ref_id: t.id,
      });
      if (tx.error) throw tx.error;
      return { id: t.id, user_id: t.user_id, amount: pnl, pnl, settled_at: settledAt };
    },

    async applyBalanceAtomic(
      userId: string,
      delta: { balance?: number; bonus?: number; profit?: number; referral_balance?: number },
      ledger: { kind: string; amount: number; ref_id?: string | null; note?: string | null },
    ) {
      const now = new Date().toISOString();
      const bal = await readBalanceRow(userId);
      const next = {
        balance: round2(Number(bal.balance ?? 0) + Number(delta.balance ?? 0)),
        bonus: round2(Number(bal.bonus ?? 0) + Number(delta.bonus ?? 0)),
        profit: round2(Number(bal.profit ?? 0) + Number(delta.profit ?? 0)),
        referral_balance: round2(Number(bal.referral_balance ?? 0) + Number(delta.referral_balance ?? 0)),
      };
      const bump = await sb.from("balances").update({ ...next, updated_at: now }).eq("user_id", userId);
      if (bump.error) throw bump.error;
      const tx = await sb.from("transactions").insert({
        user_id: userId,
        kind: ledger.kind,
        amount: ledger.amount,
        balance_after: next.balance,
        ref_id: ledger.ref_id ?? null,
        note: ledger.note ?? null,
      });
      if (tx.error) throw tx.error;
      return { ...next, updated_at: now };
    },

    rpc: (name: string, args: Record<string, unknown> = {}) => sb.rpc(name, args),
  };
}
