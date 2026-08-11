import { createFileRoute } from "@tanstack/react-router";

// Called by the scheduler every minute to advance and settle open trades.
export const Route = createFileRoute("/api/public/nexora/tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runTick } = await import("@/lib/nexora/settlement.server");
          const result = await runTick();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("nexora tick error", e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
      GET: async () => {
        const { runTick } = await import("@/lib/nexora/settlement.server");
        return Response.json({ ok: true, ...(await runTick()) });
      },
    },
  },
});
