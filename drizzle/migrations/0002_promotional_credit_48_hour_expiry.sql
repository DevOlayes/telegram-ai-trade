ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bonus_expires_at timestamptz, ADD COLUMN IF NOT EXISTS bonus_expired_at timestamptz;

-- Existing claimed, unspent credit receives a full 48-hour notice from rollout.
UPDATE public.users u
SET bonus_expires_at = now() + interval '48 hours'
FROM public.balances b
WHERE b.user_id = u.id AND u.bonus_claimed = true AND b.bonus > 0 AND u.bonus_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.expire_promotional_credit(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH expired AS (
    UPDATE public.balances b
    SET balance = greatest(0, b.balance - b.bonus),
        bonus = 0,
        updated_at = now()
    FROM public.users u
    WHERE b.user_id = u.id
      AND (p_user_id IS NULL OR u.id = p_user_id)
      AND u.bonus_expires_at <= now()
      AND b.bonus > 0
    RETURNING u.id
  ), marked AS (
    UPDATE public.users u
    SET bonus_expired_at = now()
    FROM expired e
    WHERE u.id = e.id
    RETURNING u.id
  )
  SELECT count(*) INTO affected FROM marked;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_promotional_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_promotional_credit(uuid) TO service_role;