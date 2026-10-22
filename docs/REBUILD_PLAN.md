# Cloudflare migration plan (behavior-preserving)

## Objective

Move the existing application from its current Lovable/Supabase backend to Cloudflare while preserving the existing product, UI, business rules, calculations, messages, and user flows. This is a migration, not a redesign or product review.

Do not intentionally change trading behavior, onboarding, bonus rules, referral rules, deposit/withdrawal steps, service-fee behavior, admin capabilities, wording, or other existing flows. If a Cloudflare platform difference requires a change, document the compatibility issue and implement the smallest equivalent replacement.

## Current application

- React 19 + TanStack Start/Router + Vite 8 + Nitro, deployed as a Cloudflare Worker.
- Server business logic is in `src/lib/nexora/`.
- Telegram webhook: `src/routes/api/public/telegram/webhook.ts`.
- Scheduler/tick route: `src/routes/api/public/nexora/tick.ts`.
- Admin UI: `src/routes/admin.tsx`; login UI: `src/routes/auth.tsx`.
- Current data access uses `@supabase/supabase-js`; `drizzle/schema.ts` is empty.
- Existing generated database types are in `src/integrations/supabase/types.ts`.

## Target Cloudflare services

- **Workers:** keep the existing app and HTTP endpoints running on the current Worker.
- **D1:** recreate the existing relational schema and database functions using SQLite-compatible schema, queries, and transactional operations.
- **R2 (only if needed):** host/migrate files currently stored in Supabase Storage; keep existing URLs and behavior equivalent where practical.
- **Worker secrets and bindings:** configure Telegram and other credentials privately, never in Git.
- **Scheduled execution:** preserve the existing tick/scheduling behavior using a Cloudflare-compatible mechanism. Do not change settlement or payment business rules as part of this migration.

D1 is not wire-compatible with the Supabase client. The data-access layer must therefore be ported to D1 while keeping callers' business behavior the same. Do not simply point the current Supabase client at D1.

## Database objects represented in the generated types

The types describe 17 tables: `users`, `user_roles`, `balances`, `transactions`, `trades`, `trading_pairs`, `deposits`, `withdrawals`, `referrals`, `referral_rewards`, `milestones`, `user_milestones`, `events`, `system_settings`, `admin_actions`, `broadcasts`, and `broadcast_recipients`.

They also describe the `has_role` and `expire_promotional_credit` database functions and the `app_role` enum. D1 equivalents must preserve their existing semantics. Generated types do not fully specify defaults, indexes, constraints, or triggers, so inspect every query and any available migrations before finalizing the schema.

## Migration sequence

1. Inventory existing queries, schema types, migrations, environment variables, Storage use, and auth behavior.
2. Add a Cloudflare D1 schema and versioned migration files representing the existing database.
3. Implement a D1-backed data-access layer and port query operations without changing business rules.
4. Port database functions to equivalent D1 transactions/queries.
5. Keep Telegram webhook routes, message handling, callback data, bot text, and flows behavior-compatible.
6. Keep all current onboarding, bonus, trading, referral, deposit, withdrawal, service-fee, admin, and broadcast behavior unchanged.
7. Configure Cloudflare bindings and secrets without committing credentials.
8. Run build/type checks and compare the existing flows against the migrated implementation.
9. Deploy to a staging Worker, test end-to-end, then switch over once the Cloudflare backend is configured.

## Important constraints

- Do not redesign the UI or rewrite copy.
- Do not intentionally alter trading outcomes, balance math, thresholds, settings, or payment/withdrawal rules.
- Do not delete existing functionality because it seems undesirable.
- Do not claim the old database has been migrated unless an authorized export is actually available. The code alone cannot recover old user records.
- Preserve the current implementation in Git and make migration changes on the dedicated rebuild branch until tested.

## Configuration currently found

The current `wrangler.jsonc` still points to the old Supabase project. The app will not be fully migrated until the Supabase client usage is replaced with the D1 data-access layer and Cloudflare bindings/secrets are configured.

## References

- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
