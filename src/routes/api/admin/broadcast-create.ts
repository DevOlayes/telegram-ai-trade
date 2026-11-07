import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminRequest } from "@/lib/nexora/admin-auth-verify.server";
import { db } from "@/lib/nexora/core.server";
import { resolveAudience } from "@/lib/nexora/broadcast.server";

type Input = {
  body?: unknown; audience?: unknown; days?: unknown; buttons?: unknown;
};

export const Route = createFileRoute("/api/admin/broadcast-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyAdminRequest())) return Response.json({ error: "Unauthorized" }, { status: 401 });
        let input: Input;
        try { input = await request.json() as Input; }
        catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }

        const body = typeof input.body === "string" ? input.body.trim() : "";
        const audience = typeof input.audience === "string" ? input.audience : "";
        const days = Math.max(1, Math.min(365, Number(input.days) || 7));
        const allowed = ["all", "active", "inactive", "depositors", "withdrawers", "abandoned_withdrawals", "has_profit", "never_traded"];
        if (!body || body.length > 4000) return Response.json({ error: "Message must be between 1 and 4000 characters" }, { status: 400 });
        if (!allowed.includes(audience)) return Response.json({ error: "Unsupported audience" }, { status: 400 });
        const buttons = Array.isArray(input.buttons) ? input.buttons.slice(0, 3).filter((b: any) =>
          b && typeof b.text === "string" && b.text.trim() && typeof b.action === "string" &&
          ["wd", "trade", "deposit", "wallet", "invite", "home"].includes(b.action)
        ).map((b: any) => ({ text: b.text.trim().slice(0, 64), action: b.action })) : [];

        try {
          const recipients = await resolveAudience(audience, audience === "inactive" ? { days } : {});
          if (!recipients.length) return Response.json({ error: "There are no recipients in this audience" }, { status: 400 });
          const now = new Date().toISOString();
          const { data: created, error: createError } = await db().from("broadcasts").insert({
            title: null, body, media_url: null, media_type: "text", buttons,
            audience, audience_params: { days: audience === "inactive" ? days : null },
            status: "sending", total_count: recipients.length, sent_count: 0, failed_count: 0,
            created_by: "admin", started_at: now,
          }).select("id").single();
          if (createError || !created?.id) throw new Error(createError?.message ?? "Broadcast record was not created");

          for (let i = 0; i < recipients.length; i += 100) {
            const rows = recipients.slice(i, i + 100).map(r => ({
              broadcast_id: created.id, user_id: r.user_id, telegram_id: r.telegram_id,
              status: "pending",
            }));
            const { error } = await db().from("broadcast_recipients").upsert(rows, { onConflict: "broadcast_id,user_id" });
            if (error) throw new Error(error.message ?? "Recipient queue insert failed");
          }
          const { count, error: countError } = await db().from("broadcast_recipients")
            .select("id", { count: "exact", head: true }).eq("broadcast_id", created.id);
          if (countError || count !== recipients.length) throw new Error(`Queue verification failed: expected ${recipients.length}, recorded ${count ?? 0}`);
          return Response.json({ id: created.id, total: recipients.length, queued: true }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("Text broadcast creation failed", error);
          return Response.json({ error: error instanceof Error ? error.message : "Could not queue broadcast" }, { status: 500 });
        }
      },
    },
  },
});
