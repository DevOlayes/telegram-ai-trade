import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getAdminOverview,
  setUserStatus,
  setWithdrawalStatus,
  updateSetting,
} from "@/lib/nexora/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "NEXORA Admin Panel" },
      { name: "description", content: "Manage NEXORA users, trades, withdrawals and settings." },
      { property: "og:title", content: "NEXORA Admin Panel" },
      { property: "og:description", content: "Manage NEXORA users, trades, withdrawals and settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["users", "trades", "withdrawals", "referrals", "settings"] as const;
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <h1 className="mb-6 text-2xl font-bold">NEXORA Admin</h1>
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
