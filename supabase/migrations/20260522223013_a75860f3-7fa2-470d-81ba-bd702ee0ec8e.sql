ALTER TABLE public.patients ALTER COLUMN prontuario DROP NOT NULL;
ALTER TABLE public.patients ALTER COLUMN prontuario DROP DEFAULT;
CREATE INDEX IF NOT EXISTS idx_patients_nome ON public.patients (lower(nome));