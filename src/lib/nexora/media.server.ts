import { env } from "cloudflare:workers";

type MediaMeta = { contentType?: string; createdAt?: string };
type KVLike = {
  put(key: string, value: ArrayBuffer | ArrayBufferView | string, options?: { metadata?: MediaMeta; expirationTtl?: number }): Promise<void>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  getWithMetadata(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: MediaMeta | null }>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; metadata?: MediaMeta }[]; list_complete: boolean; cursor?: string }>;
  delete(key: string): Promise<void>;
};
function bucket() {
  const kv = (env as unknown as { MEDIA?: KVLike }).MEDIA;
  if (!kv) throw new Error("Cloudflare MEDIA KV binding is not configured");
  return kv;
}
function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function equal(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}
async function signature(path: string, expires: number) {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const data = new TextEncoder().encode(`${path}\n${expires}`);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, data)));
}
export async function storeBroadcastMedia(path: string, data: ArrayBuffer, contentType: string) {
  await bucket().put(path, data, { metadata: { contentType, createdAt: new Date().toISOString() } });
}
export async function hasBroadcastMedia(path: string) {
  const value = await bucket().get(path, "arrayBuffer");
  return value !== null;
}
export async function listBroadcastMediaKeys(prefix: string) {
  const result = await bucket().list({ prefix, limit: 100 });
  return result.keys.map((key) => ({ path: key.name, name: key.name.slice(prefix.length), createdAt: key.metadata?.createdAt ?? null, contentType: key.metadata?.contentType ?? "application/octet-stream" }));
}
export async function readBroadcastMedia(path: string) {
  return bucket().getWithMetadata(path, "arrayBuffer");
}
export async function signedBroadcastMediaUrl(path: string, ttlSeconds = 3600) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await signature(path, expires);
  const base = (process.env["APP_URL"] ?? "").replace(/\/$/, "");
  if (!base || !base.startsWith("https://")) throw new Error("APP_URL must be a public HTTPS Worker URL");
  return `${base}/api/public/media?path=${encodeURIComponent(path)}&exp=${expires}&sig=${encodeURIComponent(sig)}`;
}
export async function verifyBroadcastMediaSignature(path: string, expires: number, sig: string) {
  if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 7200) return false;
  return equal(await signature(path, expires), sig);
}
