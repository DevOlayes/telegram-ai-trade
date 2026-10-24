import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminRequest } from "@/lib/nexora/admin-auth-verify.server";
import { db } from "@/lib/nexora/core.server";
import { resolveAudience } from "@/lib/nexora/broadcast.server";

const TYPES: Record<string, { field: "photo" | "video"; mediaType: "photo" | "video"; extensions: string[] }> = {
  "image/jpeg": { field: "photo", mediaType: "photo", extensions: ["jpg", "jpeg"] },
  "image/png": { field: "photo", mediaType: "photo", extensions: ["png"] },
  "image/webp": { field: "photo", mediaType: "photo", extensions: ["webp"] },
  "video/mp4": { field: "video", mediaType: "video", extensions: ["mp4"] },
};
const MAX_UPLOAD_SIZE = 49 * 1024 * 1024;

export const Route = createFileRoute("/api/admin/broadcast-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyAdminRequest())) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let form: FormData;
        try { form = await request.formData(); }
        catch { return Response.json({ error: "Invalid upload form" }, { status: 400 }); }

        const file = form.get("file");
        const body = String(form.get("body") ?? "").trim();
        const audience = String(form.get("audience") ?? "all");
        const action = String(form.get("action") ?? "");
        const actionText = String(form.get("actionText") ?? "OPEN").trim().slice(0, 64);
        const days = Math.max(1, Math.min(365, Number(form.get("days") ?? 7) || 7));

        if (!(file instanceof File)) return Response.json({ error: "Choose a new image or video for this broadcast" }, { status: 400 });
        if (!body || body.length > 4000) return Response.json({ error: "Message must be between 1 and 4000 characters" }, { status: 400 });
        if (file.size < 1 || file.size > MAX_UPLOAD_SIZE) return Response.json({ error: "Telegram video uploads must be smaller than 49 MB" }, { status: 413 });
        const spec = TYPES[file.type];
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!spec || !spec.extensions.includes(extension)) return Response.json({ error: "Only matching JPG, PNG, WebP, or MP4 files are supported" }, { status: 415 });
        if (spec.mediaType === "photo" && file.size > 10 * 1024 * 1024) return Response.json({ error: "Telegram photo uploads must be 10 MB or smaller. For larger media, use an MP4 video." }, { status: 413 });
        if (!["all", "active", "inactive", "depositors", "withdrawers", "abandoned_withdrawals", "has_profit", "never_traded"].includes(audience)) {
          return Response.json({ error: "Unsupported audience" }, { status: 400 });
        }
        if (body.length > 1024) return Response.json({ error: "Telegram limits media captions to 1024 characters. Shorten this message or send it as a text-only broadcast." }, { status: 413 });
        if (action && !["wd", "trade", "deposit", "wallet", "invite", "home"].includes(action)) return Response.json({ error: "Unsupported button action" }, { status: 400 });

        const recipients = await resolveAudience(audience, audience === "inactive" ? { days } : {});
        if (!recipients.length) return Response.json({ error: "There are no recipients in this audience" }, { status: 400 });

        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return Response.json({ error: "Telegram bot is not configured" }, { status: 500 });

        // Telegram stores the uploaded media and returns a reusable file_id. We keep only that
        // identifier in our broadcast record, never the file bytes or a media-library object.
        // The first recipient bootstraps the file_id and receives the actual broadcast once.
        const first = recipients[0]!;
        const telegramForm = new FormData();
        telegramForm.set("chat_id", String(first.telegram_id));
        telegramForm.set(spec.field, file, file.name);
        telegramForm.set("caption", body);
        if (spec.mediaType === "video") telegramForm.set("supports_streaming", "true");
        if (action) telegramForm.set("reply_markup", JSON.stringify({ inline_keyboard: [[{ text: actionText || "OPEN", callback_data: action }]] }));

        let telegramResult: {
          ok: boolean;
          description?: string;
          result?: { photo?: { file_id: string }[]; video?: { file_id: string } };
        };
        try {
          const response = await fetch(`https://api.telegram.org/bot${token}/${spec.mediaType === "video" ? "sendVideo" : "sendPhoto"}`, {
            method: "POST",
            body: telegramForm,
          });
          telegramResult = await response.json() as typeof telegramResult;
        } catch (error) {
          console.error("Telegram media bootstrap failed", error);
          return Response.json({ error: "Could not send the uploaded media to Telegram. No broadcast was queued." }, { status: 502 });
        }

        if (!telegramResult.ok || !telegramResult.result) {
          return Response.json({ error: telegramResult.description ?? "Telegram rejected this media upload. No broadcast was queued." }, { status: 502 });
        }
        const fileId = spec.mediaType === "video"
          ? telegramResult.result.video?.file_id
          : telegramResult.result.photo?.at(-1)?.file_id;
        if (!fileId) return Response.json({ error: "Telegram accepted the message but did not return a reusable media ID." }, { status: 502 });

        const buttons = action ? [{ text: actionText || "OPEN", action }] : [];
        const { data: broadcast, error: broadcastError } = await db().from("broadcasts").insert({
          title: null,
          body,
          media_url: `telegram-file-id:${fileId}`,
          media_type: spec.mediaType,
          buttons,
          audience,
          audience_params: { days: audience === "inactive" ? days : null },
          status: recipients.length > 1 ? "sending" : "done",
          total_count: recipients.length,
          sent_count: 1,
          failed_count: 0,
          created_by: null,
          started_at: new Date().toISOString(),
          finished_at: recipients.length > 1 ? null : new Date().toISOString(),
        }).select("id").single();

        if (broadcastError || !broadcast) {
          console.error("Could not record media broadcast after Telegram accepted the first message", broadcastError);
          return Response.json({ error: "Telegram sent the first message, but the broadcast record could not be created. Check broadcast history before retrying." }, { status: 500 });
        }

        const sentAt = new Date().toISOString();
        for (let i = 0; i < recipients.length; i += 500) {
          const recipientRows = recipients.slice(i, i + 500).map((recipient, offset) => {
            const index = i + offset;
            return {
              broadcast_id: broadcast.id,
              user_id: recipient.user_id,
              telegram_id: recipient.telegram_id,
              status: index === 0 ? "sent" : "pending",
              ...(index === 0 ? { sent_at: sentAt } : {}),
            };
          });
          const { error: recipientsError } = await db().from("broadcast_recipients").upsert(recipientRows, { onConflict: "broadcast_id,user_id" });
          if (recipientsError) {
            console.error("Could not record broadcast recipients", recipientsError);
            return Response.json({ error: "First media message was sent, but recipients could not be queued. Check broadcast history before retrying." }, { status: 500 });
          }
        }

        return Response.json({ id: broadcast.id, total: recipients.length, sent: 1 }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
