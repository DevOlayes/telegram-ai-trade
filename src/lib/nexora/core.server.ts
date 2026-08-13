// LEXORA core: database access, settings, money math, user/account system.
// Server-only. Never imported from client code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _db: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _db;
}

/* ---------------- money (integer cents, no float drift) ---------------- */
export const toCents = (v: number | string | null | undefined) =>
  Math.round(Number(v ?? 0) * 100);
export const fromCents = (c: number) => Number((c / 100).toFixed(2));
export const usd = (v: number | string | null | undefined) =>
  `$${(Math.round(Number(v ?? 0) * 100) / 100).toFixed(2)}`;
export const signedUsd = (v: number) => `${v >= 0 ? "+" : "-"}${usd(Math.abs(v))}`;

/* ---------------- settings ---------------- */
export type Settings = {
  welcome_bonus: number;
  min_withdrawal: number;
  withdrawal_wait_hours: number;
  referral_reward: number;
  durations: number[];
  risk_profiles: Record<string, number>;
  win_rate: number;
  expiry_rule: string;
  show_confidence: boolean;
  qualify_trades: number;
  payout_day: number;
  service_fee: number;
  fee_window_minutes: number;
  fee_wallet: string;
  deposit_window_minutes: number;
  starter_wins: number;
  no_double_loss: boolean;

};

const DEFAULTS: Settings = {
  welcome_bonus: 25,
  min_withdrawal: 30,
  withdrawal_wait_hours: 72,
  referral_reward: 2,
  durations: [30, 45, 60, 120, 180, 240],
  risk_profiles: { conservative: 0.1, balanced: 0.25, aggressive: 0.45 },
  win_rate: 0.85,
  expiry_rule: "market",
  show_confidence: true,
  qualify_trades: 1,
  payout_day: 31,
  service_fee: 4,
  fee_window_minutes: 120,
  fee_wallet: "",
  deposit_window_minutes: 180,
  starter_wins: 3,
  no_double_loss: true,

};


export async function getSettings(): Promise<Settings> {
  const { data } = await db().from("system_settings").select("key,value");
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const row of data ?? []) out[row.key as string] = row.value;
  return out as unknown as Settings;
}

/* ---------------- users ---------------- */
export type LexoraUser = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  referral_code: string;
  referred_by: string | null;
  bonus_claimed: boolean;
  status: string;
  screen_message_id: number | null;
  ui_state: Record<string, unknown>;
  created_at: string;
};

export type Balance = {
  user_id: string;
  balance: number;
  bonus: number;
  profit: number;
  referral_balance: number;
};

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function getOrCreateUser(tg: {
  id: number;
  username?: string;
  first_name?: string;
}, refCode?: string): Promise<LexoraUser> {
  const existing = await db().from("users").select("*").eq("telegram_id", tg.id).maybeSingle();
  if (existing.data) {
    await db()
      .from("users")
      .update({ last_seen_at: new Date().toISOString(), username: tg.username ?? null })
      .eq("id", existing.data.id);
    return existing.data as LexoraUser;
  }

  let referrer: { id: string } | null = null;
  if (refCode) {
    const r = await db()
      .from("users")
      .select("id")
      .eq("referral_code", refCode.toUpperCase())
      .maybeSingle();
    referrer = (r.data as { id: string } | null) ?? null;
  }

  const { data, error } = await db()
    .from("users")
    .insert({
      telegram_id: tg.id,
      username: tg.username ?? null,
      first_name: tg.first_name ?? null,
      referral_code: makeCode(),
      referred_by: referrer?.id ?? null,
      referral_source: refCode ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await db().from("balances").insert({ user_id: data.id });
  if (referrer) {
    await db()
      .from("referrals")
      .insert({ referrer_id: referrer.id, referred_id: data.id, status: "pending" });
  }
  await track(data.id, "registration", { referral_source: refCode ?? null });
  return data as LexoraUser;
}

export async function getBalance(userId: string): Promise<Balance> {
  const { data } = await db().from("balances").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Balance;
  const created = await db().from("balances").insert({ user_id: userId }).select("*").single();
  return created.data as Balance;
}

/** Atomic-ish balance mutation with a transaction ledger row. */
export async function applyBalance(
  userId: string,
  delta: { balance?: number; bonus?: number; profit?: number; referral_balance?: number },
  ledger: { kind: string; amount: number; ref_id?: string; note?: string },
) {
  const b = await getBalance(userId);
  const next = {
    balance: fromCents(toCents(b.balance) + toCents(delta.balance ?? 0)),
    bonus: fromCents(toCents(b.bonus) + toCents(delta.bonus ?? 0)),
    profit: fromCents(toCents(b.profit) + toCents(delta.profit ?? 0)),
    referral_balance: fromCents(
      toCents(b.referral_balance) + toCents(delta.referral_balance ?? 0),
    ),
    updated_at: new Date().toISOString(),
  };
  await db().from("balances").update(next).eq("user_id", userId);
  await db().from("transactions").insert({
    user_id: userId,
    kind: ledger.kind,
    amount: ledger.amount,
    balance_after: next.balance,
    ref_id: ledger.ref_id ?? null,
    note: ledger.note ?? null,
  });
  return next;
}

export async function setUiState(userId: string, state: Record<string, unknown>) {
  await db().from("users").update({ ui_state: state }).eq("id", userId);
}

export async function track(userId: string | null, name: string, payload: unknown = {}) {
  await db().from("events").insert({ user_id: userId, name, payload: payload as object });
}
