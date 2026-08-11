
-- roles
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- bot users
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL UNIQUE,
  username text,
  first_name text,
  referral_code text NOT NULL UNIQUE,
  referred_by uuid REFERENCES public.users(id),
  referral_source text,
  bonus_claimed boolean NOT NULL DEFAULT false,
  bonus_claimed_at timestamptz,
  bonus_amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  flagged_reason text,
  screen_message_id bigint,
  ui_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric(18,2) NOT NULL DEFAULT 0,
  bonus numeric(18,2) NOT NULL DEFAULT 0,
  profit numeric(18,2) NOT NULL DEFAULT 0,
  referral_balance numeric(18,2) NOT NULL DEFAULT 0,
  locked numeric(18,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trading_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  base_price numeric(18,6) NOT NULL,
  volatility numeric(10,6) NOT NULL DEFAULT 0.004,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  direction text NOT NULL,
  amount numeric(18,2) NOT NULL,
  leverage numeric(6,2) NOT NULL DEFAULT 1,
  risk_profile text NOT NULL DEFAULT 'balanced',
  entry_price numeric(18,6) NOT NULL,
  take_profit numeric(18,6) NOT NULL,
  stop_loss numeric(18,6) NOT NULL,
  current_price numeric(18,6) NOT NULL,
  confidence int NOT NULL DEFAULT 80,
  duration_minutes int NOT NULL,
  potential_profit numeric(18,2) NOT NULL,
  potential_loss numeric(18,2) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  result text,
  pnl numeric(18,2),
  message_id bigint,
  target_outcome text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  last_update_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trades_user_idx ON public.trades(user_id);
CREATE INDEX trades_status_idx ON public.trades(status);

CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL,
  wallet_address text NOT NULL,
  network text NOT NULL DEFAULT 'TRC20',
  status text NOT NULL DEFAULT 'pending',
  message_id bigint,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  qualified_at timestamptz,
  reward_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'referral',
  amount numeric(18,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_referrals int NOT NULL UNIQUE,
  reward_amount numeric(18,2) NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.user_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  reached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_id)
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount numeric(18,2) NOT NULL,
  balance_after numeric(18,2) NOT NULL,
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_idx ON public.transactions(user_id);

CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  target text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_name_idx ON public.events(name);

-- grants + RLS: all bot data is server-managed; admins read via server functions (service role).
GRANT ALL ON public.users, public.balances, public.trading_pairs, public.trades, public.withdrawals,
  public.referrals, public.referral_rewards, public.milestones, public.user_milestones,
  public.transactions, public.system_settings, public.admin_actions, public.events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.events_id_seq TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- seed settings
INSERT INTO public.system_settings(key, value) VALUES
 ('welcome_bonus','25'::jsonb),
 ('min_withdrawal','30'::jsonb),
 ('withdrawal_wait_hours','72'::jsonb),
 ('referral_reward','2'::jsonb),
 ('durations','[30,45,60,120,180,240]'::jsonb),
 ('risk_profiles','{"conservative":0.10,"balanced":0.25,"aggressive":0.45}'::jsonb),
 ('win_rate','0.55'::jsonb),
 ('expiry_rule','"market"'::jsonb),
 ('show_confidence','true'::jsonb),
 ('qualify_trades','1'::jsonb),
 ('payout_day','31'::jsonb);

INSERT INTO public.trading_pairs(symbol, base_price, volatility) VALUES
 ('BTC/USDT', 118420, 0.004),
 ('ETH/USDT', 3850, 0.006),
 ('SOL/USDT', 178.5, 0.008),
 ('XRP/USDT', 2.35, 0.007),
 ('BNB/USDT', 690, 0.005);

INSERT INTO public.milestones(active_referrals, reward_amount) VALUES
 (1, 2), (5, 10), (10, 25), (25, 75);
