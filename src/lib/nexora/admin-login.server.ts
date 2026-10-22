import { getRequest, setCookie, deleteCookie, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE = "__Host-lexora-admin";
const SESSION_SECONDS = 60 * 60 * 12;
const text = new TextEncoder();
function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function constantTimeEqual(a: string, b: string) {
  const left = text.encode(a);
  const right = text.encode(b);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}
function config() {
  const username = process.env["ADMIN_USERNAME"];
  const passwordHash = process.env["ADMIN_PASSWORD_HASH"];
  const secret = process.env["SESSION_SECRET"];
  if (!username || !passwordHash || !secret || secret.length < 32) return null;
  return { username, passwordHash, secret };
}
async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, iterationText, saltText, expected] = encodedHash.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !saltText || !expected) return false;
  const normalized = saltText.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  const salt = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", text.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return constantTimeEqual(toBase64Url(new Uint8Array(bits)), expected);
}
async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, text.encode(payload))));
}
export async function loginAdmin(username: string, password: string) {
  const cfg = config();
  if (!cfg) throw new Error("Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and SESSION_SECRET in Cloudflare.");
  const request = getRequest();
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const kv = (await import("cloudflare:workers")).env as unknown as { MEDIA?: { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>; delete(key: string): Promise<void> } };
  const rateKey = `auth:login:${ip}`;
  let attempts = 0;
  try { attempts = Number(await kv.MEDIA?.get(rateKey) ?? 0); } catch { /* best effort */ }
  if (attempts >= 8) throw new Error("Too many sign-in attempts. Try again in 15 minutes.");
  const passwordValid = await verifyPassword(password, cfg.passwordHash);
  const valid = constantTimeEqual(username, cfg.username) && passwordValid;
  if (!valid) {
    try { await kv.MEDIA?.put(rateKey, String(attempts + 1), { expirationTtl: 900 }); } catch { /* best effort */ }
    throw new Error("Invalid username or password.");
  }
  try { await kv.MEDIA?.delete(rateKey); } catch { /* best effort */ }
  const payload = toBase64Url(text.encode(JSON.stringify({ username: cfg.username, expiresAt: Date.now() + SESSION_SECONDS * 1000, nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(16))) })));
  setCookie(COOKIE, `${payload}.${await sign(payload, cfg.secret)}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  setResponseHeader("Cache-Control", "no-store");
  return { ok: true };
}
export async function logoutAdmin() {
  deleteCookie(COOKIE, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  setResponseHeader("Cache-Control", "no-store");
  return { ok: true };
}
