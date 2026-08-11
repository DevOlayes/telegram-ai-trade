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

export async function sendMessage(chatId: number, text: string, markup?: unknown) {
  return call<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: markup,
    disable_web_page_preview: true,
  });
}

export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  markup?: unknown,
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: markup,
    disable_web_page_preview: true,
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

/**
 * The single interactive "screen" message per user. Edited in place so the
 * chat never fills up with repeated menus.
 */
export async function renderScreen(
  user: { id: string; telegram_id: number; screen_message_id: number | null },
  text: string,
  markup?: unknown,
) {
  if (user.screen_message_id) {
    const ok = await editMessage(user.telegram_id, user.screen_message_id, text, markup);
    if (ok) return user.screen_message_id;
  }
  const sent = await sendMessage(user.telegram_id, text, markup);
  const id = sent?.message_id ?? null;
  await db().from("users").update({ screen_message_id: id }).eq("id", user.id);
  user.screen_message_id = id;
  return id;
}

/** Detach the screen so its current content stays permanently in the chat. */
export async function detachScreen(userId: string) {
  await db().from("users").update({ screen_message_id: null }).eq("id", userId);
}
