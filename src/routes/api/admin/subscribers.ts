import { createFileRoute } from "@tanstack/react-router";
import { verifyAdminRequest } from "@/lib/nexora/admin-auth-verify.server";

type Subscriber = {
  telegram_id: number | string | null;
  username: string | null;
  first_name: string | null;
  status?: string | null;
};

function csvCell(value: unknown) {
  let cell = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

export const Route = createFileRoute("/api/admin/subscribers")({
  server: {
    handlers: {
      GET: async () => {
        if (!(await verifyAdminRequest())) {
          return new Response("Unauthorized", {
            status: 401,
            headers: { "Cache-Control": "private, no-store" },
          });
        }

        try {
          const { db } = await import("@/lib/nexora/core.server");
          const subscribers: Subscriber[] = [];
          const pageSize = 1000;

          for (let offset = 0; ; offset += pageSize) {
            const { data, error } = await db()
              .from("users")
              .select("telegram_id,username,first_name,status")
              .order("id")
              .range(offset, offset + pageSize - 1);

            if (error) throw new Error("Could not load subscriber records");
            const page = (data ?? []) as unknown as Subscriber[];
            subscribers.push(...page.filter((user) => {
              const telegramId = Number(user.telegram_id);
              return user.status !== "blocked" && Number.isSafeInteger(telegramId) && telegramId > 0;
            }));
            if (page.length < pageSize) break;
          }

          const rows = [
            ["telegram_id", "username", "first_name"],
            ...subscribers.map((user) => [
              String(user.telegram_id),
              user.username ?? "",
              user.first_name ?? "",
            ]),
          ];
          const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

          return new Response(csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="lexora-subscribers.csv"',
              "Cache-Control": "private, no-store",
            },
          });
        } catch (error) {
          console.error("Subscriber export failed", error);
          return Response.json(
            { error: "Could not create the subscriber export. Please try again." },
            { status: 500, headers: { "Cache-Control": "private, no-store" } },
          );
        }
      },
    },
  },
});