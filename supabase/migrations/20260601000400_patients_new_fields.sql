ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS estado_civil       TEXT,
  ADD COLUMN IF NOT EXISTS estado_nascimento  TEXT,
  ADD COLUMN IF NOT EXISTS cep                TEXT,
  ADD COLUMN IF NOT EXISTS rua                TEXT,
  ADD COLUMN IF NOT EXISTS bairro             TEXT,
  ADD COLUMN IF NOT EXISTS numero             TEXT,
  ADD COLUMN IF NOT EXISTS profissao          TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade       TEXT;
