import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  Check,
  Clock,
  Coins,
  Eye,
  EyeOff,
  Landmark,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
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
  { id: "users", label: "Users", icon: Users },
  { id: "trades", label: "Trades", icon: Activity },
  { id: "deposits", label: "Deposits", icon: Landmark },
  { id: "withdrawals", label: "Withdrawals", icon: Wallet },
  { id: "referrals", label: "Referrals", icon: TrendingUp },
  { id: "broadcast", label: "Broadcast", icon: Megaphone },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type Tab = (typeof TABS)[number]["id"];

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const qc = useQueryClient();
  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    retry: false,
    refetchInterval: 30000,
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

  const users = useMemo(() => {
    const rows = data?.users ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        String(u.telegram_id).includes(q) ||
        (u.username ?? "").toLowerCase().includes(q) ||
        (u.referral_code ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  const balanceOf = (id: string) => data?.balances.find((b) => b.user_id === id);
  const userLabel = (id: string) => {
    const u = data?.users.find((x) => x.id === id);
    return u ? (u.username ? `@${u.username}` : String(u.telegram_id)) : id.slice(0, 8);
  };

  if (isLoading)
    return (
      <Shell tab={tab} onTab={setTab} topBar={null}>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Loading admin data…
        </div>
      </Shell>
    );
  if (error)
    return (
      <Shell tab={tab} onTab={setTab} topBar={null}>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-sm text-muted-foreground">
            You need an admin account to view this panel.
          </p>
          <Link
            to="/auth"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </Shell>
    );

  const s = data!.stats;

  const topBar = (
    <>
      {tab === "users" && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search telegram ID, username, referral code…"
            className="w-72 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
      )}
      <span className="ml-auto text-xs text-muted-foreground">
        Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
      </span>
      <button
        onClick={refresh}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </>
  );

  return (
    <Shell tab={tab} onTab={setTab} topBar={topBar}>
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Users (24h)" value={s.users24h} hint="New today" accent />
        <Stat icon={<Users className="h-4 w-4" />} label="Total users" value={s.totalUsers} hint={`${s.users7d} in 7 days`} />
        <Stat icon={<Activity className="h-4 w-4" />} label="Active trades" value={s.activeTrades} hint="Running now" />
        <Stat icon={<Clock className="h-4 w-4" />} label="Pending withdrawals" value={s.pendingWithdrawals} hint="Awaiting action" warn={s.pendingWithdrawals > 0} />
        <Stat icon={<Coins className="h-4 w-4" />} label="Total balance" value={money(s.totalBalance)} hint="Across all users" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Total profit" value={money(s.totalProfit)} hint="Withdrawable pool" />
        <Stat icon={<ArrowLeftRight className="h-4 w-4" />} label="Recent deposits" value={data!.deposits.length} hint="Last 100 records" />
        <Stat icon={<Megaphone className="h-4 w-4" />} label="Referrals" value={data!.referrals.length} hint="Recent records" />
      </section>

      {tab === "users" && (
        <Table head={["Telegram", "Username", "Registered", "Bonus", "Balance", "Profit", "Refs", "Status", ""]}>
          {users.map((u) => {
            const b = balanceOf(u.id);
            const refs = data!.referrals.filter((r) => r.referrer_id === u.id).length;
            return (
              <tr key={u.id} className="border-t border-border transition-colors hover:bg-accent/40">
                <Td className="tabular-nums">{u.telegram_id}</Td>
                <Td>{u.username ? `@${u.username}` : "—"}</Td>
                <Td>{new Date(u.created_at).toLocaleDateString()}</Td>
                <Td>{u.bonus_claimed ? <Badge tone="ok">Claimed</Badge> : "—"}</Td>
                <Td className="tabular-nums">{money(b?.balance)}</Td>
                <Td className="tabular-nums">{money(b?.profit)}</Td>
                <Td className="tabular-nums">{refs}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={u.status === "blocked" ? "bad" : "ok"}>{u.status}</Badge>
                    {u.flagged_reason ? <Badge tone="warn">{u.flagged_reason}</Badge> : null}
                  </div>
                </Td>
                <Td>
                  <ActionButton
                    danger={u.status !== "blocked"}
                    onClick={() =>
                      userMutation.mutate({
                        id: u.id,
                        status: u.status === "blocked" ? "active" : "blocked",
                      })
                    }
                  >
                    {u.status === "blocked" ? "Unblock" : "Block"}
                  </ActionButton>
                </Td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr className="border-t border-border">
              <Td className="py-8 text-center text-muted-foreground" >No users match your search.</Td>
            </tr>
          )}
        </Table>
      )}

      {tab === "trades" && (
        <Table head={["User", "Pair", "Dir", "Amount", "Entry", "TP", "SL", "Dur", "Result", "P/L", "When"]}>
          {data!.trades.map((t) => (
            <tr key={t.id} className="border-t border-border transition-colors hover:bg-accent/40">
              <Td>{userLabel(t.user_id)}</Td>
              <Td className="font-medium">{t.symbol}</Td>
              <Td>
                <Badge tone={t.direction === "LONG" ? "ok" : "bad"}>{t.direction}</Badge>
              </Td>
              <Td className="tabular-nums">{money(t.amount)}</Td>
              <Td className="tabular-nums">{t.entry_price}</Td>
              <Td className="tabular-nums">{t.take_profit}</Td>
              <Td className="tabular-nums">{t.stop_loss}</Td>
              <Td>{t.duration_minutes}m</Td>
              <Td>
                {t.result ? (
                  <Badge tone={t.result === "win" ? "ok" : "bad"}>{t.result}</Badge>
                ) : (
                  <Badge tone="muted">{t.status}</Badge>
                )}
              </Td>
              <Td className="tabular-nums">{t.pnl == null ? "—" : money(t.pnl)}</Td>
              <Td className="whitespace-nowrap">{new Date(t.opened_at).toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "withdrawals" && (
        <Table head={["User", "Amount", "Wallet", "Network", "Fee", "Fee status", "Status", "When", ""]}>
          {data!.withdrawals.map((w) => (
            <tr key={w.id} className="border-t border-border transition-colors hover:bg-accent/40">
              <Td>{userLabel(w.user_id)}</Td>
              <Td className="tabular-nums font-medium">{money(w.amount)}</Td>
              <Td className="max-w-[160px] truncate font-mono text-xs">{w.wallet_address}</Td>
              <Td>{w.network}</Td>
              <Td className="tabular-nums">{Number(w.service_fee_amount ?? 0) > 0 ? money(w.service_fee_amount) : "—"}</Td>
              <Td className="max-w-[160px] truncate">
                <Badge tone={w.service_fee_status === "confirmed" ? "ok" : "warn"}>
                  {w.service_fee_status}
                </Badge>
                {w.service_fee_tx ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {String(w.service_fee_tx).slice(0, 8)}…
                  </span>
                ) : null}
              </Td>
              <Td>
                <Badge tone={w.status === "paid" ? "ok" : w.status === "rejected" ? "bad" : "warn"}>
                  {w.status}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</Td>
              <Td>
                <div className="flex gap-2">
                  <ActionButton onClick={() => wdMutation.mutate({ id: w.id, status: "paid" })}>
                    <Check className="h-3.5 w-3.5" /> Paid
                  </ActionButton>
                  <ActionButton danger onClick={() => wdMutation.mutate({ id: w.id, status: "rejected" })}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </ActionButton>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "deposits" && (
        <Table head={["User", "Requested", "Exact amount", "Status", "Tx", "When"]}>
          {data!.deposits.map((d) => (
            <tr key={d.id} className="border-t border-border transition-colors hover:bg-accent/40">
              <Td>{userLabel(d.user_id)}</Td>
              <Td className="tabular-nums">{money(d.amount)}</Td>
              <Td className="tabular-nums">{Number(d.unique_amount).toFixed(2)} USDT</Td>
              <Td>
                <Badge tone={d.status === "credited" ? "ok" : d.status === "expired" ? "bad" : "warn"}>
                  {d.status}
                </Badge>
              </Td>
              <Td className="max-w-[140px] truncate font-mono text-xs">
                {d.tx_hash ? `${String(d.tx_hash).slice(0, 10)}…` : "—"}
              </Td>
              <Td className="whitespace-nowrap">{new Date(d.created_at).toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "referrals" && (
        <Table head={["Referrer", "Referred", "Status", "Reward", "Qualified"]}>
          {data!.referrals.map((r) => (
            <tr key={r.id} className="border-t border-border transition-colors hover:bg-accent/40">
              <Td>{userLabel(r.referrer_id)}</Td>
              <Td>{userLabel(r.referred_id)}</Td>
              <Td>
                <Badge tone={r.status === "qualified" ? "ok" : "muted"}>{r.status}</Badge>
              </Td>
              <Td className="tabular-nums">{money(r.reward_amount)}</Td>
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

  const inputCls =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring";

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Compose
          </h3>
          <div className="space-y-4">
            <Field label="Audience">
              <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
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
                  className={inputCls}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 7)}
                />
              </Field>
            )}

            <Field label="Media">
              <select className={inputCls} value={mediaId} onChange={(e) => setMediaId(e.target.value)}>
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
                  className={`${inputCls} w-1/2`}
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
                  className={`${inputCls} w-1/2`}
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder="Button label"
                />
              </div>
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Message
          </h3>
          <textarea
            rows={14}
            className={`${inputCls} font-mono leading-relaxed`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {body.length}/4000 characters
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
        <button
          onClick={() => preview.mutate()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          <Eye className="h-4 w-4" />
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
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          History
        </h2>
        <Table head={["When", "Audience", "Media", "Status", "Total", "Sent", "Failed", "Message", ""]}>
          {(history.data ?? []).map((b) => (
            <tr key={b.id} className="border-t border-border transition-colors hover:bg-accent/40">
              <Td className="whitespace-nowrap">{new Date(b.created_at).toLocaleString()}</Td>
              <Td>{b.audience}</Td>
              <Td>{b.media_type}</Td>
              <Td>
                <Badge tone={b.status === "done" ? "ok" : b.status === "sending" ? "warn" : "muted"}>
                  {b.status}
                </Badge>
              </Td>
              <Td className="tabular-nums">{b.total_count}</Td>
              <Td className="tabular-nums">{b.sent_count}</Td>
              <Td className="tabular-nums">{b.failed_count}</Td>
              <Td className="max-w-[220px] truncate">{b.body}</Td>
              <Td>
                <ActionButton onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                  {openId === b.id ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Hide chats
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> View chats
                    </>
                  )}
                </ActionButton>
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
          <tr key={r.id} className="border-t border-border transition-colors hover:bg-accent/40">
            <Td className="tabular-nums">{r.telegram_id}</Td>
            <Td>{r.username ? `@${r.username}` : "—"}</Td>
            <Td>
              <Badge
                tone={
                  r.status === "sent" ? "ok" : r.status === "pending" ? "warn" : "bad"
                }
              >
                {r.status === "sent"
                  ? "delivered"
                  : r.status === "pending"
                    ? "pending"
                    : r.status === "blocked"
                      ? "blocked bot"
                      : "failed"}
              </Badge>
            </Td>
            <Td className="whitespace-nowrap">
              {r.sent_at ? new Date(r.sent_at).toLocaleString() : "—"}
            </Td>
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
  const dirty = v !== value;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
      <span className="w-56 shrink-0 truncate text-sm text-muted-foreground">{settingKey}</span>
      <input
        className="flex-1 rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-ring"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button
        onClick={() => onSave(v)}
        disabled={!dirty}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
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
  icon,
  accent = false,
  warn = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn
          ? "border-destructive/40 bg-destructive/10"
          : accent
            ? "border-primary/40 bg-primary/10"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "bad" | "warn" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-400"
      : tone === "bad"
        ? "bg-destructive/15 text-destructive"
        : tone === "warn"
          ? "bg-amber-500/15 text-amber-400"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
        danger
          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
          : "border-border hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Shell({
  children,
  tab,
  onTab,
  topBar,
}: {
  children: React.ReactNode;
  tab: Tab;
  onTab: (t: Tab) => void;
  topBar: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card/40 p-4 md:flex">
          <h1 className="mb-1 px-2 text-lg font-bold tracking-tight">LEXORA</h1>
          <p className="mb-6 px-2 text-xs uppercase tracking-widest text-muted-foreground">
            Admin
          </p>
          <nav className="flex flex-col gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onTab(id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          <div className="mb-6 flex items-center gap-2 overflow-x-auto md:hidden">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => onTab(id)}
                className={`whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm ${
                  tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {topBar && (
            <div className="mb-6 flex flex-wrap items-center gap-3">{topBar}</div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/20">
      <table className="w-full text-left text-sm">
        <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-medium">
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
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
