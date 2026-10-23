import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Users, Activity, TrendingUp, Coins } from "lucide-react";
import { getAdminAnalytics } from "@/lib/nexora/analytics.functions";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "LEXORA Analytics" }, { name: "description", content: "LEXORA user journey, retention, funnel and weekly analytics." }] }),
  component: AnalyticsPage,
});

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: typeof Users }) {
  return <section className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4" /></div>
    <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </section>;
}

function AnalyticsPage() {
  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => getAdminAnalytics(),
    retry: false,
    refetchInterval: 60000,
  });
  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to admin</Link>
          <h1 className="text-2xl font-semibold">LEXORA User Journey &amp; Friction Monitor</h1>
          <p className="mt-1 text-sm text-muted-foreground">Weekly report · Funnel and retention · Last 90 days of source records</p>
        </div>
        <button onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent" disabled={isFetching}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh</button>
      </header>
      {isLoading && <div className="rounded-xl border border-border p-8 text-sm text-muted-foreground">Loading analytics…</div>}
      {error && <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">Analytics could not be loaded. Your admin session may have expired. Return to the admin panel and sign in again.</div>}
      {data && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="New users (7 days)" value={data.totals.newUsers7d} hint={`${data.totals.newUsers30d} new users in 30 days`} icon={Users} />
          <Metric label="Active users (7 days)" value={data.totals.activeUsers7d} hint="Based on last_seen_at" icon={Activity} />
          <Metric label="Trades opened (7 days)" value={data.totals.trades7d} hint={`${data.totals.uniqueTraders90d} unique traders in 90 days`} icon={TrendingUp} />
          <Metric label="Confirmed depositors" value={data.totals.confirmedDepositors90d} hint="Last 90 days · status-based" icon={Coins} />
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Conversion funnel</h2>
            <p className="mb-5 mt-1 text-xs text-muted-foreground">Unique users at each stage, from records in the last 90 days.</p>
            <div className="space-y-4">
              {data.funnel.map((stage, index) => {
                const first = data.funnel[0]?.users ?? 0;
                const previous = index ? data.funnel[index - 1]?.users ?? 0 : first;
                const pct = first ? Math.round(stage.users / first * 100) : 0;
                const stepPct = index && previous ? Math.round(stage.users / previous * 100) : (first ? 100 : 0);
                return <div key={stage.stage}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span>{stage.stage}</span><strong className="tabular-nums">{stage.users} <span className="font-normal text-muted-foreground">({pct}%)</span></strong></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                  {index > 0 && <p className="mt-1 text-xs text-muted-foreground">{stepPct}% of previous stage</p>}
                </div>;
              })}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Weekly activity</h2>
            <p className="mb-5 mt-1 text-xs text-muted-foreground">UTC calendar days · last 7 days.</p>
            <div className="space-y-4">
              {data.weekly.map((day) => {
                const max = Math.max(1, ...data.weekly.map((item) => Math.max(item.signups, item.trades, item.deposits)));
                return <div key={day.date} className="grid grid-cols-[44px_1fr_1fr_1fr] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{day.day}</span>
                  <div><div className="mb-1 text-muted-foreground">Signups <b className="text-foreground">{day.signups}</b></div><div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${day.signups / max * 100}%` }} /></div></div>
                  <div><div className="mb-1 text-muted-foreground">Trades <b className="text-foreground">{day.trades}</b></div><div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary/70" style={{ width: `${day.trades / max * 100}%` }} /></div></div>
                  <div><div className="mb-1 text-muted-foreground">Deposits <b className="text-foreground">{day.deposits}</b></div><div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary/40" style={{ width: `${day.deposits / max * 100}%` }} /></div></div>
                </div>;
              })}
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Weekly retention cohorts</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">A user counts as returned if their last_seen_at is after the cohort week. Recent cohorts are marked as not yet matured.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-2 pr-4">Week starting (UTC)</th><th className="py-2 pr-4">Signups</th><th className="py-2 pr-4">Returned</th><th className="py-2 pr-4">Retention</th><th className="py-2">Status</th></tr></thead>
            <tbody>{data.retention.map((row) => <tr key={row.week} className="border-t border-border"><td className="py-3 pr-4">{row.week}</td><td className="py-3 pr-4 tabular-nums">{row.signups}</td><td className="py-3 pr-4 tabular-nums">{row.returnedAfterWeek}</td><td className="py-3 pr-4 tabular-nums">{row.retentionPct}%</td><td className="py-3">{row.matured ? "Matured" : "In progress"}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Tracking coverage &amp; weekly summary</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Events recorded (90d)</p><p className="text-xl font-semibold">{data.trackingHealth.eventRows90d}</p></div>
            <div><p className="text-xs text-muted-foreground">Registration events (90d)</p><p className="text-xl font-semibold">{data.trackingHealth.registrationEvents90d}</p></div>
            <div><p className="text-xs text-muted-foreground">Deposit attempts (7d)</p><p className="text-xl font-semibold">{data.totals.depositAttempts7d}</p></div>
            <div><p className="text-xs text-muted-foreground">Withdrawals created (7d)</p><p className="text-xl font-semibold">{data.totals.withdrawals7d}</p></div>
            <div><p className="text-xs text-muted-foreground">Trade-opened events (90d)</p><p className="text-xl font-semibold">{data.totals.tradeOpenedEvents90d}</p></div>
            <div><p className="text-xs text-muted-foreground">Bonus-claimed events (90d)</p><p className="text-xl font-semibold">{data.totals.bonusClaimedEvents90d}</p></div>
            <div><p className="text-xs text-muted-foreground">Deposit-started events (90d)</p><p className="text-xl font-semibold">{data.totals.depositStartedEvents90d}</p></div>
            <div><p className="text-xs text-muted-foreground">Withdrawal-request events (90d)</p><p className="text-xl font-semibold">{data.totals.withdrawalRequestedEvents90d}</p></div>
          </div>
          <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{data.trackingHealth.note}</p>
          <p className="mt-3 text-xs text-muted-foreground">Generated {new Date(data.generatedAt).toLocaleString()} · Auto-refreshes every minute. This page provides a weekly report view; it does not send email or Telegram reports automatically.</p>
        </section>
      </>}
    </div>
  </main>;
}
