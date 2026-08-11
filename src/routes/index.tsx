import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXORA — AI-Powered Trading on Telegram" },
      {
        name: "description",
        content:
          "NEXORA is an AI trading bot on Telegram. Claim a $25 welcome bonus, no deposit required, and let the AI pick your trades.",
      },
      { property: "og:title", content: "NEXORA — AI-Powered Trading on Telegram" },
      {
        property: "og:description",
        content: "Claim your $25 welcome bonus and trade with NEXORA AI directly in Telegram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const BOT = import.meta.env["VITE_TELEGRAM_BOT_USERNAME"] ?? "NexoraBot";

function Index() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Nexora</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">
            AI-Powered Trading.
            <br />
            Directly on Telegram.
          </h1>
          <p className="mt-4 text-muted-foreground">
            NEXORA AI decides what trade to take. You decide how much to risk.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Welcome bonus</p>
          <p className="text-3xl font-bold">$25.00</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Promotional bonus. No deposit required. Withdrawals open 72 hours after registration
            from $30 eligible profit.
          </p>
        </div>

        <a
          href={`https://t.me/${BOT}`}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground"
        >
          Open NEXORA in Telegram
        </a>

        <p className="text-xs text-muted-foreground">
          Trading involves risk. Markets can move against a trade.
        </p>
      </div>
    </main>
  );
}
