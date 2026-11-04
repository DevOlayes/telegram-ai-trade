// The Lovable wrapper skips Nitro outside its own sandbox unless a Nitro
// configuration is supplied. Pin the Cloudflare preset so CI and local builds
// produce the same Worker bundle and static-asset directory.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Dev-only shim: the sandbox preview cannot load Cloudflare's built-in
// "cloudflare:workers" module, so we provide `env` backed by process.env plus
// an in-memory MEDIA KV stub. The production Worker build keeps the real
// binding because the plugin only applies while serving in dev.
const cloudflareWorkersDevShim = {
  name: "cloudflare-workers-dev-shim",
  enforce: "pre" as const,
  apply: "serve" as const,
  resolveId(source: string) {
    if (source === "cloudflare:workers") return "\0virtual:cloudflare-workers-shim";
    return null;
  },
  load(id: string) {
    if (id !== "\0virtual:cloudflare-workers-shim") return null;
    return [
      "const kvStore = new Map();",
      "const MEDIA = {",
      "  async get(key) { return kvStore.has(key) ? kvStore.get(key) : null; },",
      "  async put(key, value, options) { kvStore.set(key, String(value)); },",
      "  async delete(key) { kvStore.delete(key); },",
      "};",
      "export const env = new Proxy({ MEDIA }, {",
      "  get(target, prop) { if (prop in target) return target[prop]; return process.env[String(prop)]; },",
      "});",
      "export default env;",
    ].join("\n");
  },
};

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
  plugins: [cloudflareWorkersDevShim, externalizeCloudflareWorkersModule],
  nitro: {
    preset: "cloudflare-module",
    // Spread bypasses the wrapper's narrower typing; the scheduled Telegram
    // plugin is still passed through to Nitro at build time.
    ...({ plugins: ["./plugins/telegram-scheduled.ts"] } as object),
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
