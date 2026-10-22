# Independent backend rebuild plan

## Current stack found in the repository

- React 19 + TanStack Start/Router + Vite 8 + Nitro, deployed as a Cloudflare Worker.
- Supabase JS client for Postgres/Auth/Storage. Server logic expects a server-only service-role credential.
- Telegram webhook route: `src/routes/api/public/telegram/webhook.ts`.
- Scheduler endpoint: `src/routes/api/public/nexora/tick.ts`.
- Core modules: `core.server.ts`, `bot.server.ts`, `telegram.server.ts`, `engine.server.ts`, `settlement.server.ts`, `referrals.server.ts`, `deposits.server.ts`, `payments.server.ts`, `tron.server.ts`, `broadcast.server.ts`.
- Admin: `src/routes/admin.tsx`; login: `src/routes/auth.tsx`.
- Generated Supabase types exist; `drizzle/schema.ts` is empty, so it is not currently a source of database schema.

## Tables described by generated types

`users`, `user_roles`, `balances`, `transactions`, `trades`, `trading_pairs`, `deposits`, `withdrawals`, `referrals`, `referral_rewards`, `milestones`, `user_milestones`, `events`, `system_settings`, `admin_actions`, `broadcasts`, `broadcast_recipients`.

The types also describe `has_role`, `expire_promotional_credit`, and enum `app_role`. SQL migrations must still define constraints, indexes, defaults, functions, and access policies.

## Findings to address

1. **Backend coupling:** Wrangler config points to the old Supabase project. `core.server.ts` needs `SUPABASE_SERVICE_ROLE_KEY`; Telegram transport needs `TELEGRAM_BOT_TOKEN`.
2. **Potential Wrangler config bug:** the Supabase URL and publishable key in `wrangler.jsonc` appear to include literal quote characters. Normalize and verify these values before using a new backend.
3. **Scheduler security:** `/api/public/nexora/tick` exposes GET and POST without authentication and calls a job that can settle trades, update balances, process payment checks, and send broadcasts. Replace this with a Cloudflare Cron Trigger or a strongly authenticated server-only job.
4. **Webhook reliability:** the webhook checks Telegram's secret-token header, but handler exceptions are logged and the route still returns success. Add durable logs and idempotent processing to avoid silently losing updates.
5. **Trading simulation:** `engine.server.ts` generates random recommendations and synthetic prices. Its outcome function can guarantee starter wins and prevent consecutive losses. This is a simulation, not live-market AI; label it clearly and never imply guaranteed returns.
6. **Withdrawal flow:** the README says not to require a separate withdrawal payment, but the current bot/payment modules ask users to send a fixed fee before processing. Do not reproduce that pattern in the rebuild. Keep real-money deposits/withdrawals disabled until transparent rules, secure custody, and applicable compliance are addressed.
7. **Assets and secrets:** update Lovable asset-host fallbacks and move all private credentials into Cloudflare Worker secrets, never Git.

## Recommended minimal-change architecture

- Keep the current Cloudflare Worker frontend and Telegram HTTPS webhook.
- Use a Supabase project owned by the developer for Postgres/Auth/Storage, since the code already uses Supabase APIs. Choose a different database only if needed; that requires a larger rewrite.
- Create versioned SQL migrations from any existing migration files plus the generated types and database functions/policies referenced by the code.
- Recreate required Storage buckets or move public assets to Cloudflare.
- Use Cloudflare Cron Triggers for settlement work, with idempotent database updates and no public unauthenticated tick endpoint.
- Treat the original users and balances as a separate recovery effort; the new database will start with new registrations unless a legitimate export is recovered.

## Work order

- [ ] Inspect all SQL migrations, environment variables, route files, policies, and Storage use.
- [ ] Normalize Wrangler configuration and add a secret-free environment example.
- [ ] Create SQL migrations for tables, indexes, constraints, database functions, and access policies.
- [ ] Set up the owned Supabase project and apply migrations.
- [ ] Reconnect client/server Supabase configuration.
- [ ] Secure and test Telegram webhook delivery and duplicate-update handling.
- [ ] Replace the public tick endpoint with scheduled execution.
- [ ] Run build/lint/type checks and end-to-end tests for onboarding, bonus, referrals, simulation, balances, admin permissions, and failures.
- [ ] Deploy to a staging Worker, smoke-test, then cut over.

## References

- Supabase migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Telegram Bot API webhooks: https://core.telegram.org/bots/api
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Community migration utility to evaluate (does not bypass backend access controls): https://github.com/dreamlit-ai/lovable-cloud-to-supabase-exporter

This plan describes code and behavior reconstruction, not recovery of the inaccessible database records. Keep the original backend intact while data recovery remains a separate possibility.
