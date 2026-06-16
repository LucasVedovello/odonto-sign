-- Lixeira: soft delete para contracts e terms + expurgo automatico de 30 dias.
-- Aplicado em producao (ref dziinqtztpolawyfbakr) via Management API.

-- 1) Coluna de soft delete em contracts e terms (idempotente)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.terms     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS contracts_deleted_at_idx ON public.contracts (deleted_at);
CREATE INDEX IF NOT EXISTS terms_deleted_at_idx     ON public.terms (deleted_at);

-- 2) Expurgo dos itens que estao na lixeira ha mais de 30 dias.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_trash()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  DELETE FROM public.contracts    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.terms        WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.prontuarios  WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.appointments WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.patients     WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$func$;

-- Agendamento diario (04:00 UTC). cron.schedule com nome faz upsert do job.
SELECT cron.schedule('purge-old-trash', '0 4 * * *', 'SELECT public.purge_old_trash();');
