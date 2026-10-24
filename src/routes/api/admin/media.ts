import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminRequest } from "@/lib/nexora/admin-auth-verify.server";

export const Route = createFileRoute("/api/admin/media")({
  server: {
    handlers: {
      POST: async () => {
        if (!(await verifyAdminRequest())) return Response.json({ error: "Unauthorized" }, { status: 401 });
        return Response.json(
          { error: "Permanent media uploads are disabled. Upload a fresh file from the Broadcast composer instead." },
          { status: 410, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
