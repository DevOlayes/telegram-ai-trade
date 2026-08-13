/**
 * Controlled market + settlement engine.
 *
 * Isolated behind this module's exported interface so it can later be swapped
 * for a live exchange/trading engine without touching the Telegram layer.
 */
import { db, fromCents, toCents, type Settings } from "./core.server";

export type Pair = { symbol: string; base_price: number; volatility: number };

export type TradePlan = {
  symbol: string;
  direction: "LONG" | "SHORT";
  confidence: number;
  duration_minutes: number;
  entry_price: number;
  take_profit: number;
  stop_loss: number;
};

export type TradeRow = {
  id: string;
  symbol: string;
  direction: string;
  amount: number;
  entry_price: number;
  take_profit: number;
  stop_loss: number;
  current_price: number;
  duration_minutes: number;
  potential_profit: number;
  potential_loss: number;
  target_outcome: string | null;
  opened_at: string;
  expires_at: string;
};

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const round = (v: number) => Number(v.toFixed(v >= 100 ? 2 : 4));

export async function listPairs(): Promise<Pair[]> {
  const { data } = await db()
    .from("trading_pairs")
    .select("symbol, base_price, volatility")
    .eq("active", true);
  return (data ?? []) as Pair[];
}

/** Live-ish spot price for a pair (synthetic, deterministic per minute). */
export function spotPrice(pair: Pair, at = Date.now()) {
  const minute = Math.floor(at / 60000);
  const wave =
    Math.sin(minute / 37) * 0.6 + Math.sin(minute / 11) * 0.3 + (seeded(pair.symbol + minute) - 0.5);
  return round(Number(pair.base_price) * (1 + wave * Number(pair.volatility)));
}

/** AI-style trade recommendation. */
export async function planTrade(settings: Settings): Promise<TradePlan> {
  const pairs = await listPairs();
  const pair = pairs[Math.floor(Math.random() * pairs.length)]!;
  const direction: "LONG" | "SHORT" = Math.random() < 0.55 ? "LONG" : "SHORT";
  const confidence = 72 + Math.floor(Math.random() * 22);
  const durations = settings.durations?.length ? settings.durations : [30, 60, 120, 240];
  const duration =
    confidence >= 90
      ? durations[durations.length - 1]!
      : durations[Math.floor(Math.random() * durations.length)]!;

  const entry = spotPrice(pair);
  const vol = Number(pair.volatility);
  const tpDist = entry * vol * (1.2 + Math.random() * 0.8);
  const slDist = tpDist * (0.5 + Math.random() * 0.2);

  return {
    symbol: pair.symbol,
    direction,
    confidence,
    duration_minutes: duration,
    entry_price: round(entry),
    take_profit: round(direction === "LONG" ? entry + tpDist : entry - tpDist),
    stop_loss: round(direction === "LONG" ? entry - slDist : entry + slDist),
  };
}

/**
 * Decide the programmed outcome for a new position (settlement rule).
 * New accounts get a guaranteed winning streak, and two losses never follow
 * each other, so the experience stays positive. Both guards are configurable.
 */
export function decideOutcome(
  confidence: number,
  settings: Settings,
  ctx?: { settled?: number; lastResult?: string | null },
): "win" | "loss" {
  const settled = ctx?.settled ?? 0;
  if (settled < Number(settings.starter_wins ?? 0)) return "win";
  if (settings.no_double_loss !== false && ctx?.lastResult === "loss") return "win";
  const base = Number(settings.win_rate ?? 0.85);
  const p = Math.max(0.05, Math.min(0.99, base + (confidence - 80) / 400));
  return Math.random() < p ? "win" : "loss";
}


/** Position sizing from a risk profile. */
export function sizeTrade(
  balance: number,
  riskFactor: number,
  confidence: number,
  settings: Settings,
) {
  const amountCents = Math.max(100, Math.round(toCents(balance) * riskFactor));
  const amount = fromCents(Math.min(amountCents, toCents(balance)));
  const leverage = riskFactor >= 0.4 ? 10 : riskFactor >= 0.2 ? 5 : 2;
  const profitRate = (0.35 + (confidence / 100) * 0.4) * (leverage / 5);
  const lossRate = 0.4;
  return {
    amount,
    leverage,
    potential_profit: fromCents(Math.round(toCents(amount) * profitRate)),
    potential_loss: fromCents(Math.round(toCents(amount) * lossRate)),
    settings,
  };
}

export type TickResult =
  | { status: "active"; price: number }
  | { status: "settled"; price: number; result: "win" | "loss"; pnl: number };

/**
 * Advance a position. Price walks from entry toward the programmed target
 * over the trade duration, with noise, and settles on TP/SL or expiry.
 */
export function tickTrade(trade: TradeRow, settings: Settings, now = Date.now()): TickResult {
  const opened = new Date(trade.opened_at).getTime();
  const expires = new Date(trade.expires_at).getTime();
  const progress = Math.min(1, Math.max(0, (now - opened) / Math.max(1, expires - opened)));

  const entry = Number(trade.entry_price);
  const tp = Number(trade.take_profit);
  const sl = Number(trade.stop_loss);
  const win = (trade.target_outcome ?? "win") === "win";
  const target = win ? tp : sl;

  const noise = (seeded(trade.id + Math.floor(now / 60000)) - 0.5) * Math.abs(tp - entry) * 0.6;
  const curve = Math.pow(progress, 0.85);
  const price = round(entry + (target - entry) * curve + noise * (1 - progress));

  const long = trade.direction === "LONG";
  const hitTp = long ? price >= tp : price <= tp;
  const hitSl = long ? price <= sl : price >= sl;
  const expired = now >= expires;

  if (hitTp || hitSl || expired) {
    let result: "win" | "loss";
    if (hitTp) result = "win";
    else if (hitSl) result = "loss";
    else if (settings.expiry_rule === "win") result = "win";
    else if (settings.expiry_rule === "loss") result = "loss";
    else result = win ? "win" : "loss"; // "market": settle at programmed outcome
    const pnl = result === "win" ? Number(trade.potential_profit) : -Number(trade.potential_loss);
    return { status: "settled", price: round(result === "win" ? tp : sl), result, pnl };
  }
  return { status: "active", price };
}
