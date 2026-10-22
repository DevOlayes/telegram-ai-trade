import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(request: Request): Response | null {
  const secret = process.env["NEXORA_TICK_SECRET"];
  if (!secret) {
    console.error("NEXORA_TICK_SECRET is not configured");
    return Response.json({ ok: false, error: "Not configured" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${secret}`)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return null;
}

// Called by a trusted scheduler every minute to advance and settle open trades.
// Both methods require a private secret; never expose the settlement engine publicly.
export const Route = createFileRoute("/api/public/nexora/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = authorized(request);
        if (denied) return denied;
        try {
          const { runTick } = await import("@/lib/nexora/settlement.server");
          const result = await runTick();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("nexora tick error", e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        const denied = authorized(request);
        if (denied) return denied;
        try {
          const { runTick } = await import("@/lib/nexora/settlement.server");
          return Response.json({ ok: true, ...(await runTick()) });
        } catch (e) {
          console.error("nexora tick error", e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
