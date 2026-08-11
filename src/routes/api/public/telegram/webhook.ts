import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        let update: unknown;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const { handleUpdate } = await import("@/lib/nexora/bot.server");
          await handleUpdate(update as never);
        } catch (e) {
          console.error("nexora webhook error", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
