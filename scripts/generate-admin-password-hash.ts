// Generate an ADMIN_PASSWORD_HASH compatible with Cloudflare Workers.
// Run: ADMIN_PASSWORD='your-new-admin-password' bun run admin:hash
// The password is read from the environment and is never written to the repository.
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("Set ADMIN_PASSWORD in the environment before running this script.");
  process.exit(1);
}
if (password.length < 14) {
  console.error("Choose a password with at least 14 characters.");
  process.exit(1);
}

const iterations = 100000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const derived = new Uint8Array(
  await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  ),
);
const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};
console.log(`pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(derived)}`);
