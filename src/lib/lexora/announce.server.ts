// LEXORA Announcement bot — a single promotional screen. No trading logic here.
import promo from "@/assets/lexora-promo.mp4.asset.json";

const host = () =>
  process.env["ASSET_HOST"] ??
  "https://project--f7d5b767-7e2d-482f-a147-2287f89d926c-dev.lovable.app";

export const PROMO_VIDEO = () => `${host()}${promo.url}`;
export const TRADING_BOT_URL = () =>
  process.env["TELEGRAM_BOT_USERNAME"]
    ? `https://t.me/${process.env["TELEGRAM_BOT_USERNAME"]}`
    : "https://t.me/nexoraiaxbot";
export const CHANNEL_URL = "https://t.me/lexoracommunity";

const CAPTION =
  "🤖 Welcome to LEXORA\n\n" +
  "📈 AI-powered trading directly on Telegram.\n\n" +
  "🎁 Start with your $25 FREE Welcome Bonus — no deposit required.";

const MARKUP = () => ({
  inline_keyboard: [
    [{ text: "🚀 START TRADING", url: TRADING_BOT_URL() }],
    [{ text: "📢 JOIN OUR CHANNEL", url: CHANNEL_URL }],
  ],
});

async function call(method: string, body: unknown) {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env["ANNOUNCE_BOT_TOKEN"]}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) console.error(`announce ${method} failed:`, json.description);
  return json.ok;
}

type Update = {
  message?: { message_id: number; chat: { id: number }; text?: string };
  callback_query?: { id: string };
};

export async function handleAnnounceUpdate(update: Update) {
  if (update.callback_query) return;
  const chatId = update.message?.chat.id;
  if (!chatId) return;

  // Keep the chat clean: drop the user's /start message, then show the one screen.
  await call("deleteMessage", { chat_id: chatId, message_id: update.message?.message_id });

  // Full 9:16 video (sendVideo, never sendVideoNote which would make it circular).
  await call("sendVideo", {
    chat_id: chatId,
    video: PROMO_VIDEO(),
    caption: CAPTION,
    supports_streaming: true,
    reply_markup: MARKUP(),
  });
}
