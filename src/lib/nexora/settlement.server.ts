// Settlement runner: advances open positions and settles them.
import { db, getBalance, getSettings, track, usd } from "./core.server";
import { tickTrade, type TradeRow } from "./engine.server";
import { activeTradeText } from "./bot.server";
import { qualifyReferral } from "./referrals.server";
import { editMessage, editPhoto, kb, sendPhoto } from "./telegram.server";
import { IMG } from "./images.server";
import { env } from "cloudflare:workers";

const UPDATE_INTERVAL_MS = 2 * 60 * 1000;

export async function runTick() {
  const settings = await getSettings();
  const { error: expiryError } = await db().rpc("expire_promotional_credit", { p_user_id: null });
  if (expiryError) throw expiryError;
  const media = (env as unknown as {
    MEDIA?: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string): Promise<void>;
    };
  }).MEDIA;
  const cursorKey = "scheduler:trade-cursor";
  const cursor = await media?.get(cursorKey).catch(() => null);
  const tradeQuery = db()
    .from("trades")
    .select("*")
    .eq("status", "active")
    .order("id", { ascending: true })
    .limit(200);
  const { data: firstBatch } = cursor ? await tradeQuery.gt("id", cursor) : await tradeQuery;
  let trades = firstBatch ?? [];
  if (cursor && trades.length === 0) {
    const { data: wrapped } = await db()
      .from("trades")
      .select("*")
      .eq("status", "active")
      .order("id", { ascending: true })
      .limit(200);
    trades = wrapped ?? [];
  }

  let settled = 0;
  for (const raw of trades ?? []) {
    const trade = raw as TradeRow & {
      user_id: string;
      message_id: number | null;
      last_update_at: string;
    };
    const res = tickTrade(trade, settings);

    const { data: user } = await db()
      .from("users")
      .select("telegram_id")
      .eq("id", trade.user_id)
      .maybeSingle();

    if (res.status === "active") {
      const stale = Date.now() - new Date(trade.last_update_at).getTime() >= UPDATE_INTERVAL_MS;
      await db().from("trades").update({ current_price: res.price }).eq("id", trade.id);
      if (stale && user && trade.message_id) {
        await db()
          .from("trades")
          .update({ last_update_at: new Date().toISOString() })
          .eq("id", trade.id);
        await editMessage(
          user.telegram_id,
          trade.message_id,
          activeTradeText({ ...trade, current_price: res.price }),
        );
      }
      continue;
    }

    const win = res.result === "win";
    let promoCap: number | null = null;
    if (win) {
      const { count: deposited } = await db()
        .from("deposits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", trade.user_id)
        .eq("status", "credited");
      if (!deposited) {
        promoCap = Number(
          (settings as unknown as { promo_max_earnings?: number }).promo_max_earnings ?? 5000,
        );
        // Ensure the balance exists and expire promotional credit before the atomic settlement.
        await getBalance(trade.user_id);
      }
    }

    // Claim the trade, apply the balance change, and write its ledger entry in one D1 transaction.
    const settledTrade = await db().settleTradeAtomic({
      tradeId: trade.id,
      result: res.result,
      pnl: res.pnl,
      currentPrice: res.price,
      promoCap,
      kind: win ? "trade_win" : "trade_loss",
    });
    if (!settledTrade) continue;
    settled++;
    const pnl = Number(settledTrade["pnl"] ?? 0);
    if (promoCap !== null && pnl < res.pnl) {
      await db()
        .from("users")
        .update({ flagged_reason: "promo_cap_reached" })
        .eq("id", trade.user_id);
    }

    await track(trade.user_id, "trade_settled", {
      symbol: trade.symbol,
      result: res.result,
      pnl,
    });

    const b = await getBalance(trade.user_id);
    const showCta = win && Math.random() < 0.4;
    const arrow = trade.direction === "LONG" ? "📈" : "📉";
    const text = win
      ? `🎉 TRADE WON\n\n${trade.symbol}\n${arrow} ${trade.direction}\n\nProfit:\n+${usd(
          pnl,
        )}\n\n━━━━━━━━━━━━\n\n💰 Balance:\n${usd(b.balance)}`
      : `❌ TRADE CLOSED\n\n${trade.symbol}\n${arrow} ${
          trade.direction
        }\n\nResult:\nLOSS\n\nLoss:\n-${usd(Math.abs(pnl))}\n\n━━━━━━━━━━━━\n\n💰 Balance:\n${usd(
          b.balance,
        )}`;
    const markup = kb([
      [{ text: win ? "🚀 TRADE AGAIN" : "🚀 TRY AGAIN", data: "trade" }],
      [{ text: "📜 HISTORY", data: "history" }],
      ...(showCta ? [[{ text: "👥 INVITE & EARN", data: "invite" }]] : []),
    ]);

    if (user) {
      const photo = win ? IMG.tradeWon() : IMG.tradeLoss();
      const sent = trade.message_id
        ? await editPhoto(user.telegram_id, trade.message_id, photo, text, markup)
        : null;
      if (!sent) await sendPhoto(user.telegram_id, photo, text, markup);
    }

    await qualifyReferral(trade.user_id);
  }

  if (trades.length) {
    try {
      await media?.put(cursorKey, String(trades[trades.length - 1].id));
    } catch (error) {
      console.error("Could not persist trade scheduler cursor", error);
    }
  }

  const { sweepFees } = await import("./payments.server");
  const fees = await sweepFees();
  const { matchDeposits } = await import("./deposits.server");
  const deposits = await matchDeposits();
  const { drainBroadcasts } = await import("./broadcast.server");
  const broadcast = await drainBroadcasts(300);

  return {
    checked: trades.length,
    settled,
    ...fees,
    ...deposits,
    broadcast_sent: broadcast.sent,
    broadcast_failed: broadcast.failed,
  };


}
