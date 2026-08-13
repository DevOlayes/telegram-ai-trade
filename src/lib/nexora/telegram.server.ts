// Telegram Bot API transport + clean-chat helpers (edit-in-place, delete temp).
import { db } from "./core.server";

const API = () => `https://api.telegram.org/bot${process.env["TELEGRAM_BOT_TOKEN"]}`;

export type Button = { text: string; data?: string; url?: string };

export function kb(rows: Button[][]) {
  return {
    inline_keyboard: rows.map((row) =>
      row.map((b) =>
        b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data! },
      ),
    ),
  };
}

async function call<T = unknown>(method: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      console.error(`telegram ${method} failed:`, json.description);
      return null;
    }
    return json.result ?? null;
  } catch (e) {
    console.error(`telegram ${method} error`, e);
    return null;
  }
}

export async function sendMessage(
  chatId: number,
  text: string,
  markup?: unknown,
  parseMode?: "HTML",
) {
  return call<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: markup,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  markup?: unknown,
  parseMode?: "HTML",
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: markup,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

export async function sendPhoto(
  chatId: number,
  photo: string,
  caption: string,
  markup?: unknown,
  parseMode?: "HTML",
) {
  return call<{ message_id: number }>("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: parseMode,
    reply_markup: markup,
  });
}

export async function editPhoto(
  chatId: number,
  messageId: number,
  photo: string,
  caption: string,
  markup?: unknown,
  parseMode?: "HTML",
) {
  return call("editMessageMedia", {
    chat_id: chatId,
    message_id: messageId,
    media: { type: "photo", media: photo, caption, parse_mode: parseMode },
    reply_markup: markup,
  });
}

export async function deleteMessage(chatId: number, messageId: number) {
  return call("deleteMessage", { chat_id: chatId, message_id: messageId });
}


export async function answerCallback(id: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text, show_alert: false });
}

export async function setCommands() {
  return call("setMyCommands", {
    commands: [
      { command: "home", description: "🏠 Home" },
      { command: "trade", description: "🚀 Trade" },
      { command: "invite", description: "👥 Invite & Earn" },
      { command: "wallet", description: "💰 Wallet" },
      { command: "history", description: "📜 History" },
      { command: "how", description: "ℹ️ How it works" },
    ],
  });
}

export type ScreenOpts = { photo?: string; parseMode?: "HTML" };

/**
 * The single interactive "screen" message per user. Edited in place so the
 * chat never fills up with repeated menus. When switching between a text and
 * a photo screen the old message is replaced, since Telegram cannot convert
 * one into the other.
 */
export async function renderScreen(
  user: { id: string; telegram_id: number; screen_message_id: number | null },
  text: string,
  markup?: unknown,
  opts: ScreenOpts = {},
) {
  const { photo, parseMode } = opts;
  const caption = photo && text.length > 1000 ? text.slice(0, 997) + "…" : text;

  if (user.screen_message_id) {
    const ok = photo
      ? await editPhoto(user.telegram_id, user.screen_message_id, photo, caption, markup, parseMode)
      : await editMessage(user.telegram_id, user.screen_message_id, text, markup, parseMode);
    if (ok) return user.screen_message_id;
    await deleteMessage(user.telegram_id, user.screen_message_id);
  }
  const sent = photo
    ? await sendPhoto(user.telegram_id, photo, caption, markup, parseMode)
    : await sendMessage(user.telegram_id, text, markup, parseMode);
  const id = sent?.message_id ?? null;
  await db().from("users").update({ screen_message_id: id }).eq("id", user.id);
  user.screen_message_id = id;
  return id;
}


/** Detach the screen so its current content stays permanently in the chat. */
export async function detachScreen(userId: string) {
  await db().from("users").update({ screen_message_id: null }).eq("id", userId);
}
