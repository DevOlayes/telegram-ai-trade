import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "NEXORA Admin Sign In" },
      { name: "description", content: "Sign in to the NEXORA admin panel." },
      { property: "og:title", content: "NEXORA Admin Sign In" },
      { property: "og:description", content: "Sign in to the NEXORA admin panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin + "/admin" },
          });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Check your email to confirm your account.");
    void navigate({ to: "/admin" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">NEXORA Admin</h1>
        <input
          className="w-full rounded-lg border border-border bg-card px-4 py-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-border bg-card px-4 py-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          {mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="w-full text-sm text-muted-foreground"
        >
          {mode === "in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </form>
    </main>
  );
}
