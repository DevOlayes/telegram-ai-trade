CREATE TABLE public.deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  unique_amount numeric NOT NULL,
  wallet_address text NOT NULL,
  tx_hash text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  message_id bigint,
  credited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.deposits TO service_role;

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can view deposits"
ON public.deposits FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_deposits_status ON public.deposits (status);
CREATE INDEX idx_deposits_user ON public.deposits (user_id);

INSERT INTO public.system_settings (key, value) VALUES
  ('deposit_window_minutes', '180'::jsonb),
  ('usdt_contract', '"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"'::jsonb)
ON CONFLICT (key) DO NOTHING;