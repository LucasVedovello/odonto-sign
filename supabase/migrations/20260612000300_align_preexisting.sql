-- ================================================================
-- Alinhamento de schema pré-existente (tabelas criadas via Lovable)
--   • profiles.role era nullable e sem default → NOT NULL + default
--   • appointments não tinha prontuario_id / notes / created_by
-- ================================================================

-- profiles.role: garante backfill completo e restrições
UPDATE public.profiles SET role = 'dentist' WHERE role IS NULL;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'dentist';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

-- appointments: colunas que faltavam na tabela pré-existente
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS prontuario_id uuid REFERENCES public.prontuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes         text,
  ADD COLUMN IF NOT EXISTS created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_prontuario ON public.appointments(prontuario_id);
