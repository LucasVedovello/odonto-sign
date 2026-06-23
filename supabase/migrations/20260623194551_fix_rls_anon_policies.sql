-- ============================================================================
-- Correção de exposição RLS para o papel `anon`
--
-- Problema: contracts/terms tinham policies `FOR SELECT/UPDATE TO anon
-- USING (true)` e patients tinha `Public can view/update ... USING (true)`.
-- Com a chave pública (anon), qualquer pessoa podia LER/EDITAR todos os
-- contratos, termos e pacientes (PII/dados de saúde) — sem precisar do token.
--
-- Solução:
--   • Remover todo acesso direto de `anon` a contracts/terms/patients.
--   • Expor o fluxo público APENAS via funções SECURITY DEFINER que exigem o
--     token exato (UUID secreto que o paciente recebe no link).
--   • Acesso autenticado (clínica) continua via policies "clinic_access" /
--     "Company members can ..." (escopo da própria clínica) — inalterado.
--
-- Observação: as tabelas `contract_templates` e `patient_terms` mencionadas na
-- análise NÃO existem neste schema; os documentos assináveis vivem em
-- `contracts` e `terms`. Os DROP POLICY abaixo são idempotentes.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. CONTRACTS / TERMS — remover acesso anônimo amplo
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read"           ON public.contracts;
DROP POLICY IF EXISTS "public_update"         ON public.contracts;
DROP POLICY IF EXISTS "public_patient_access" ON public.contracts; -- nome legado
DROP POLICY IF EXISTS "public_patient_update" ON public.contracts; -- nome legado

DROP POLICY IF EXISTS "public_read"           ON public.terms;
DROP POLICY IF EXISTS "public_update"         ON public.terms;
DROP POLICY IF EXISTS "public_patient_access" ON public.terms;
DROP POLICY IF EXISTS "public_patient_update" ON public.terms;

-- RPC: leitura de um documento assinável pelo token (anon). Retorna jsonb da
-- linha correspondente ao token exato, ou NULL. Como é SECURITY DEFINER, roda
-- com privilégios do dono e ignora a RLS — por isso o filtro por token é a
-- única forma de obter o registro.
CREATE OR REPLACE FUNCTION public.public_get_signed_document(p_kind text, p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table  text;
  v_result jsonb;
BEGIN
  v_table := CASE p_kind WHEN 'contract' THEN 'contracts' WHEN 'term' THEN 'terms' END;
  IF v_table IS NULL OR p_token IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE format(
    'SELECT to_jsonb(t) FROM public.%I t WHERE t.public_token = $1 AND t.deleted_at IS NULL',
    v_table
  ) INTO v_result USING p_token;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.public_get_signed_document(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_get_signed_document(text, uuid) TO anon, authenticated;

-- RPC: registra a assinatura do paciente pelo token (anon). Só atualiza quando
-- o documento está aguardando o paciente. Retorna a linha (jsonb) ou NULL.
CREATE OR REPLACE FUNCTION public.public_sign_document(
  p_kind text,
  p_token uuid,
  p_signature text,
  p_signed_pdf_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table  text;
  v_result jsonb;
BEGIN
  v_table := CASE p_kind WHEN 'contract' THEN 'contracts' WHEN 'term' THEN 'terms' END;
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Tipo de documento inválido';
  END IF;
  IF p_token IS NULL OR p_signature IS NULL OR length(p_signature) < 10 THEN
    RAISE EXCEPTION 'Token ou assinatura ausente';
  END IF;

  EXECUTE format(
    'UPDATE public.%I
        SET patient_signature = $2,
            patient_signed_at = now(),
            status            = ''assinado'',
            signed_pdf_path   = COALESCE($3, signed_pdf_path)
      WHERE public_token = $1
        AND status = ''aguardando_paciente''
        AND deleted_at IS NULL
      RETURNING to_jsonb(%I.*)',
    v_table, v_table
  ) INTO v_result USING p_token, p_signature, p_signed_pdf_path;

  RETURN v_result; -- NULL quando o token não existe ou o status não permite
END;
$$;
REVOKE ALL ON FUNCTION public.public_sign_document(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_sign_document(text, uuid, text, text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. PATIENTS — remover TODO acesso anônimo direto
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view patient by token"   ON public.patients;
DROP POLICY IF EXISTS "Public can update unsigned patient"  ON public.patients;
DROP POLICY IF EXISTS "Public can update patient by token"  ON public.patients;

-- Campos usados pelo módulo de pacientes (item 2/4):
--   genero  — sexo/gênero do paciente
--   active  — ativo/inativo (desativação ≠ lixeira; não dispara o expurgo de 30d)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS genero text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS active  boolean NOT NULL DEFAULT true;

-- As policies "Company members can view/insert/update/delete patients"
-- (TO authenticated, escopo da clínica via get_user_company_id) permanecem e
-- já cobrem clinic_owner, dentist e staff.

-- RPC: auto-cadastro do paciente pelo link com token (anon) — leitura.
-- Retorna apenas campos não sensíveis para o titular confirmar/completar.
CREATE OR REPLACE FUNCTION public.public_get_patient_registration(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'nome', nome, 'cpf', cpf, 'rg', rg,
    'data_nascimento', data_nascimento, 'genero', genero,
    'estado_civil', estado_civil, 'estado_nascimento', estado_nascimento,
    'telefone', telefone, 'email', email,
    'cep', cep, 'rua', rua, 'bairro', bairro, 'numero', numero,
    'profissao', profissao, 'escolaridade', escolaridade,
    'status', status
  )
  INTO v_result
  FROM public.patients
  WHERE token = p_token AND deleted_at IS NULL;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.public_get_patient_registration(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_get_patient_registration(uuid) TO anon, authenticated;

-- RPC: auto-cadastro do paciente — gravação. Atualiza os campos enviados e
-- marca status = 'registered'. Só permite quando ainda está pendente.
CREATE OR REPLACE FUNCTION public.public_complete_patient_registration(p_token uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL THEN RAISE EXCEPTION 'Token ausente'; END IF;

  UPDATE public.patients SET
    nome              = COALESCE(NULLIF(p_data->>'nome', ''), nome),
    cpf               = COALESCE(NULLIF(p_data->>'cpf', ''), cpf),
    rg                = COALESCE(NULLIF(p_data->>'rg', ''), rg),
    data_nascimento   = COALESCE(NULLIF(p_data->>'data_nascimento', '')::date, data_nascimento),
    genero            = COALESCE(NULLIF(p_data->>'genero', ''), genero),
    estado_civil      = COALESCE(NULLIF(p_data->>'estado_civil', ''), estado_civil),
    estado_nascimento = COALESCE(NULLIF(p_data->>'estado_nascimento', ''), estado_nascimento),
    telefone          = COALESCE(NULLIF(p_data->>'telefone', ''), telefone),
    email             = COALESCE(NULLIF(p_data->>'email', ''), email),
    cep               = COALESCE(NULLIF(p_data->>'cep', ''), cep),
    rua               = COALESCE(NULLIF(p_data->>'rua', ''), rua),
    bairro            = COALESCE(NULLIF(p_data->>'bairro', ''), bairro),
    numero            = COALESCE(NULLIF(p_data->>'numero', ''), numero),
    profissao         = COALESCE(NULLIF(p_data->>'profissao', ''), profissao),
    escolaridade      = COALESCE(NULLIF(p_data->>'escolaridade', ''), escolaridade),
    status            = 'registered'
  WHERE token = p_token
    AND deleted_at IS NULL
    AND status = 'pending_registration'
  RETURNING to_jsonb(patients.*) INTO v_result;

  RETURN v_result; -- NULL quando token inválido ou cadastro já concluído
END;
$$;
REVOKE ALL ON FUNCTION public.public_complete_patient_registration(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.public_complete_patient_registration(uuid, jsonb) TO anon, authenticated;
