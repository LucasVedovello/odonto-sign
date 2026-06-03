ALTER TABLE public.prontuarios
  ADD COLUMN IF NOT EXISTS odontograma JSONB DEFAULT '{}';
