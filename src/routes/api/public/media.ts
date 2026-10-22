import { createFileRoute } from "@tanstack/react-router";
import { readBroadcastMedia, verifyBroadcastMediaSignature } from "@/lib/nexora/media.server";

export const Route = createFileRoute("/api/public/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") ?? "";
        const exp = Number(url.searchParams.get("exp"));
        const sig = url.searchParams.get("sig") ?? "";
        if (!/^admin\/(image|video)\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|mp4)$/.test(path) ||
            !(await verifyBroadcastMediaSignature(path, exp, sig))) {
          return new Response("Not found", { status: 404 });
        }
        const media = await readBroadcastMedia(path);
        if (!media.value) return new Response("Not found", { status: 404 });
        return new Response(media.value, {
          headers: {
            "Content-Type": media.metadata?.contentType ?? "application/octet-stream",
            "Content-Length": String(media.value.byteLength),
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
          },
        });
      },
    },
  },
});
