-- ============================================================================
-- Múltiplos campos de assinatura + detecção automática + data/local automáticos
--
-- O fluxo passa a suportar VÁRIOS campos de assinatura por parte (ex.: contrato
-- com "Contratada" + "Contratante" assinados pela clínica). As colunas
-- `clinic_signature_pos` / `patient_signature_pos` (jsonb) passam a guardar um
-- ARRAY de posições — não exige alteração de tipo (jsonb já aceita arrays).
--
-- Novas colunas:
--   auto_text_fields: campos de data/local detectados no PDF (array de
--     {page,x,y,w,h,kind}; kind = date | local | local_date).
--   clinic_city: cidade da clínica (companies.cidade) resolvida no upload, usada
--     para preencher os campos de "local".
-- ============================================================================

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS auto_text_fields JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS clinic_city TEXT;

ALTER TABLE public.terms ADD COLUMN IF NOT EXISTS auto_text_fields JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.terms ADD COLUMN IF NOT EXISTS clinic_city TEXT;
