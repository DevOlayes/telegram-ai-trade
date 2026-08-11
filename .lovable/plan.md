# NEXORA: simpler trading, cleaner welcome, new withdrawal rules

## 1. Welcome & bonus

- Welcome message becomes short and purely about the bot: what NEXORA is (AI picks the trade, you pick the amount), and the $25 welcome bonus. No eligibility criteria, no withdrawal rules, no waiting-period text.
- One button: `CLAIM $25 BONUS` (plus `HOW IT WORKS`).
- After tapping claim, a dedicated congratulations screen: "Congratulations — you claimed your $25 free trading bonus", balance shown, then `START TRADING`.

## 2. Trading flow: 2 steps instead of 5

Today: analyzing → recommendation → view trade → risk (conservative/balanced/aggressive) → amount → confirm.

New flow:

```text
[TRADE] → AI analyzing… → Step 1: Trade card + amount buttons → Step 2: Confirm → Trade active
```

- The AI picks the pair, direction, duration and risk internally. The conservative / balanced / aggressive screen is removed entirely.
- Step 1 shows one plain-language card: pair, Buy/Sell (with up/down arrow), how long it runs, and "Choose how much to trade" with preset amounts + `CUSTOM`.
- Step 2 confirms: amount, possible profit, possible loss, duration, one `START TRADE` button.
- All wording moves to plain English (Buy/Sell instead of LONG/SHORT, "Target"/"Safety stop" instead of TP/SL, "Runs for 1 hour").

## 3. Referrals

- Remove the web share-page deep link button.
- Invite screen shows a ready-to-send promotional message with the referral link inside it, in one copyable block, so the user can tap-hold, copy and paste it anywhere. Example: a short pitch about NEXORA + "$25 free bonus" + the link.
- Keep invite/active/rewards stats and milestones.

## 4. Withdrawal rules made explicit

Tapping `WITHDRAW` always shows a checklist so the rules are obvious:

```text
✅ Claimed $25 bonus
✅/❌ Profit of at least $30   (you have $X)
✅/❌ Account age 72h          (opens in Xh)
```

Plain explanation above it: only trading profit can be withdrawn — the $25 bonus itself stays in the account and is only used for trading. So a user must trade the bonus into at least $30 of profit.

If any item is unchecked, the screen ends with `TRADE` / `INVITE` buttons. If all are checked, the flow continues.

## 5. $4 service charge (new)

Once eligible, withdrawal runs:

```text
Enter TRC-20 wallet → Review → Pay $4 one-time service charge
   → bot auto-checks the TRON blockchain → confirmed → pending admin approval
```

- The bot shows your USDT TRC-20 collection address and a unique amount to send (4.00 plus a few unique cents, so each payment can be matched to the right user automatically).
- A background check (running with the existing minute ticker) watches the collection address for that exact incoming amount. When found, the withdrawal is marked fee-paid and the user gets a confirmation message.
- Until the fee is detected, the withdrawal sits as "awaiting service charge" with a `CHECK PAYMENT` button and expires if unpaid after a set window.
- Admin panel gains: fee status column, tx hash, and a manual "mark fee paid" override, plus the existing approve/reject.

## Technical notes

- `bot.server.ts`: rewrite `welcomeScreen`, `claimBonus`, `startTrade` (merge setup+amount), remove `setupScreen` and `risk:` routes; risk factor fixed server-side to the balanced profile; rewrite `withdrawScreen` as a requirement checklist; add fee sub-flow states in `ui_state`.
- New `payments.server.ts`: TronGrid query for TRC-20 USDT transfers to the collection address, matched by unique amount + timestamp window; called from the existing `/api/public/nexora/tick` route and from the `CHECK PAYMENT` button.
- DB migration: add `service_fee_amount`, `service_fee_status`, `service_fee_tx`, `fee_requested_at` to `withdrawals`; add `service_fee` and `fee_window_minutes` to `system_settings`.
- Requires two values from you: the USDT TRC-20 collection wallet address, and (optionally) a TronGrid API key for reliable rate limits. I will request them securely once the plan is approved.
- Landing/share page untouched apart from removing the referral deep-link button usage.
