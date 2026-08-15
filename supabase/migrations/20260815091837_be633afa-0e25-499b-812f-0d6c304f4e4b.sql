ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trade_unlock_until timestamptz,
  ADD COLUMN IF NOT EXISTS share_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bonus_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bonus_used_at timestamptz;

-- Backfill: any user who has already opened trades has consumed their welcome bonus.
WITH traded AS (
  SELECT user_id, SUM(amount)::numeric AS spent
  FROM public.trades
  GROUP BY user_id
)
UPDATE public.balances b
SET bonus = GREATEST(0, b.bonus - t.spent)
FROM traded t
WHERE b.user_id = t.user_id;

UPDATE public.users u
SET bonus_used = true, bonus_used_at = COALESCE(u.bonus_used_at, now())
WHERE EXISTS (SELECT 1 FROM public.trades t WHERE t.user_id = u.id);