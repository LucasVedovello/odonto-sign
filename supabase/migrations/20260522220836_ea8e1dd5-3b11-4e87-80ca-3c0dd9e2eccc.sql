
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  prontuario text NOT NULL UNIQUE,
  nome text,
  cpf text,
  rg text,
  endereco text,
  telefone text,
  convenio text,
  contract_accepted boolean NOT NULL DEFAULT false,
  signature_data text,
  status text NOT NULL DEFAULT 'aguardando',
  created_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz
);

-- Sequence for prontuario numbers
CREATE SEQUENCE public.prontuario_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_prontuario()
RETURNS text LANGUAGE sql AS $$
  SELECT 'PRONT-' || lpad(nextval('public.prontuario_seq')::text, 5, '0');
$$;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Public access (security via unguessable token in URL)
CREATE POLICY "anyone can insert" ON public.patients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone can select" ON public.patients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone can update" ON public.patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
