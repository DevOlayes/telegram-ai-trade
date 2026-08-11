/**
 * NEXORA Telegram interface: screens, flows and update routing.
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
  type NexoraUser,
  type Settings,
} from "./core.server";
import {
  decideOutcome,
  planTrade,
  sizeTrade,
  type TradePlan,
} from "./engine.server";
import { qualifyReferral, referralStats } from "./referrals.server";
import {
  answerCallback,
  deleteMessage,
  detachScreen,
  kb,
  renderScreen,
  sendMessage,
} from "./telegram.server";

const LINE = "━━━━━━━━━━━━";

export const appUrl = () =>
  process.env["APP_URL"] ?? "https://project--f7d5b767-7e2d-482f-a147-2287f89d926c.lovable.app";
export const botUsername = () => process.env["TELEGRAM_BOT_USERNAME"] ?? "NexoraBot";
export const refLink = (code: string) => `https://t.me/${botUsername()}?start=${code}`;

/* ------------------------------ screens ------------------------------ */

async function welcomeScreen(u: NexoraUser, s: Settings) {
  await renderScreen(
    u,
    `🤖 WELCOME TO NEXORA\n\nAI-powered trading, right inside Telegram.\n\nOur AI studies the market, picks the trade and tells you exactly what it found. You just choose how much to put in — that's it.\n\n🎁 ${usd(
      s.welcome_bonus,
    )} WELCOME BONUS\nFree to start. No deposit needed.\n\nTap below to claim it and start trading.`,
    kb([
      [{ text: `🎁 CLAIM ${usd(s.welcome_bonus)} BONUS`, data: "claim" }],
      [{ text: "ℹ️ HOW IT WORKS", data: "how" }],
    ]),
  );
}


export async function homeScreen(u: NexoraUser) {
  const b = await getBalance(u.id);
  const { count } = await db()
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", u.id)
    .eq("status", "settled");
  await renderScreen(
    u,
    `🤖 NEXORA\n\n💰 Balance\n${usd(b.balance)}\n\n📈 Profit\n${signedUsd(
      Number(b.profit),
    )}\n\n📊 Trades\n${count ?? 0}\n\n${LINE}`,
    kb([
      [{ text: "🚀 TRADE", data: "trade" }],
      [{ text: "👥 INVITE & EARN", data: "invite" }],
      [{ text: "💰 WALLET", data: "wallet" }],
      [{ text: "📜 HISTORY", data: "history" }],
    ]),
  );
}

async function howScreen(u: NexoraUser, s: Settings) {
  await renderScreen(
    u,
    `ℹ️ HOW NEXORA WORKS\n\n1. Claim your ${usd(s.welcome_bonus)} promotional bonus (no deposit).\n2. NEXORA AI picks the trade.\n3. You choose your risk and amount.\n4. Trades run 30 min – 4 hours.\n5. Wins and losses update your balance.\n\n💸 Withdrawals\nMinimum ${usd(
      s.min_withdrawal,
    )} eligible profit, ${s.withdrawal_wait_hours}h after registration, USDT TRC-20.\n\n👥 Invite friends: they get ${usd(
      s.welcome_bonus,
    )}, you earn ${usd(s.referral_reward)} per qualified referral.\n\n⚠️ Trading involves risk. Markets can move against a trade.\nWe record your activity in the bot to operate and improve the service.`,
    kb([[{ text: "🏠 HOME", data: "home" }]]),
  );
}

/* ------------------------------ trade flow ------------------------------ */

async function startTrade(u: NexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  if (toCents(b.balance) < 100) {
    await renderScreen(
      u,
      `⚠️ NOT ENOUGH BALANCE\n\nBalance: ${usd(b.balance)}\nMinimum trade: $1.00\n\nInvite friends to earn more.`,
      kb([[{ text: "👥 INVITE & EARN", data: "invite" }], [{ text: "🏠 HOME", data: "home" }]]),
    );
    return;
  }
  await renderScreen(u, "🤖 NEXORA AI\n\nAnalyzing the market…");
  const plan = await planTrade(s);
  await setUiState(u.id, { plan });
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
async function tradeScreen(u: NexoraUser, s: Settings) {
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
    `🤖 AI FOUND A TRADE\n\n${plan.symbol}\n${dirIcon(plan.direction)} ${dirWord(
      plan.direction,
    )}\n\n⏱ Runs for:\n${durText(plan.duration_minutes)}${
      s.show_confidence ? `\n\n🎯 AI confidence:\n${plan.confidence}%` : ""
    }\n\n💰 Your balance:\n${usd(b.balance)}\n\n${LINE}\n\nStep 1 of 2 — how much do you want to trade?`,
    kb([
      ...options.map((v) => [
        { text: `${usd(v)}${v === rec.amount ? "  ⭐ AI pick" : ""}`, data: `amt:${v}` },
      ]),
      [{ text: "✏️ OTHER AMOUNT", data: "custom" }],
      [{ text: "🔄 NEW TRADE", data: "trade" }, { text: "🏠 HOME", data: "home" }],
    ]),
  );
}

/** Step 2 — confirm. */
async function confirmScreen(u: NexoraUser, s: Settings, amount: number) {
  const st = u.ui_state as { plan?: TradePlan };
  if (!st.plan) return startTrade(u, s);
  const b = await getBalance(u.id);
  if (toCents(amount) > toCents(b.balance)) {
    await renderScreen(
      u,
      `⚠️ That is more than your balance (${usd(b.balance)}).`,
      kb([[{ text: "⬅️ BACK", data: "setup" }]]),
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
    `⚡ CONFIRM YOUR TRADE\n\n${st.plan.symbol}\n${dirIcon(st.plan.direction)} ${dirWord(
      st.plan.direction,
    )}\n\nYou are trading:\n${usd(amount)}\n\nIf it wins:\n+${usd(
      draft.potential_profit,
    )}\n\nIf it loses:\n-${usd(draft.potential_loss)}\n\n⏱ Runs for:\n${durText(
      st.plan.duration_minutes,
    )}\n\n${LINE}\nStep 2 of 2 — markets can move against a trade.`,
    kb([
      [{ text: "✅ START TRADE", data: "enter" }],
      [{ text: "⬅️ BACK", data: "setup" }, { text: "❌ CANCEL", data: "home" }],
    ]),
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
  return `⚡ TRADE ACTIVE\n\n${t.symbol}\n${dirIcon(t.direction)} ${t.direction}\n\nEntry:\n${price(
    t.entry_price,
  )}\n\nCurrent:\n${price(t.current_price)}\n\n🎯 TP:\n${price(t.take_profit)}\n\n🛑 SL:\n${price(
    t.stop_loss,
  )}\n\n⏱ Remaining:\n${remaining}\n\nPotential Profit:\n+${usd(
    t.potential_profit,
  )}\n\nPotential Loss:\n-${usd(t.potential_loss)}`;
}

async function enterTrade(u: NexoraUser, s: Settings) {
  const st = u.ui_state as {
    plan?: TradePlan;
    risk?: string;
    draft?: { amount: number; leverage: number; potential_profit: number; potential_loss: number };
  };
  if (!st.plan || !st.draft) return startTrade(u, s);
  const b = await getBalance(u.id);
  if (toCents(st.draft.amount) > toCents(b.balance)) return amountScreen(u, s);

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
      target_outcome: decideOutcome(st.plan.confidence, s),
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
  await renderScreen(u, activeTradeText(trade), kb([[{ text: "🏠 HOME", data: "home" }]]));
  // The active trade message now owns its own lifecycle (edited by the tick job).
  await detachScreen(u.id);
}

/* ------------------------------ wallet ------------------------------ */

function eligibleAt(u: NexoraUser, s: Settings) {
  return new Date(u.created_at).getTime() + s.withdrawal_wait_hours * 3600000;
}

async function walletScreen(u: NexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  await renderScreen(
    u,
    `💰 MY WALLET\n\nBalance:\n${usd(b.balance)}\n\n🎁 Welcome Bonus:\n${usd(
      b.bonus,
    )}\n\n📈 Profit:\n${signedUsd(Number(b.profit))}\n\n💸 Eligible Balance:\n${usd(
      Math.max(0, Number(b.profit)),
    )}\n\n${LINE}\nWithdrawals: min ${usd(s.min_withdrawal)} eligible profit, ${
      s.withdrawal_wait_hours
    }h after registration.`,
    kb([
      [{ text: "💸 WITHDRAW", data: "wd" }],
      [{ text: "📜 WITHDRAWALS", data: "wdlist" }],
      [{ text: "🏠 HOME", data: "home" }],
    ]),
  );
}

async function withdrawScreen(u: NexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  const eligible = Math.max(0, Number(b.profit));
  const openAt = eligibleAt(u, s);
  if (Date.now() < openAt) {
    const left = openAt - Date.now();
    const d = Math.floor(left / 86400000);
    const h = Math.floor((left % 86400000) / 3600000);
    await renderScreen(
      u,
      `🔒 WITHDRAWAL LOCKED\n\nYour withdrawal window opens in:\n\n⏳ ${d} day${
        d === 1 ? "" : "s"
      } ${h} hours\n\nMinimum eligible balance:\n💰 ${usd(s.min_withdrawal)}\n\nYour eligible balance:\n${usd(
        eligible,
      )}`,
      kb([[{ text: "🚀 TRADE", data: "trade" }], [{ text: "🏠 HOME", data: "home" }]]),
    );
    return;
  }
  if (toCents(eligible) < toCents(s.min_withdrawal)) {
    await renderScreen(
      u,
      `🔒 WITHDRAWAL LOCKED\n\nEligible balance:\n${usd(eligible)}\n\nMinimum:\n💰 ${usd(
        s.min_withdrawal,
      )}\n\nKeep trading or invite friends to reach the minimum.`,
      kb([[{ text: "🚀 TRADE", data: "trade" }], [{ text: "👥 INVITE & EARN", data: "invite" }]]),
    );
    return;
  }
  await setUiState(u.id, { flow: "wd_address", amount: eligible });
  await renderScreen(
    u,
    `💸 WITHDRAW PROFIT\n\nAmount:\n${usd(eligible)}\n\nMinimum:\n${usd(
      s.min_withdrawal,
    )}\n\nNetwork:\n🔴 TRON (TRC-20)\n\n⚠️ Only enter a USDT TRC-20 wallet address.\nUsing the wrong network may result in permanent loss of funds.\n\nSend your TRC-20 address in this chat 👇`,
    kb([[{ text: "❌ CANCEL", data: "wallet" }]]),
  );
}

async function withdrawalsScreen(u: NexoraUser) {
  const { data } = await db()
    .from("withdrawals")
    .select("amount,status,created_at")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? [])
    .map((w) => `${usd(w.amount)} — ${String(w.status).toUpperCase()}`)
    .join("\n");
  await renderScreen(
    u,
    `📜 WITHDRAWALS\n\n${rows || "No withdrawals yet."}`,
    kb([[{ text: "💰 WALLET", data: "wallet" }], [{ text: "🏠 HOME", data: "home" }]]),
  );
}

/* ------------------------------ referrals ------------------------------ */

async function inviteScreen(u: NexoraUser, s: Settings) {
  const st = await referralStats(u.id);
  const filled = st.next ? Math.round((st.active / st.next.active_referrals) * 10) : 10;
  const bar = "█".repeat(Math.min(10, filled)) + "░".repeat(Math.max(0, 10 - filled));
  await renderScreen(
    u,
    `👥 INVITE & EARN\n\n🎁 Friend gets:\n${usd(s.welcome_bonus)}\n\n💰 You earn:\n${usd(
      s.referral_reward,
    )} per qualified referral\n\n${LINE}\n\n👥 Invited:\n${st.invited}\n\n✅ Active:\n${
      st.active
    }\n\n💰 Rewards:\n${usd(st.rewards)}${
      st.next
        ? `\n\n🎯 Next milestone:\n${st.next.active_referrals} Active Referrals\n\n${bar} ${st.active}/${st.next.active_referrals}`
        : "\n\n🏆 All milestones unlocked!"
    }`,
    kb([
      [{ text: "📤 SHARE & EARN", url: `${appUrl()}/share?c=${u.referral_code}` }],
      [{ text: "🔗 COPY LINK", data: "link" }],
      [{ text: "🎯 MILESTONES", data: "ms" }, { text: "💰 MY REWARDS", data: "rewards" }],
      [{ text: "🏠 HOME", data: "home" }],
    ]),
  );
}

async function milestonesScreen(u: NexoraUser) {
  const st = await referralStats(u.id);
  const { data } = await db()
    .from("milestones")
    .select("active_referrals,reward_amount")
    .eq("active", true)
    .order("active_referrals");
  const rows = (data ?? [])
    .map(
      (m) =>
        `${st.active >= m.active_referrals ? "✅" : "🎯"} ${m.active_referrals} Active — ${usd(
          m.reward_amount,
        )}`,
    )
    .join("\n");
  await renderScreen(
    u,
    `🎯 MILESTONES\n\n${rows}\n\n${LINE}\n✅ Active referrals: ${st.active}`,
    kb([[{ text: "👥 INVITE & EARN", data: "invite" }]]),
  );
}

async function rewardsScreen(u: NexoraUser, s: Settings) {
  const b = await getBalance(u.id);
  const next = new Date();
  next.setMonth(next.getMonth() + (next.getDate() >= s.payout_day ? 1 : 0));
  next.setDate(Math.min(s.payout_day, 28));
  await renderScreen(
    u,
    `👥 REFERRAL REWARDS\n\nAvailable:\n${usd(b.referral_balance)}\n\n📅 Next payout:\n${next.toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric" },
    )}\n\nStatus:\n⏳ Pending review`,
    kb([[{ text: "👥 INVITE & EARN", data: "invite" }], [{ text: "🏠 HOME", data: "home" }]]),
  );
}

/* ------------------------------ history ------------------------------ */

async function historyScreen(u: NexoraUser) {
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
    .map((t) => `${t.result === "win" ? "🟢" : "🔴"} ${t.symbol}\n${signedUsd(Number(t.pnl ?? 0))}`)
    .join("\n\n");
  await renderScreen(
    u,
    `📜 TRADE HISTORY\n\n${rows || "No trades yet."}\n\n${LINE}\n\nTrades:\n${
      trades.length
    }\n\nWins:\n${wins}\n\nLosses:\n${trades.length - wins}\n\nProfit:\n${signedUsd(
      fromCents(total),
    )}`,
    kb([[{ text: "🚀 TRADE", data: "trade" }], [{ text: "🏠 HOME", data: "home" }]]),
  );
}

/* ------------------------------ routing ------------------------------ */

async function claimBonus(u: NexoraUser, s: Settings) {
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
    `🎉 ${usd(s.welcome_bonus)} BONUS CLAIMED!\n\nYour NEXORA account is ready.\n\n💰 Balance:\n${usd(
      s.welcome_bonus,
    )}`,
    kb([[{ text: "🚀 START TRADING", data: "trade" }], [{ text: "👥 INVITE & EARN", data: "invite" }]]),
  );
}

async function route(u: NexoraUser, s: Settings, action: string) {
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
      return setupScreen(u, s, ((u.ui_state as { risk?: string }).risk ?? "balanced"));
    case "risk":
      return setupScreen(u, s, arg ?? "balanced");
    case "amount":
      return amountScreen(u, s);
    case "amt":
      return confirmScreen(u, s, Number(arg));
    case "custom":
      await setUiState(u.id, { ...(u.ui_state as object), flow: "custom_amount" });
      return renderScreen(
        u,
        "✏️ CUSTOM AMOUNT\n\nSend the amount you want to trade (e.g. 7.50).",
        kb([[{ text: "⬅️ BACK", data: "amount" }]]),
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
    case "link":
      return renderScreen(
        u,
        `🔗 YOUR REFERRAL LINK\n\n${refLink(u.referral_code)}\n\nTap and hold to copy.`,
        kb([
          [{ text: "📤 SHARE & EARN", url: `${appUrl()}/share?c=${u.referral_code}` }],
          [{ text: "👥 INVITE & EARN", data: "invite" }],
        ]),
      );
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

async function submitWithdrawal(u: NexoraUser, s: Settings) {
  const st = u.ui_state as { amount?: number; address?: string };
  if (!st.amount || !st.address) return walletScreen(u, s);
  const b = await getBalance(u.id);
  if (toCents(st.amount) > toCents(b.profit)) return walletScreen(u, s);

  const { data: wd } = await db()
    .from("withdrawals")
    .insert({ user_id: u.id, amount: st.amount, wallet_address: st.address })
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

  const msg = await sendMessage(
    u.telegram_id,
    `⏳ WITHDRAWAL PROCESSING\n\nAmount:\n${usd(st.amount)}\n\nNetwork:\nTRC-20\n\nWallet:\n${st.address}\n\nStatus:\nPending`,
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
      await renderScreen(u, "⚠️ Enter a valid amount, e.g. 7.50", kb([[{ text: "⬅️ BACK", data: "amount" }]]));
      return;
    }
    await setUiState(u.id, { ...(u.ui_state as object), flow: undefined });
    u.ui_state = { ...(u.ui_state as object), flow: undefined };
    await confirmScreen(u, s, fromCents(toCents(amount)));
    return;
  }

  if (!isCommand && st.flow === "wd_address") {
    const address = text;
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
      await renderScreen(
        u,
        "⚠️ That does not look like a USDT TRC-20 address.\n\nIt must start with T and be 34 characters.\nSend it again 👇",
        kb([[{ text: "❌ CANCEL", data: "wallet" }]]),
      );
      return;
    }
    await setUiState(u.id, { ...(u.ui_state as object), address });
    u.ui_state = { ...(u.ui_state as object), address };
    await renderScreen(
      u,
      `🔎 CHECK WITHDRAWAL\n\nAmount:\n${usd(st.amount ?? 0)}\n\nNetwork:\nTRON (TRC-20)\n\nWallet:\n${address}\n\n⚠️ Confirm that this is a USDT TRC-20 address.`,
      kb([[{ text: "✅ CONFIRM WITHDRAWAL", data: "wdconfirm" }], [{ text: "❌ CANCEL", data: "wallet" }]]),
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
