import { createServerFn } from "@tanstack/react-start";
import { requireAdminAuth } from "@/lib/nexora/admin-auth-middleware";

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async ({ context }) => {
    if (!(context as { adminUser?: string }).adminUser) throw new Error("Forbidden");
    const { db } = await import("@/lib/nexora/core.server");
    const now = Date.now();
    const iso = (days: number) => new Date(now - days * 86400000).toISOString();
    const [usersResult, tradesResult, depositsResult, eventsResult, withdrawalsResult] = await Promise.all([
      db().from("users").select("id,created_at,last_seen_at,referred_by,status").gte("created_at", iso(90)).order("created_at", { ascending: false }).limit(5000),
      db().from("trades").select("user_id,opened_at,status,result").gte("opened_at", iso(90)).limit(10000),
      db().from("deposits").select("user_id,created_at,status").gte("created_at", iso(90)).limit(5000),
      db().from("events").select("user_id,name,created_at").gte("created_at", iso(90)).limit(10000),
      db().from("withdrawals").select("user_id,created_at,status").gte("created_at", iso(7)).limit(5000),
    ]);
    for (const result of [usersResult, tradesResult, depositsResult, eventsResult, withdrawalsResult]) {
      if (result.error) throw new Error("Analytics data could not be loaded");
    }
    const users = (usersResult.data ?? []) as { id: string; created_at: string; last_seen_at: string; referred_by: string | null; status: string }[];
    const trades = (tradesResult.data ?? []) as { user_id: string; opened_at: string; status: string; result: string | null }[];
    const deposits = (depositsResult.data ?? []) as { user_id: string; created_at: string; status: string }[];
    const events = (eventsResult.data ?? []) as { user_id: string | null; name: string; created_at: string }[];
    const withdrawals = (withdrawalsResult.data ?? []) as { user_id: string; created_at: string; status: string }[];
    const unique = (rows: { user_id: string }[]) => new Set(rows.map((r) => r.user_id)).size;
    const within = (value: string, days: number) => Date.parse(value) >= now - days * 86400000;
    const users7 = users.filter((u) => within(u.created_at, 7));
    const users30 = users.filter((u) => within(u.created_at, 30));
    const active7 = users.filter((u) => u.last_seen_at && within(u.last_seen_at, 7)).length;
    const trades7 = trades.filter((t) => within(t.opened_at, 7));
    const deposits7 = deposits.filter((d) => within(d.created_at, 7));
    const tradeUsers = new Set(trades.map((t) => t.user_id));
    const depositUsers = new Set(deposits.filter((d) => ["confirmed", "completed", "paid", "success"].includes(d.status.toLowerCase())).map((d) => d.user_id));
    const referralUsers = new Set(users.filter((u) => u.referred_by).map((u) => u.id));
    const cohortRows = Array.from({ length: 8 }, (_, index) => {
      const start = new Date(now - (7 - index) * 7 * 86400000);
      const end = new Date(start.getTime() + 7 * 86400000);
      const cohort = users.filter((u) => Date.parse(u.created_at) >= start.getTime() && Date.parse(u.created_at) < end.getTime());
      const cohortIds = new Set(cohort.map((u) => u.id));
      const returned = cohort.filter((u) => u.last_seen_at && Date.parse(u.last_seen_at) >= end.getTime()).length;
      return {
        week: start.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }),
        signups: cohort.length,
        returnedAfterWeek: returned,
        retentionPct: cohort.length ? Math.round((returned / cohort.length) * 100) : 0,
        matured: end.getTime() <= now,
        tradeUsers: trades.filter((t) => cohortIds.has(t.user_id)).length,
      };
    });
    const dayCounts = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(now - (6 - i) * 86400000);
      const key = start.toISOString().slice(0, 10);
      return {
        day: start.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
        date: key,
        signups: users.filter((u) => u.created_at.slice(0, 10) === key).length,
        trades: trades.filter((t) => t.opened_at.slice(0, 10) === key).length,
        deposits: deposits.filter((d) => d.created_at.slice(0, 10) === key).length,
      };
    });
    const registrationEvents = events.filter((e) => e.name === "registration").length;
    const eventCounts = Object.fromEntries(["registration", "bonus_claimed", "trade_opened", "deposit_started", "withdrawal_requested", "trading_unlocked", "ai_recommendation"].map((name) => [name, events.filter((event) => event.name === name).length]));
    return {
      generatedAt: new Date(now).toISOString(),
      windowDays: 90,
      totals: {
        newUsers7d: users7.length,
        newUsers30d: users30.length,
        activeUsers7d: active7,
        trades7d: trades7.length,
        uniqueTraders90d: tradeUsers.size,
        depositAttempts7d: deposits7.length,
        confirmedDepositors90d: depositUsers.size,
        referredUsers90d: referralUsers.size,
        events90d: events.length,
        registrationEvents90d: registrationEvents,
        depositStartedEvents90d: eventCounts["deposit_started"] ?? 0,
        tradeOpenedEvents90d: eventCounts["trade_opened"] ?? 0,
        bonusClaimedEvents90d: eventCounts["bonus_claimed"] ?? 0,
        withdrawalRequestedEvents90d: eventCounts["withdrawal_requested"] ?? 0,
        withdrawals7d: withdrawals.length,
        settledTrades90d: trades.filter((t) => t.status.toLowerCase() === "settled" || Boolean(t.result)).length,
      },
      funnel: [
        { stage: "Registered (90d)", users: users.length },
        { stage: "Started trading (90d)", users: users.filter((u) => tradeUsers.has(u.id)).length },
        { stage: "Attempted deposit (90d)", users: users.filter((u) => deposits.some((d) => d.user_id === u.id)).length },
        { stage: "Confirmed deposit (90d)", users: users.filter((u) => depositUsers.has(u.id)).length },
      ],
      retention: cohortRows,
      weekly: dayCounts,
      trackingHealth: {
        eventRows90d: events.length,
        registrationEvents90d: registrationEvents,
        eventCounts,
        note: "Funnel steps are derived from persisted account, trade, and deposit records. Event tracking currently reflects only events explicitly written to the events table; retention uses last_seen_at and is an approximation, not a strict cohort activity event.",
      },
    };
  });
