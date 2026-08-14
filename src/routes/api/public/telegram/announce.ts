import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

export const Route = createFileRoute("/api/public/telegram/announce")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["ANNOUNCE_BOT_TOKEN"];
        if (!token) return new Response("Not configured", { status: 500 });
        const expected = createHash("sha256")
          .update(`telegram-announce:${token}`)
          .digest("base64url");
        if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token") ?? "", expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: unknown;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const { handleAnnounceUpdate } = await import("@/lib/lexora/announce.server");
          await handleAnnounceUpdate(update as never);
        } catch (e) {
          console.error("lexora announce webhook error", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
