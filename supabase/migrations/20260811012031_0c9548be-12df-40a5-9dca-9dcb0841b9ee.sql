ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS service_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS service_fee_tx text,
  ADD COLUMN IF NOT EXISTS fee_requested_at timestamp with time zone;

INSERT INTO public.system_settings (key, value) VALUES
  ('service_fee', '4'::jsonb),
  ('fee_window_minutes', '120'::jsonb),
  ('fee_wallet', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;