CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_service_fee_tx_key
  ON public.withdrawals (service_fee_tx)
  WHERE service_fee_tx IS NOT NULL;

CREATE INDEX IF NOT EXISTS withdrawals_user_fee_status_idx
  ON public.withdrawals (user_id, service_fee_status);

CREATE INDEX IF NOT EXISTS trades_user_status_idx
  ON public.trades (user_id, status);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS promo_earnings numeric NOT NULL DEFAULT 0;