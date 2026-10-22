import { createMiddleware } from "@tanstack/react-start";
import { getRequest, getRequestHeader, setCookie, deleteCookie, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE = "__Host-lexora-admin";
const SESSION_SECONDS = 60 * 60 * 12;
const text = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function constantTimeEqual(a: string, b: string) {
  const left = text.encode(a);
  const right = text.encode(b);
  let mismatch = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}
function config() {
  const username = process.env["ADMIN_USERNAME"];
  const password = process.env["ADMIN_PASSWORD"];
  const secret = process.env["SESSION_SECRET"];
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
}
async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, text.encode(payload))));
}
function readCookie() {
  const cookie = getRequestHeader("cookie") ?? "";
  for (const part of cookie.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === COOKIE) return part.slice(i + 1);
  }
  return null;
}
async function sessionUsername() {
  const cfg = config();
  const token = readCookie();
  if (!cfg || !token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  if (!constantTimeEqual(await sign(payload, cfg.secret), signature)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { username?: string; expiresAt?: number };
    if (data.username !== cfg.username || !Number.isSafeInteger(data.expiresAt) || (data.expiresAt ?? 0) <= Date.now()) return null;
    return data.username;
  } catch {
    return null;
  }
}
export async function loginAdmin(username: string, password: string) {
  const cfg = config();
  if (!cfg) throw new Error("Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET in Cloudflare.");
  const request = getRequest();
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const kv = (await import("cloudflare:workers")).env as unknown as { MEDIA?: { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>; delete(key: string): Promise<void> } };
  const rateKey = `auth:login:${ip}`;
  let attempts = 0;
  try { attempts = Number(await kv.MEDIA?.get(rateKey) ?? 0); } catch { /* best effort */ }
  if (attempts >= 8) throw new Error("Too many sign-in attempts. Try again in 15 minutes.");
  const valid = constantTimeEqual(username, cfg.username) && constantTimeEqual(password, cfg.password);
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
export async function getAdminSessionStatus() {
  setResponseHeader("Cache-Control", "no-store");
  return { authenticated: Boolean(await sessionUsername()) };
}
export const requireAdminAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const username = await sessionUsername();
  if (!username) throw new Error("Unauthorized");
  setResponseHeader("Cache-Control", "no-store");
  return next({ context: { userId: username, adminUser: username } });
});
export async function verifyAdminRequest() {
  return Boolean(await sessionUsername());
}
