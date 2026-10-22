// The Lovable wrapper skips Nitro outside its own sandbox unless a Nitro
// configuration is supplied. Pin the Cloudflare preset so CI and local builds
// produce the same Worker bundle and static-asset directory.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Cloudflare's built-in Workers modules are resolved by the Workers runtime,
  // not by Vite's Node-based SSR bundling step. Keep the import external so the
  // generated Worker can resolve it at runtime.
  build: {
    rolldownOptions: {
      external: ["cloudflare:workers"],
    },
  },
  nitro: {
    preset: "cloudflare-module",
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
