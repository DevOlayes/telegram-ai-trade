import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminRequest } from "@/lib/nexora/admin-auth-verify.server";
import { storeBroadcastMedia } from "@/lib/nexora/media.server";

const TYPES: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
};

const MAX_MEDIA_SIZE = 80 * 1024 * 1024;

export const Route = createFileRoute("/api/admin/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyAdminRequest())) return Response.json({ error: "Unauthorized" }, { status: 401 });
        let form: FormData;
        try { form = await request.formData(); } catch { return Response.json({ error: "Invalid upload form" }, { status: 400 }); }
        const file = form.get("file");
        if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload" }, { status: 400 });
        if (file.size < 1 || file.size > MAX_MEDIA_SIZE) return Response.json({ error: "File must be 80 MB or smaller" }, { status: 413 });
        const extensions = TYPES[file.type];
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!extensions || !extensions.includes(extension)) return Response.json({ error: "Only matching JPG, PNG, WebP, or MP4 files are allowed" }, { status: 415 });
        const kind = file.type.startsWith("video/") ? "video" : "image";
        const path = `admin/${kind}/${crypto.randomUUID()}.${extension}`;
        try {
          await storeBroadcastMedia(path, await file.arrayBuffer(), file.type);
          return Response.json({ path }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          console.error("Broadcast media upload failed", error);
          return Response.json({ error: "Could not store media" }, { status: 500 });
        }
      },
    },
  },
});
