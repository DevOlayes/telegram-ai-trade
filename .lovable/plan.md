# LEXORA: rebrand, branded images, clearer withdrawable balance, more wins, share-ready referral

## 1. Rename NEXORA to LEXORA

All user-facing text is renamed: bot screens, welcome, menus, referral message, landing page, share page, admin panel title, page titles/descriptions. Internal folder/file names stay as-is (no functional impact).

## 2. Use your branded images in the bot

The eight uploaded images are uploaded to the CDN and sent as picture messages at the moment each one fits:

| Image | Where it appears |
|---|---|
| Welcome to LEXORA ($25 bonus) | First `/start` welcome screen |
| Logo (AI trading on Telegram) | Main menu / how-it-works |
| Deposit USDT TRC-20 | Deposit address screen |
| Deposit successful | When a deposit is auto-credited |
| Trade won | Winning trade result |
| Trade loss | Losing trade result |
| Withdrawal processing | After a withdrawal request is submitted |
| Withdrawal successful | When admin approves a payout |
| Wide banner | Landing page hero |

Screens that show an image switch to a photo message with the text as its caption; the existing clean-chat editing still applies (caption is edited in place, so the chat does not flood).

## 3. Withdrawable profit shown clearly

Wallet and main menu get an explicit breakdown so it is never ambiguous:

```text
Total balance:      $32.40
Bonus (not withdrawable): $25.00
Withdrawable profit:      $7.40
Referral rewards:         $0.00
```

Plus a one-line note: "Only withdrawable profit can be paid out — the bonus stays in the account for trading." Same wording used on the withdraw checklist.

## 4. Fewer losses

Current setting produces roughly a 55% win rate, so new users often lose 2 of 3 trades. Changes:

- Default win rate raised to 85%.
- New-user streak protection: a user's first 3 settled trades are forced wins, so the first experience is positive.
- No two losses in a row: after a loss, the next trade is a win.
- Win amounts remain the existing profit calculation; losses stay smaller than wins.
- All of this stays adjustable from Admin -> Settings (`win_rate`), and the new guards get their own settings (`starter_wins`, `no_double_loss`) so you can tune later.

## 5. Referral screen with copy-ready caption

The invite screen shows one tap-and-hold copyable block containing the full marketing caption plus the link, so the user copies caption + link in one action:

```text
🎁 FREE $25 WELCOME BONUS

I'm trading on LEXORA — AI trading right inside Telegram.
The AI picks the trade, you just pick the amount.
No deposit needed to start.

Claim your free $25 welcome bonus 👇
https://t.me/<bot>?start=<code>
```

Telegram renders this inside a monospace block with a native copy button, so it is one tap to copy and paste anywhere. A second button copies just the link. The share web page gets the same caption.

## Technical notes

- Images go through `lovable-assets` and are sent with `sendPhoto` / `editMessageCaption`; `telegram.server.ts` gains photo helpers and the screen renderer tracks whether the current screen message is a photo (it recreates the message when switching between text and photo screens).
- Win-rate logic lives in `engine.server.ts` `decideOutcome`, extended to take the user's settled-trade count and last result; `settlement.server.ts` and `bot.server.ts` pass that context.
- `core.server.ts` settings type gains `starter_wins` and `no_double_loss`; a migration seeds them and updates `win_rate`.
- Balance breakdown reads existing `balances` columns (`balance`, `bonus`, `profit`, `referral_balance`) — no schema change needed.
