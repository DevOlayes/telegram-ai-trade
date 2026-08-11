// Settlement runner: advances open positions and settles them.
import { applyBalance, db, getBalance, getSettings, track, usd } from "./core.server";
import { tickTrade, type TradeRow } from "./engine.server";
import { activeTradeText } from "./bot.server";
import { qualifyReferral } from "./referrals.server";
import { editMessage, kb, sendMessage } from "./telegram.server";

const UPDATE_INTERVAL_MS = 2 * 60 * 1000;

export async function runTick() {
  const settings = await getSettings();
  const { data: trades } = await db().from("trades").select("*").eq("status", "active").limit(200);

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

    settled++;
    const win = res.result === "win";
    await db()
      .from("trades")
      .update({
        status: "settled",
        result: res.result,
        pnl: res.pnl,
        current_price: res.price,
        settled_at: new Date().toISOString(),
      })
      .eq("id", trade.id);

    const credit = Number(trade.amount) + res.pnl;
    await applyBalance(
      trade.user_id,
      { balance: credit, profit: res.pnl },
      { kind: win ? "trade_win" : "trade_loss", amount: res.pnl, ref_id: trade.id },
    );
    await track(trade.user_id, "trade_settled", {
      symbol: trade.symbol,
      result: res.result,
      pnl: res.pnl,
    });

    const b = await getBalance(trade.user_id);
    const showCta = win && Math.random() < 0.4;
    const arrow = trade.direction === "LONG" ? "📈" : "📉";
    const text = win
      ? `🎉 TRADE WON\n\n${trade.symbol}\n${arrow} ${trade.direction}\n\nProfit:\n+${usd(
          res.pnl,
        )}\n\n━━━━━━━━━━━━\n\n💰 Balance:\n${usd(b.balance)}`
      : `❌ TRADE CLOSED\n\n${trade.symbol}\n${arrow} ${
          trade.direction
        }\n\nResult:\nLOSS\n\nLoss:\n-${usd(Math.abs(res.pnl))}\n\n━━━━━━━━━━━━\n\n💰 Balance:\n${usd(
          b.balance,
        )}`;
    const markup = kb([
      [{ text: win ? "🚀 TRADE AGAIN" : "🚀 TRY AGAIN", data: "trade" }],
      [{ text: "📜 HISTORY", data: "history" }],
      ...(showCta ? [[{ text: "👥 INVITE & EARN", data: "invite" }]] : []),
    ]);

    if (user) {
      if (trade.message_id) {
        await editMessage(user.telegram_id, trade.message_id, text, markup);
      } else {
        await sendMessage(user.telegram_id, text, markup);
      }
    }

    await qualifyReferral(trade.user_id);
  }

  const { sweepFees } = await import("./payments.server");
  const fees = await sweepFees();

  return { checked: trades?.length ?? 0, settled, ...fees };
}
