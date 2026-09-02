# Add Telegram native `copy_text` buttons for the two wallet addresses

## Context (verified from current code)

The project already implements Telegram's native copy button. In
`src/lib/nexora/telegram.server.ts`, the `kb()` helper maps a `Button` with a
`copy` field to Telegram's `InlineKeyboardButton.copy_text`:

```ts
b.copy ? { text: b.text, copy_text: { text: b.copy } } : ...
```

So no new clipboard mechanism is needed — we reuse the existing `Button.copy`
field. No browser clipboard API is used anywhere; this fix is Telegram-only.

### Current state of the two target screens (in `bot.server.ts`)

1. **Deposit pay screen — `depositPayScreen` (≈lines 489–513)**
   Displays the deposit address as plain text (`dep.wallet_address`) but has
   **no copy button**. Buttons today: "❌ CANCEL DEPOSIT" + nav.
   - **Gap:** no way to copy the deposit address.

2. **Service-fee screen — `feeScreen` (≈lines 617–661)**
   Already renders a working native copy button:
   `{ text: "📋 COPY ADDRESS", copy: wallet }` plus a copy-amount button.
   - **No functional gap** — the native `copy_text` button already copies the
     fee wallet. Only the label is generic ("COPY ADDRESS").

## Changes (surgical — two edits in `src/lib/nexora/bot.server.ts`)

### 1. Deposit screen — add a "Copy Deposit Address" button

In `depositPayScreen`, add a new row to the keyboard that copies the **exact
address currently displayed** (`dep.wallet_address`):

```ts
kb([
  [{ text: "📋 COPY DEPOSIT ADDRESS", copy: dep.wallet_address }],
  [{ text: "❌ CANCEL DEPOSIT", data: `depcancel:${dep.id}` }],
  nav(),
])
```

- `dep.wallet_address` is the same value interpolated into the screen text, so
  the copied value always matches what is displayed. Not hardcoded.
- `renderScreen` already sends this markup as a photo inline keyboard
  (`editMessageMedia`/`sendPhoto` accept `reply_markup` with `copy_text`).

### 2. Fee screen — relabel copy button to "Copy Fee Address"

In `feeScreen`, change only the label of the existing address-copy button from
`"📋 COPY ADDRESS"` to `"📋 COPY FEE ADDRESS"`. The `copy: wallet` field is
unchanged — it still copies `s.fee_wallet`, the exact address shown in
`<code>${wallet}</code>`.

```ts
[{ text: "📋 COPY FEE ADDRESS", copy: wallet }],
[{ text: `📋 COPY ${fee} USDT`, copy: fee }],
[{ text: "🔄 I HAVE PAID — CHECK", data: `feechk:${wd.id}` }],
[{ text: "❌ CANCEL WITHDRAWAL", data: `fcancel:${wd.id}` }],
nav("wallet"),
```

## What is NOT touched

- Trading / settlement / balance / withdrawal processing logic
- The $4 service-fee amount and TRC-20 verification
- Anti-abuse / risk controls
- Database structure
- Deposit and withdrawal business logic
- Any other screen

## Verification

1. Trigger the deposit flow to reach the "AWAITING PAYMENT" screen and confirm
   the "📋 COPY DEPOSIT ADDRESS" button appears and copies the exact address
   shown in the message.
2. Trigger a withdrawal to reach the "SERVICE CHARGE" screen and confirm the
   "📋 COPY FEE ADDRESS" button copies the exact fee wallet shown in
   `<code>...</code>`, and that "$4 USDT" and the rest of the screen are
   unchanged.
3. Confirm both buttons use native `copy_text` (via the existing `kb()` /
   `Button.copy` path) and no browser clipboard API is referenced.
