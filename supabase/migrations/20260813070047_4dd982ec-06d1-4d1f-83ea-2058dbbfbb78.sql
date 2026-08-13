INSERT INTO public.system_settings (key, value) VALUES
  ('win_rate', '0.85'::jsonb),
  ('starter_wins', '3'::jsonb),
  ('no_double_loss', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();