-- ============================================================================
-- Auditoria de autoria: "criado por" / "última edição" em
--   prontuarios, contracts e terms.
--
-- • prontuarios não tinha created_by/updated_by — adiciona ambos.
-- • contracts/terms já tinham created_by (setado no frontend) — adiciona updated_by.
-- • Trigger genérico set_row_actor() preenche os campos a partir de auth.uid():
--     - INSERT: created_by/updated_by = usuário autenticado (se ainda nulos).
--     - UPDATE: preserva created_by; atualiza updated_by para o usuário
--       autenticado. Atualizações anônimas (paciente assinando via link público,
--       auth.uid() IS NULL) NÃO sobrescrevem updated_by — preserva o último
--       usuário da clínica que editou.
--
-- Os nomes exibidos vêm de public.profiles (profiles.id = auth.users.id); por
-- isso as colunas referenciam auth.users(id), igual a contracts.created_by.
-- ============================================================================

-- ── Colunas ─────────────────────────────────────────────────────────────────
ALTER TABLE public.prontuarios
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── Backfill (melhor esforço, sem reescrever histórico inexistente) ──────────
-- Prontuários antigos: deriva a autoria da assinatura inicial registrada.
UPDATE public.prontuarios
  SET created_by = COALESCE(created_by, initial_signed_by),
      updated_by = COALESCE(updated_by, initial_signed_by)
  WHERE initial_signed_by IS NOT NULL
    AND (created_by IS NULL OR updated_by IS NULL);

-- Contratos/termos antigos: na criação created_by == updated_by.
UPDATE public.contracts SET updated_by = created_by WHERE updated_by IS NULL AND created_by IS NOT NULL;
UPDATE public.terms     SET updated_by = created_by WHERE updated_by IS NULL AND created_by IS NOT NULL;

-- ── Trigger genérico de autoria ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_row_actor()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by; -- created_by é imutável
    IF auth.uid() IS NOT NULL THEN
      NEW.updated_by := auth.uid();
    ELSE
      NEW.updated_by := OLD.updated_by; -- update anônimo (paciente) não sobrescreve
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger às três tabelas (idempotente).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['prontuarios', 'contracts', 'terms'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$I ON public.%2$I;', t || '_set_actor', t);
    EXECUTE format(
      'CREATE TRIGGER %1$I BEFORE INSERT OR UPDATE ON public.%2$I
         FOR EACH ROW EXECUTE FUNCTION public.set_row_actor();',
      t || '_set_actor', t);
  END LOOP;
END $$;
