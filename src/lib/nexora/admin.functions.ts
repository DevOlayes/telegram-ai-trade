import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/lib/nexora/admin-auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { adminUser?: string }) {
  if (!context.adminUser) throw new Error("Forbidden");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { loginAdmin } = await import("@/lib/nexora/admin-login.server");
    return loginAdmin(data.username, data.password);
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutAdmin } = await import("@/lib/nexora/admin-login.server");
  return logoutAdmin();
});
