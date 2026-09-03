# Broadcast System + Withdrawal Recovery Campaign

Two parts: a reusable admin broadcast tool, and one immediate campaign to users who started a withdrawal but never completed it.

## Part 1 — Admin broadcast tool

New "Broadcast" tab in the admin panel.

Compose a broadcast with:
- Message text
- Optional media (image or video, chosen from project assets — including the video you just uploaded)
- Up to two buttons, each either a link button or one of the bot's built-in actions (Withdraw, Trade, Deposit, Wallet, Invite)

Choose the audience:
- All users
- Abandoned withdrawals (started a withdrawal that expired or was cancelled, never completed one)
- Users with withdrawable profit
- Users who never traded
- Inactive (no trade in N days)

Before sending, the panel shows the exact recipient count and a preview of the message. Sending is done in the background, paced to respect Telegram's rate limits, with users who blocked the bot skipped automatically. Each broadcast is recorded with its text, audience, sent/failed counts, and timestamp, and the history is shown in the tab so nothing gets sent twice by accident.

Broadcasts arrive as a separate message and do not disturb the user's existing bot screen.

## Part 2 — The withdrawal recovery broadcast (sent now)

Audience: users whose withdrawal expired or was cancelled and who have never completed a withdrawal (the existing abandoned-withdrawal query already identifies these).

Media: your uploaded vertical video, sent as a normal video with the message as its caption.

Message:

```text
💸 YOUR PROFIT IS STILL WAITING

Your withdrawal request was never completed, so your profit was returned to your balance — it is still yours.

You can restart your withdrawal right now:
1. Tap the button below
2. Send your USDT TRC-20 wallet address
3. Pay the one-time $4 USDT service charge (copy buttons provided)
4. Your profit is sent once payment is confirmed on-chain

⚠️ Withdrawals above $5,000 go through an additional review before being fulfilled.
```

One button: 💸 WITHDRAW NOW — opens the existing withdrawal screen inside the bot, exactly the same flow as today.

After it runs, the admin panel shows how many were reached and how many failed.

## What does not change

Withdrawal logic, the $4 service charge, on-chain verification, trading, balances, and the bot's existing screens all stay exactly as they are. The broadcast only sends messages and links back into the current flow.

## Technical notes

- New table `broadcasts` (text, media asset, buttons, audience, counts, status) plus `broadcast_recipients` for per-user delivery state and idempotency; both with RLS restricted to admins and grants.
- New `src/lib/nexora/broadcast.server.ts`: audience resolvers, send worker with ~25 msg/s throttling and 429 retry handling, marking users blocked on 403.
- Server functions in `admin.functions.ts` (admin-gated): `previewAudience`, `createBroadcast`, `runBroadcast`, `listBroadcasts`. Delivery is chunked and resumable, driven by the existing per-minute tick route so long sends survive request timeouts.
- Video registered as a Lovable asset pointer under `src/assets/`, sent by URL via `sendVideo`.
- Buttons reuse the existing `kb()` helper and existing callback routes (`wd`, `trade`, etc.).
