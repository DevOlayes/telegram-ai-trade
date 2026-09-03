// LEXORA broadcast system: audience resolution + throttled, resumable delivery.
// Sends stand-alone messages; never touches a user's pinned screen message.
import { db } from "./core.server";
import recoveryVideo from "@/assets/lexora-withdraw-recovery.mp4.asset.json";

const host = () =>
  process.env["ASSET_HOST"] ??
  "https://project--f7d5b767-7e2d-482f-a147-2287f89d926c-dev.lovable.app";

export const MEDIA_LIBRARY = [
  { id: "none", label: "No media", url: "", type: "none" as const },
  {
    id: "withdraw-recovery",
    label: "Withdrawal recovery video",
    url: `${host()}${recoveryVideo.url}`,
    type: "video" as const,
  },
];

export const ACTION_BUTTONS: Record<string, string> = {
  wd: "💸 WITHDRAW NOW",
  trade: "🚀 START TRADING",
  deposit: "💳 DEPOSIT",
  wallet: "💰 WALLET",
  invite: "👥 INVITE & EARN",
  home: "🏠 OPEN MENU",
};

export type BroadcastButton = { text: string; action?: string; url?: string };

export const AUDIENCES = [
  { id: "all", label: "All users" },
  { id: "abandoned_withdrawals", label: "Abandoned withdrawals" },
  { id: "has_profit", label: "Has withdrawable profit" },
  { id: "never_traded", label: "Never traded" },
  { id: "inactive", label: "Inactive (no trade in N days)" },
] as const;

export type AudienceId = (typeof AUDIENCES)[number]["id"];

type Recipient = { user_id: string; telegram_id: number };

async function activeUsers(): Promise<Recipient[]> {
  const { data } = await db()
    .from("users")
    .select("id,telegram_id")
    .neq("status", "blocked")
    .limit(20000);
  return (data ?? []).map((u) => ({ user_id: u.id as string, telegram_id: Number(u.telegram_id) }));
}

/** Resolve the list of telegram recipients for an audience. */
export async function resolveAudience(
  audience: AudienceId | string,
  params: { days?: number } = {},
): Promise<Recipient[]> {
  const base = await activeUsers();
  const byId = new Map(base.map((r) => [r.user_id, r]));

  if (audience === "all") return base;

  if (audience === "abandoned_withdrawals") {
    const { abandonedWithdrawals } = await import("./payments.server");
    const rows = await abandonedWithdrawals(90);
    return rows
      .map((r) => byId.get(r.user_id as string))
      .filter((r): r is Recipient => Boolean(r));
  }

  if (audience === "has_profit") {
    const { data } = await db().from("balances").select("user_id,profit").gt("profit", 0);
    return (data ?? [])
      .map((b) => byId.get(b.user_id as string))
      .filter((r): r is Recipient => Boolean(r));
  }

  if (audience === "never_traded") {
    const { data } = await db().from("trades").select("user_id").limit(50000);
    const traded = new Set((data ?? []).map((t) => t.user_id as string));
    return base.filter((r) => !traded.has(r.user_id));
  }

  if (audience === "inactive") {
    const days = params.days && params.days > 0 ? params.days : 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await db().from("trades").select("user_id").gte("opened_at", since);
    const recent = new Set((data ?? []).map((t) => t.user_id as string));
    return base.filter((r) => !recent.has(r.user_id));
  }

  return [];
}

export type BroadcastInput = {
  title?: string;
  body: string;
  mediaId?: string;
  buttons?: BroadcastButton[];
  audience: string;
  days?: number;
  createdBy?: string;
};

/** Create a broadcast and materialise its recipient list (idempotent per user). */
export async function createBroadcast(input: BroadcastInput) {
  const media = MEDIA_LIBRARY.find((m) => m.id === (input.mediaId ?? "none")) ?? MEDIA_LIBRARY[0]!;
  const recipients = await resolveAudience(input.audience, { days: input.days });

  const { data: bc, error } = await db()
    .from("broadcasts")
    .insert({
      title: input.title ?? null,
      body: input.body,
      media_url: media.url || null,
      media_type: media.type,
      buttons: (input.buttons ?? []) as object,
      audience: input.audience,
      audience_params: { days: input.days ?? null } as object,
      status: recipients.length ? "sending" : "done",
      total_count: recipients.length,
      created_by: input.createdBy ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !bc) throw new Error(error?.message ?? "Could not create broadcast");

  for (let i = 0; i < recipients.length; i += 500) {
    await db()
      .from("broadcast_recipients")
      .upsert(
        recipients.slice(i, i + 500).map((r) => ({
          broadcast_id: bc.id,
          user_id: r.user_id,
          telegram_id: r.telegram_id,
        })),
        { onConflict: "broadcast_id,user_id" },
      );
  }
  return { id: bc.id as string, total: recipients.length };
}

function markup(buttons: BroadcastButton[]) {
  const rows = buttons
    .filter((b) => b.text && (b.url || b.action))
    .map((b) => [b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.action! }]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

type SendResult = { ok: true } | { ok: false; error: string; blocked: boolean; retryAfter?: number };

async function sendOne(
  chatId: number,
  bc: { body: string; media_url: string | null; media_type: string; buttons: BroadcastButton[] },
): Promise<SendResult> {
  const reply_markup = markup(bc.buttons ?? []);
  const method =
    bc.media_type === "video" ? "sendVideo" : bc.media_type === "photo" ? "sendPhoto" : "sendMessage";
  const payload: Record<string, unknown> =
    method === "sendVideo"
      ? { chat_id: chatId, video: bc.media_url, caption: bc.body, supports_streaming: true, reply_markup }
      : method === "sendPhoto"
        ? { chat_id: chatId, photo: bc.media_url, caption: bc.body, reply_markup }
        : { chat_id: chatId, text: bc.body, reply_markup, disable_web_page_preview: true };

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env["TELEGRAM_BOT_TOKEN"]}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json()) as {
      ok: boolean;
      description?: string;
      error_code?: number;
      parameters?: { retry_after?: number };
    };
    if (json.ok) return { ok: true };
    return {
      ok: false,
      error: json.description ?? "unknown",
      blocked: json.error_code === 403 || json.error_code === 400,
      ...(json.parameters?.retry_after ? { retryAfter: json.parameters.retry_after } : {}),
    };
  } catch (e) {
    return { ok: false, error: String(e), blocked: false };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deliver up to `limit` pending recipients across active broadcasts.
 * Called from the per-minute tick so long sends survive request timeouts.
 */
export async function drainBroadcasts(limit = 200) {
  const { data: active } = await db()
    .from("broadcasts")
    .select("id,body,media_url,media_type,buttons")
    .eq("status", "sending")
    .order("created_at")
    .limit(3);
  if (!active?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  let budget = limit;

  for (const bc of active) {
    if (budget <= 0) break;
    const { data: pending } = await db()
      .from("broadcast_recipients")
      .select("id,telegram_id")
      .eq("broadcast_id", bc.id)
      .eq("status", "pending")
      .limit(budget);

    for (const r of pending ?? []) {
      budget--;
      const result = await sendOne(Number(r.telegram_id), bc as never);
      if (!result.ok && result.retryAfter) {
        await sleep(Math.min(result.retryAfter, 10) * 1000);
        const retry = await sendOne(Number(r.telegram_id), bc as never);
        if (retry.ok) {
          await db()
            .from("broadcast_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", r.id);
          sent++;
          continue;
        }
      }
      if (result.ok) {
        await db()
          .from("broadcast_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", r.id);
        sent++;
      } else {
        await db()
          .from("broadcast_recipients")
          .update({ status: result.blocked ? "blocked" : "failed", error: result.error })
          .eq("id", r.id);
        failed++;
      }
      await sleep(40); // ~25 messages/second, within Telegram's broadcast limit
    }

    const { count: remaining } = await db()
      .from("broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", bc.id)
      .eq("status", "pending");
    const { count: sentCount } = await db()
      .from("broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", bc.id)
      .eq("status", "sent");
    const { count: failedCount } = await db()
      .from("broadcast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", bc.id)
      .in("status", ["failed", "blocked"]);

    await db()
      .from("broadcasts")
      .update({
        sent_count: sentCount ?? 0,
        failed_count: failedCount ?? 0,
        status: remaining ? "sending" : "done",
        finished_at: remaining ? null : new Date().toISOString(),
      })
      .eq("id", bc.id);
  }

  return { sent, failed };
}
