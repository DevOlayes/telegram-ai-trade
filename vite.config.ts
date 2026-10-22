// The Lovable wrapper skips Nitro outside its own sandbox unless a Nitro
// configuration is supplied. Pin the Cloudflare preset so CI and local builds
// produce the same Worker bundle and static-asset directory.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const externalizeCloudflareWorkersModule = {
  name: "externalize-cloudflare-workers-module",
  enforce: "pre" as const,
  resolveId(source: string) {
    // This built-in module is provided by the Cloudflare Workers runtime.
    // It must remain an external import in the generated Worker bundle.
    if (source === "cloudflare:workers") {
      return { id: source, external: true };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [externalizeCloudflareWorkersModule],
  nitro: {
    preset: "cloudflare-module",
    plugins: ["./plugins/telegram-scheduled.ts"],
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
    cloudflare: {
      nodeCompat: true,
      // Keep the tracked root wrangler.jsonc as the single source of truth.
      deployConfig: false,
    },
  },
  tanstackStart: {
    // Preserve the existing SSR error wrapper.
    server: { entry: "server" },
    // Avoid the known TanStack Start + Nitro Cloudflare prerender mismatch.
    prerender: { enabled: false },
  },
});
