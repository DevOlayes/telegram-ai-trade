import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Get $25 on NEXORA — AI Trading on Telegram" },
      {
        name: "description",
        content:
          "Try NEXORA's AI-powered trading on Telegram. No deposit required — claim your $25 welcome bonus.",
      },
      { property: "og:title", content: "🎁 Get $25 on NEXORA" },
      {
        property: "og:description",
        content: "AI-powered trading on Telegram. No deposit required. Claim your $25 bonus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ c: String(s["c"] ?? "") }),
  component: SharePage,
});

const BOT = import.meta.env["VITE_TELEGRAM_BOT_USERNAME"] ?? "nexoraiaxbot";

const MESSAGE = `🎁 GET $25 ON NEXORA

Try NEXORA's AI-powered trading experience directly on Telegram.

No deposit required.

Claim your $25 welcome bonus 👇`;

function SharePage() {
  const { c } = Route.useSearch();
  const link = `https://t.me/${BOT}?start=${c}`;
  const full = `${MESSAGE}\n${link}`;
  const [copied, setCopied] = useState(false);

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "NEXORA", text: MESSAGE, url: link });
        return;
      } catch {
        /* user cancelled */
      }
    }
    void copy();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const targets = [
    { label: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(full)}` },
    {
      label: "Telegram",
      url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(MESSAGE)}`,
    },
    { label: "X", url: `https://x.com/intent/tweet?text=${encodeURIComponent(full)}` },
    {
      label: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    },
    { label: "SMS", url: `sms:?&body=${encodeURIComponent(full)}` },
    {
      label: "Email",
      url: `mailto:?subject=${encodeURIComponent("Get $25 on NEXORA")}&body=${encodeURIComponent(full)}`,
    },
  ];

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="text-3xl font-bold">🎁 Share NEXORA & earn</h1>
        <p className="text-sm text-muted-foreground">
          Your friend gets $25. You earn $2 per qualified active referral.
        </p>

        <div className="whitespace-pre-line rounded-2xl border border-border bg-card p-5 text-sm">
          {MESSAGE}
          <div className="mt-3 break-all font-medium text-primary">{link}</div>
        </div>

        <button
          onClick={nativeShare}
          className="rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground"
        >
          📤 Share
        </button>
        <button onClick={copy} className="rounded-xl border border-border px-6 py-4 font-semibold">
          {copied ? "✅ Copied" : "🔗 Copy link"}
        </button>

        <div className="grid grid-cols-3 gap-2">
          {targets.map((t) => (
            <a
              key={t.label}
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border px-3 py-3 text-center text-sm"
            >
              {t.label}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
