# NEXORA — Telegram AI Trading Bot MVP

A Telegram chat bot (not a Mini App) with a $25 welcome bonus, AI-generated trades, a controlled settlement engine, wallet/withdrawals, referrals, and a minimal web admin panel.

## What gets built

**1. Backend + database (Lovable Cloud)**
Tables: `users`, `balances`, `trades`, `trading_pairs`, `withdrawals`, `referrals`, `referral_rewards`, `milestones`, `user_milestones`, `transactions`, `system_settings`, `admin_actions`, plus a lightweight `events` table for behaviour tracking. All money stored as `numeric(18,2)` (no float math). Seeded settings: bonus $25, min withdrawal $30, 72h waiting period, referral reward $2, milestones 1/5/10/25, durations 30m/45m/1h/2h/3h/4h, pairs BTC/ETH/SOL/XRP/BNB-USDT.

**2. Telegram webhook**
One public endpoint `/api/public/telegram/webhook` handling `/start` (with referral payload), commands, and all callback buttons. Bot token stored as a secret — never in code. Persistent command menu: Home, Trade, Invite, Wallet, History, How it works.

**3. Chat-cleanliness layer**
A small message helper used by every flow: edit-in-place by default, auto-delete temporary prompts (loading, selection, errors, expired keyboards), keep only final trade results, withdrawal records and important notices. Each user has one "active screen" message id that gets edited rather than re-sent.

**4. Onboarding + bonus**
Welcome message → Claim $25 (one claim per Telegram ID, enforced in DB) → balance $25, referral source recorded, 72h withdrawal clock starts and is disclosed.

**5. AI trade flow**
Analyzing… → edit into recommendation (pair, LONG/SHORT, confidence, suggested duration) → trade setup with entry/TP/SL → risk choice (Conservative / Balanced⭐ / Aggressive) → amount buttons + custom (capped at balance) → confirm screen with potential profit/loss → active trade message updated on a sensible interval → edited into WIN/LOSS result with new balance. Referral CTA only occasionally after wins.

**6. Settlement engine (isolated module)**
A separate price/settlement service behind a narrow interface (`getPrice`, `openPosition`, `settle`) so it can later be swapped for a live exchange. Synthetic price walk per pair; outcome decided by programmed, admin-configurable rules (win bias, volatility, expiry rule: settle at expiry price by default). A cron-style endpoint ticks open trades, updates the active message, and settles on TP/SL/expiry, crediting balances atomically.

**7. Wallet + withdrawals**
Wallet splits bonus / profit / eligible balance. Withdrawal requires ≥$30 eligible profit AND 72h since registration; locked screen shows the countdown. USDT TRC-20 only, address validated (T-prefix, length), confirmation screen, then a status message updated in place as admin changes status.

**8. Referrals + milestones**
Unique code per user, `t.me/<bot>?start=CODE`, tracked at /start. Referral becomes ACTIVE after a configurable qualifying activity (default: bonus claimed + 1 completed trade), then $2 credited to a separate referral rewards balance with a monthly payout date. Share screen with prebuilt share text, a Telegram share link, a web share page (native share sheet + copy link for WhatsApp/X/etc.), and Copy Link. Milestone progress bar and unlock notification.

**9. Anti-abuse**
One account per Telegram ID, no self-referral, referrer immutable, reward only after qualification, wallet-reuse and rapid-referral flags surfaced to admin.

**10. Admin panel (web, minimal)**
Password/admin-role protected pages: Users, Trades, Withdrawals (approve/reject/mark paid), Referrals, Settings (all configurable values above). Plain tables, no charts.

## Defaults chosen (say the word to change)
- Settlement bias: configurable win rate, default 55% weighted by AI confidence; on expiry the trade settles at the current synthetic price.
- Active trade message refresh: every ~2 minutes.
- Qualifying referral activity: friend claims bonus and completes one trade.
- Admin access: admin flag on a Lovable Cloud account, web panel only.

## Technical notes
TanStack Start server routes for the webhook and tick endpoint; Lovable Cloud (Postgres) for data; modular folders `src/lib/nexora/{telegram,users,ai,trading,settlement,referrals,wallet,admin}`. Bot token requested through the secure secret form before wiring the webhook. Financial math via integer cents / numeric columns.

## Build order
1. DB + Telegram webhook + onboarding + $25 bonus
2. Home/menu + AI trade flow + settlement engine + tick loop
3. Wallet + withdrawals
4. Referrals + milestones + sharing
5. Admin panel + settings
6. Chat cleanup polish + testing
