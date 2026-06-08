CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'skalepay',
  provider_charge_id TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  br_code TEXT,
  qr_code_image TEXT,
  expires_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deposits_client_id ON public.deposits(client_id);
CREATE INDEX idx_deposits_provider_charge_id ON public.deposits(provider_charge_id);
CREATE INDEX idx_deposits_status ON public.deposits(status);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposits_public_read"
  ON public.deposits FOR SELECT
  USING (true);

CREATE POLICY "deposits_public_insert"
  ON public.deposits FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_deposits_updated_at
  BEFORE UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();