-- ============================================================================
-- Ficha de Avaliação — fluxo de assinatura na ORDEM CORRETA
--
-- Antes o paciente assinava sem a clínica ter assinado. A ordem certa é:
--   rascunho
--     → recepção cria / atribui ao dentista; dentista preenche e conclui
--   aguardando_assinatura_clinica
--     → recepção/administrador assina (Representante da Contratada)
--   aguardando_assinatura_paciente
--     → recepção gera o link; paciente assina (Cliente responsável)
--   assinado
--
-- Esta migração:
--   1. troca o CHECK de `status` pelos 4 novos valores;
--   2. migra os dados existentes (aguardando_assinatura / aguardando_paciente
--      → aguardando_assinatura_paciente, pois significavam "aguardando o
--      paciente" no modelo antigo);
--   3. atualiza as RPCs públicas para o novo valor de status.
-- ============================================================================

-- 1) Remove o CHECK antigo para permitir a migração dos dados.
ALTER TABLE public.avaliacoes DROP CONSTRAINT IF EXISTS avaliacoes_status_check;

-- 2) Migra dados existentes para os novos valores.
UPDATE public.avaliacoes
   SET status = 'aguardando_assinatura_paciente'
 WHERE status IN ('aguardando_assinatura', 'aguardando_paciente');

-- 3) Novo CHECK com os 4 status do fluxo correto.
ALTER TABLE public.avaliacoes
  ADD CONSTRAINT avaliacoes_status_check
  CHECK (status IN (
    'rascunho',
    'aguardando_assinatura_clinica',
    'aguardando_assinatura_paciente',
    'assinado'
  ));

-- ── RPC pública: leitura da ficha pelo token ────────────────────────────────
-- Disponível quando aguardando a assinatura do paciente OU já assinada.
CREATE OR REPLACE FUNCTION public.public_get_avaliacao(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN NULL; END IF;
  SELECT to_jsonb(a)
    INTO v_result
    FROM public.avaliacoes a
   WHERE a.link_assinatura_token = p_token
     AND a.deleted_at IS NULL
     AND a.status IN ('aguardando_assinatura_paciente', 'assinado');
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.public_get_avaliacao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_get_avaliacao(uuid) TO anon, authenticated;

-- ── RPC pública: assinatura do paciente pelo token ──────────────────────────
-- Só assina quando aguardando a assinatura do paciente e o link não expirou.
CREATE OR REPLACE FUNCTION public.public_sign_avaliacao(
  p_token uuid,
  p_signature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR p_signature IS NULL OR length(p_signature) < 10 THEN
    RAISE EXCEPTION 'Token ou assinatura ausente';
  END IF;

  UPDATE public.avaliacoes
     SET assinatura_paciente   = p_signature,
         paciente_assinado_em  = now(),
         status                = 'assinado'
   WHERE link_assinatura_token = p_token
     AND status = 'aguardando_assinatura_paciente'
     AND deleted_at IS NULL
     AND (link_assinatura_expira_em IS NULL OR link_assinatura_expira_em > now())
  RETURNING to_jsonb(avaliacoes.*) INTO v_result;

  RETURN v_result; -- NULL quando token inválido / status não permite / expirado
END;
$$;
REVOKE ALL ON FUNCTION public.public_sign_avaliacao(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_sign_avaliacao(uuid, text) TO anon, authenticated;
