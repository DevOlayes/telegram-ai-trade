# NEXORA — UX polish + automatic USDT deposits

No rebuild. The trading engine, AI logic, settlement, referrals, wallet, withdrawal rules and database stay exactly as they are. This changes presentation, navigation, and adds deposits.

## 1. Remove "Analyzing the market…"

Tapping TRADE currently renders a temporary "Analyzing the market…" screen before the trade card. That single render is removed — the trade card (same plan, same logic) appears immediately on the first tap.

## 2. Consistent message formatting

One shared style applied to every screen: a title line with one emoji, compact `Label: value` lines instead of the current label-on-its-own-line/value-below blocks (which make screens twice as tall on mobile), one divider max, money always `$0.00`, buttons in consistent uppercase wording. Content stays the same; only layout and spacing change.

## 3. Back navigation everywhere

Every secondary screen gets a bottom row of `🔙 BACK` (previous logical screen) and `🏠 MENU`. Back always edits the current screen message in place — no new messages, no chat clutter. Screens getting back targets:

```text
HOME → TRADE → CONFIRM → back to TRADE
HOME → WALLET → WITHDRAW / WITHDRAWALS → back to WALLET
HOME → INVITE → LINK / MILESTONES / REWARDS → back to INVITE
HOME → DEPOSIT → back to HOME
HOME → HISTORY / HOW → back to HOME
```

## 4. Main menu

Home keeps the existing balance/profit/trade summary and gains DEPOSIT:

```text
🚀 TRADE
💳 DEPOSIT      💸 WITHDRAW
👥 INVITE & EARN
💰 WALLET       📜 HISTORY
```

## 5. Deposit — USDT TRC-20 only, auto-credited

No network, chain or wallet selection. Tapping DEPOSIT creates (or reuses) an open deposit intent for the user and shows one screen:

```text
💳 DEPOSIT — USDT (TRC-20)

Send exactly:  50.37 USDT
Address:       T...

⚠️ TRON (TRC-20) only. The exact amount identifies your payment.
```

Attribution (as you chose): one shared collection wallet — the same TRC-20 wallet already used for the $4 service charge — with a unique cents tag per pending deposit, the same proven mechanism the fee flow uses. A user picks a whole-dollar amount (preset buttons 10/25/50/100 or custom) and the bot appends unique cents.

Verification is automatic in the background:

- The existing minute ticker (`/api/public/nexora/tick`) also scans TronGrid for confirmed USDT TRC-20 transfers to the collection wallet.
- A transfer is credited only when the token contract, destination address, confirmation state and exact amount all match an open intent.
- The tx hash is stored with a unique constraint — the same transaction can never be credited twice.
- On match: balance credited, ledger row written, and the user's deposit message is **edited** into `✅ DEPOSIT CONFIRMED` with amount, new balance and tx hash. No admin action, no "checking…" spam.
- Unmatched intents expire after a configurable window and the screen says so.

Status flow shown to the user in one message, edited in place: `⏳ AWAITING PAYMENT` → `✅ DEPOSIT CONFIRMED` (or `⌛ EXPIRED`).

Deposit confirmations, trade results and withdrawal records are never deleted; only loading/prompt/expired-menu messages are.

## 6. Admin

Withdrawals tab keeps its fee columns; a read-only Deposits list is added (user, amount, status, tx hash, time). Deposits need no approval.

## Technical notes

- `bot.server.ts`: delete the analyzing `renderScreen` call in `startTrade`; add a `screen(title, rows, buttons)` formatter helper and route every screen through it; add `back` targets per screen; add `depositScreen` / amount picker / intent creation; add `deposit` + `dep:*` routes and `/deposit` command.
- New `deposits.server.ts`: reuses `payments.server.ts` TronGrid helpers (shared `recentTransfers`, USDT contract read from a configurable setting/env rather than inline), `matchDeposits()` sweep with idempotent crediting through the existing `applyBalance` ledger.
- `settlement.server.ts` tick also calls `matchDeposits()` — same minute cron, no new infrastructure.
- Migration: new `deposits` table (`user_id`, `amount`, `unique_amount`, `wallet_address`, `tx_hash` unique, `status` pending/confirmed/credited/expired, `message_id`, timestamps, `credited_at`) with grants + RLS; `system_settings` gains `deposit_window_minutes` and `usdt_contract`.
- Existing trade/settlement/referral/withdrawal logic untouched.
- Deposits stay disabled with a polite notice until `fee_wallet` is set in Admin → Settings (still empty today).
