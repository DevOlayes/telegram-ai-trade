import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE = "__Host-lexora-admin";
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
  for (let i = 0; i < Math.max(left.length, right.length); i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}
function config() {
  const username = process.env["ADMIN_USERNAME"];
  const secret = process.env["SESSION_SECRET"];
  if (!username || !process.env["ADMIN_PASSWORD_HASH"] || !secret || secret.length < 32) return null;
  return { username, secret };
}
async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, text.encode(payload))));
}
async function sessionUsername() {
  const cfg = config();
  const cookie = getRequestHeader("cookie") ?? "";
  if (!cfg) return null;
  let token: string | null = null;
  for (const part of cookie.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === COOKIE) token = part.slice(i + 1);
  }
  if (!token) return null;
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
export const requireAdminAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const username = await sessionUsername();
  if (!username) throw new Error("Unauthorized");
  setResponseHeader("Cache-Control", "no-store");
  return next({ context: { userId: username, adminUser: username } });
});
export async function verifyAdminRequest() {
  return Boolean(await sessionUsername());
}
