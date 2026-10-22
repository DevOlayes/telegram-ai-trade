import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { adminLogin } from "@/lib/nexora/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "LEXORA Admin Sign In" },
      { name: "description", content: "Sign in to the LEXORA admin panel." },
      { property: "og:title", content: "LEXORA Admin Sign In" },
      { property: "og:description", content: "Sign in to the LEXORA admin panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await adminLogin({ data: { username, password } });
      setBusy(false);
      void navigate({ to: "/admin" });
    } catch (error) {
      setBusy(false);
      setMsg(error instanceof Error ? error.message : "Sign-in failed.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">LEXORA Admin</h1>
        <input
          className="w-full rounded-lg border border-border bg-card px-4 py-3"
          type="text"
          autoComplete="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-border bg-card px-4 py-3"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </form>
    </main>
  );
}
