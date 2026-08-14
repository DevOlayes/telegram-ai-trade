# LEXORA — Announcement Bot + Trading Menu

Two surgical changes. No rebuild of trading logic, deposits, withdrawals, referrals, bonus, or wallet.

## Part 1 — Announcement bot (new, separate)

A second Telegram bot whose only job is one screen.

- Upload the supplied 9:16 promo video as a project asset (sent as a normal Telegram video, never a video note, so it keeps its full vertical frame).
- New webhook route `/api/public/telegram/announce` with its own secret-token verification, completely separate from the trading bot's webhook and code.
- On `/start` (or any message), send exactly one message: the video with this caption underneath.

```text
🤖 Welcome to LEXORA

📈 AI-powered trading directly on Telegram.

🎁 Start with your $25 FREE Welcome Bonus — no deposit required.
```

- Two inline URL buttons under it:
  - 🚀 START TRADING → https://t.me/nexoraiaxbot (existing trading bot)
  - 📢 JOIN OUR CHANNEL → https://t.me/lexoracommunity
- Repeat `/start` edits/replaces the same message rather than stacking new ones.
- No menus, no sequences, no trading logic in this bot.

I will request the new bot's API token through the secure secret form (stored as `ANNOUNCE_BOT_TOKEN`, server-side only), then register its webhook.

## Part 2 — Trading menu in the existing bot

Today 🚀 TRADE jumps straight into the trade-selection screen. Change only the navigation:

```text
📈 TRADING
  🚀 START TRADE     → existing trade-selection sequence, unchanged, instantly
  ⚡ ACTIVE TRADES    → user's open trades (or "⚡ No active trades")
  📊 TRADE HISTORY   → existing history screen
  ⬅️ BACK            → main menu
```

- `START TRADE` calls the existing `tradeScreen` function as-is — same engine, same amounts, same confirm step, and still no "Analyzing…" message.
- `ACTIVE TRADES` reads open trades from the existing `trades` table and renders them with the existing active-trade formatter; empty state is one short line.
- `TRADE HISTORY` reuses the existing history screen (compact pair / result / P&L rows from real records).
- Every submenu keeps the existing edit-in-place screen behaviour and gets ⬅️ BACK to the trading menu; the trading menu's BACK returns to the main menu.
- `/trade` command opens the trading menu.

Branding, emoji style, spacing, and artwork stay exactly as they are.

## Technical notes

New files: `src/lib/lexora/announce.server.ts` (announcement bot handler) and `src/routes/api/public/telegram/announce.ts`. Existing `bot.server.ts` gains a `tradeMenuScreen` plus `active` callback route; `tradeScreen`, `historyScreen`, and settlement code are reused untouched.
