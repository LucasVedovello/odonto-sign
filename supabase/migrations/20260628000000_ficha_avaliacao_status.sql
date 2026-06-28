-- ============================================================================
-- Ficha de Avaliação — fluxo de status enxuto (igual a Contratos/Prontuários)
--
-- O fluxo passou a ter 3 status:
--   rascunho → (clínica assina + gera link) → aguardando_assinatura
--            → (paciente assina) → assinado
--
-- A fase "aguardando o paciente" agora usa `aguardando_assinatura` (antes era
-- `aguardando_paciente`). Atualizamos as RPCs públicas para refletir isso.
-- O CHECK da coluna `status` mantém os valores antigos por compatibilidade.
-- ============================================================================

-- Leitura pública pelo token: disponível quando aguardando assinatura do
-- paciente OU já assinado.
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
     AND a.status IN ('aguardando_assinatura', 'aguardando_paciente', 'assinado');
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.public_get_avaliacao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_get_avaliacao(uuid) TO anon, authenticated;

-- Assinatura do paciente pelo token: só quando aguardando assinatura e o link
-- não expirou.
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
     AND status IN ('aguardando_assinatura', 'aguardando_paciente')
     AND deleted_at IS NULL
     AND (link_assinatura_expira_em IS NULL OR link_assinatura_expira_em > now())
  RETURNING to_jsonb(avaliacoes.*) INTO v_result;

  RETURN v_result; -- NULL quando token inválido / status não permite / expirado
END;
$$;
REVOKE ALL ON FUNCTION public.public_sign_avaliacao(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_sign_avaliacao(uuid, text) TO anon, authenticated;
