-- ================================================================
-- Fluxo de assinaturas inteligente no prontuário
--   Ciclo de status: draft → signed → procedures_pending → finalized
--   • draft               : sem assinatura inicial
--   • signed              : info inicial assinada, sem eventos
--   • procedures_pending  : há evento(s) sem assinatura completa
--   • finalized           : info inicial + todos os eventos assinados
--
-- As assinaturas continuam como data-URL em TEXT (compatível com o
-- gerador de PDF atual). Esta migration só adiciona status + auditoria
-- e a assinatura do doutor por evento (paciente já existia).
-- ================================================================

ALTER TABLE public.prontuarios
  ADD COLUMN IF NOT EXISTS status            varchar(50) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS initial_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_signed_by uuid;

CREATE INDEX IF NOT EXISTS idx_prontuarios_status ON public.prontuarios(status);

-- Backfill: deriva status das assinaturas já existentes.
UPDATE public.prontuarios
SET status = CASE
  WHEN assinatura_doutor IS NOT NULL AND assinatura_paciente_planejamento IS NOT NULL THEN 'signed'
  ELSE 'draft'
END
WHERE status = 'draft';

-- Assinatura do doutor por evento + auditoria (paciente já existe).
ALTER TABLE public.prontuario_eventos
  ADD COLUMN IF NOT EXISTS assinatura_doutor text,
  ADD COLUMN IF NOT EXISTS assinado_em       timestamptz,
  ADD COLUMN IF NOT EXISTS assinado_por      uuid;
