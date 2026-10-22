import { getRequestHeader } from "@tanstack/react-start/server";

const COOKIE = "__Host-lexora-admin";
const text = new TextEncoder();
function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function equal(a: string, b: string) {
  const left = text.encode(a);
  const right = text.encode(b);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}
async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, text.encode(payload))));
}
export async function verifyAdminRequest() {
  const username = process.env["ADMIN_USERNAME"];
  const secret = process.env["SESSION_SECRET"];
  const passwordHash = process.env["ADMIN_PASSWORD_HASH"];
  if (!username || !secret || secret.length < 32 || !passwordHash) return false;
  const cookie = getRequestHeader("cookie") ?? "";
  let token: string | null = null;
  for (const part of cookie.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === COOKIE) token = part.slice(i + 1);
  }
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra || !equal(await sign(payload, secret), signature)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { username?: string; expiresAt?: number };
    return data.username === username && Number.isSafeInteger(data.expiresAt) && (data.expiresAt ?? 0) > Date.now();
  } catch {
    return false;
  }
}
