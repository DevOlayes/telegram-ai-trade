// Settlement runner: advances open positions and settles them.
import { applyBalance, db, getBalance, getSettings, track, usd } from "./core.server";
import { tickTrade, type TradeRow } from "./engine.server";
import { activeTradeText } from "./bot.server";
import { qualifyReferral } from "./referrals.server";
import { editMessage, editPhoto, kb, sendPhoto } from "./telegram.server";
import { IMG } from "./images.server";

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

    // Atomic settle: only the first worker to flip status="active" credits.
    const { data: claimed } = await db()
      .from("trades")
      .update({
        status: "settled",
        result: res.result,
        pnl: res.pnl,
        current_price: res.price,
        settled_at: new Date().toISOString(),
      })
      .eq("id", trade.id)
      .eq("status", "active")
      .select("id");
    if (!claimed?.length) continue;

    settled++;
    const win = res.result === "win";

    // Server-side bound on promotional compounding: accounts that never
    // deposited cannot accumulate profit past the configured allowance.
    let pnl = res.pnl;
    if (win) {
      const { count: deposited } = await db()
        .from("deposits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", trade.user_id)
        .eq("status", "credited");
      if (!deposited) {
        const cap = Number(
          (settings as unknown as { promo_max_earnings?: number }).promo_max_earnings ?? 5000,
        );
        const cur = await getBalance(trade.user_id);
        const room = Math.max(0, cap - Number(cur.profit));
        if (pnl > room) {
          pnl = Number(room.toFixed(2));
          await db()
            .from("users")
            .update({ flagged_reason: "promo_cap_reached" })
            .eq("id", trade.user_id);
        }
      }
    }
    if (pnl !== res.pnl) {
      await db().from("trades").update({ pnl }).eq("id", trade.id);
    }

    const credit = Number(trade.amount) + pnl;
    await applyBalance(
      trade.user_id,
      { balance: credit, profit: pnl },
      { kind: win ? "trade_win" : "trade_loss", amount: pnl, ref_id: trade.id },
    );

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

  const { sweepFees } = await import("./payments.server");
  const fees = await sweepFees();
  const { matchDeposits } = await import("./deposits.server");
  const deposits = await matchDeposits();

  return { checked: trades?.length ?? 0, settled, ...fees, ...deposits };

}
