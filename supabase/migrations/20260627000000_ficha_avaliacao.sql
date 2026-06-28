-- ============================================================================
-- Ficha de Avaliação (MOD. IOP0037)
--
-- Primeiro módulo do atendimento: o paciente preenche/assina a ficha de
-- avaliação ANTES do prontuário e do contrato. A recepção preenche o
-- formulário (2 páginas), envia para o dentista responsável revisar, a clínica
-- coleta a assinatura do representante e gera um link público para o paciente
-- assinar (mesmo padrão de Contratos/Termos/Prontuários).
--
-- Multi-tenant: tudo escopado por company_id (RLS via profiles).
-- Acesso público (paciente sem login): SOMENTE via RPCs SECURITY DEFINER que
-- exigem o token secreto do link — não há policy anon direta (ver hardening em
-- 20260623194551_fix_rls_anon_policies.sql).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- ── Cabeçalho / paciente ──────────────────────────────────────────────────
  paciente_nome text NOT NULL,
  paciente_telefone text,
  paciente_celular text,
  paciente_data_nascimento date,
  paciente_cpf text,
  paciente_email text,
  origem text,
  avaliador text,
  data_avaliacao date,
  numero_contrato text,
  numero_prontuario text,

  -- ── Dentística ───────────────────────────────────────────────────────────
  dentistica_dentes jsonb DEFAULT '{}',
  dentistica_restauracao_dentes text,
  dentistica_total text,

  -- ── Clareamento / Dessensibilização ──────────────────────────────────────
  clareamento_externo_comum boolean DEFAULT false,
  clareamento_externo_laser boolean DEFAULT false,
  clareamento_externo_apos_ortod boolean DEFAULT false,
  clareamento_externo_apenas_arcada text,
  clareamento_interno text,
  dessensibilizacao_comum boolean DEFAULT false,
  dessensibilizacao_laser boolean DEFAULT false,
  dessensibilizacao_arcada_sup boolean DEFAULT false,
  dessensibilizacao_arcada_inf boolean DEFAULT false,
  dessensibilizacao_obs text,

  -- ── Dentes Decíduos ──────────────────────────────────────────────────────
  deciduos_dentes jsonb DEFAULT '{}',
  deciduos_oclusao_devida text,
  deciduos_cavidade_causal text,
  deciduos_cirurgia_agendada text,
  deciduos_replantacao text,
  deciduos_condicionamento boolean DEFAULT false,
  deciduos_fluor boolean DEFAULT false,
  deciduos_arcada_sup boolean DEFAULT false,
  deciduos_arcada_inf boolean DEFAULT false,

  -- ── Endodontia ───────────────────────────────────────────────────────────
  endodontia_dentes jsonb DEFAULT '{}',
  endodontia_uni_tratamento text,
  endodontia_uni_retratamento text,
  endodontia_bi_tratamento text,
  endodontia_bi_retratamento text,
  endodontia_tri_tratamento text,
  endodontia_tri_retratamento text,
  endodontia_obs boolean DEFAULT false,

  -- ── Periodontia ──────────────────────────────────────────────────────────
  perio_fluor boolean DEFAULT false,
  perio_profilaxia boolean DEFAULT false,
  perio_basica boolean DEFAULT false,
  perio_moderada boolean DEFAULT false,
  perio_avancada boolean DEFAULT false,
  gengivectomia_dentes text,
  gengivectomia_obs boolean DEFAULT false,

  -- ── Núcleo p/ Prótese Fixa ───────────────────────────────────────────────
  nucleo_dentes jsonb DEFAULT '{}',
  nucleo_nos_dentes text,
  nucleo_total text,
  nucleo_material text,

  -- ── Prótese Fixa Definitiva ──────────────────────────────────────────────
  protese_fixa_dentes jsonb DEFAULT '{}',
  protese_fixa_material text,
  protese_elemento_definitivo text,
  protese_onlay_inlay text,
  protese_faceta text,
  protese_lente_contato text,

  -- ── Provisórios ──────────────────────────────────────────────────────────
  provisorios_dentes jsonb DEFAULT '{}',
  provisorios_nos_dentes text,
  provisorios_total text,
  provisorios_material text,
  provisorios_fixado_aparelho boolean DEFAULT false,

  -- ── Página 2 — Prótese Total ─────────────────────────────────────────────
  pt_definitiva_superior boolean DEFAULT false,
  pt_definitiva_inferior boolean DEFAULT false,
  pt_imediata_sup boolean DEFAULT false,
  pt_imediata_inf boolean DEFAULT false,
  pt_nacionais boolean DEFAULT false,
  pt_importados boolean DEFAULT false,

  -- ── PPR ──────────────────────────────────────────────────────────────────
  ppr_definitiva_superior boolean DEFAULT false,
  ppr_definitiva_inferior boolean DEFAULT false,
  ppr_provisoria_sup boolean DEFAULT false,
  ppr_provisoria_inf boolean DEFAULT false,
  ppr_flex_superior boolean DEFAULT false,
  ppr_flex_inferior boolean DEFAULT false,
  ppr_nacionais boolean DEFAULT false,
  ppr_importados boolean DEFAULT false,

  -- ── ATM ──────────────────────────────────────────────────────────────────
  atm_placa_mordida boolean DEFAULT false,
  atm_placa_disfuncao boolean DEFAULT false,

  -- ── Cirurgia ─────────────────────────────────────────────────────────────
  cirurgia_dentes jsonb DEFAULT '{}',
  exodontia_simples text,
  exodontia_raiz text,
  exodontia_semi_incluso text,
  exodontia_incluso text,
  exodontia_erupcionado text,
  cirurgia_frenectomia boolean DEFAULT false,
  cirurgia_biopsia boolean DEFAULT false,
  cirurgia_hiperplasia boolean DEFAULT false,
  cirurgia_regularizacao text,

  -- ── Implante e Prótese sobre Implante ────────────────────────────────────
  implante_dentes jsonb DEFAULT '{}',
  implante_total_superior text,
  implante_total_inferior text,
  implante_coroas_dentes text,
  implante_overdenture_sup boolean DEFAULT false,
  implante_overdenture_inf boolean DEFAULT false,
  implante_protocolo_sup boolean DEFAULT false,
  implante_protocolo_inf boolean DEFAULT false,
  implante_protocolo_carga_sup boolean DEFAULT false,
  implante_protocolo_carga_inf boolean DEFAULT false,
  implante_zigomatico boolean DEFAULT false,
  implante_apos_ortodontia boolean DEFAULT false,
  implante_pinos_importados boolean DEFAULT false,
  implante_guia text,
  implante_enxerto_bloco text,
  implante_enxerto_liofilizado text,
  implante_elevacao_seio text,

  -- ── Opções de tratamento / observações ───────────────────────────────────
  opcao_tratamento_1 text,
  opcao_tratamento_2 text,
  opcao_tratamento_3 text,
  observacoes text,

  -- ── Ortodontia ───────────────────────────────────────────────────────────
  ortod_alinhador boolean DEFAULT false,
  ortod_auto_ligado boolean DEFAULT false,
  ortod_convencional boolean DEFAULT false,
  ortod_ortopedia boolean DEFAULT false,
  ortod_mini_implante text,
  ortod_tracionamento text,
  ortod_cir_ortognatica boolean DEFAULT false,
  ortod_documentacao boolean DEFAULT false,
  ortod_panoramica boolean DEFAULT false,
  braquetes_porcelana boolean DEFAULT false,
  braquetes_safira boolean DEFAULT false,
  braquetes_policarbonato boolean DEFAULT false,
  braquetes_metalico boolean DEFAULT false,

  -- ── Radiografia ──────────────────────────────────────────────────────────
  radio_panoramica boolean DEFAULT false,
  radio_tomografia text,
  radio_periapical text,

  -- ── E.S. / R.V. / R.P. ───────────────────────────────────────────────────
  es_am boolean DEFAULT false,
  es_an boolean DEFAULT false,
  es_ex boolean DEFAULT false,
  es_em boolean DEFAULT false,
  rv_min boolean DEFAULT false,
  rv_med boolean DEFAULT false,
  rv_total boolean DEFAULT false,
  rp_min boolean DEFAULT false,
  rp_med boolean DEFAULT false,
  rp_total boolean DEFAULT false,

  -- ── Assinaturas / fluxo ───────────────────────────────────────────────────
  -- Ciclo de status:
  --   rascunho             → criada, ainda não enviada
  --   aguardando_assinatura→ enviada ao dentista (dentista_id), em revisão / clínica vai assinar
  --   aguardando_paciente  → clínica assinou + link gerado para o paciente
  --   assinado             → paciente assinou
  dentista_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'aguardando_assinatura', 'aguardando_paciente', 'assinado')),
  assinatura_clinica text,                          -- base64 (data URL)
  assinatura_paciente text,                         -- base64 (data URL)
  link_assinatura_token uuid UNIQUE DEFAULT gen_random_uuid(),
  link_assinatura_expira_em timestamptz,
  pdf_url text,
  clinica_assinada_em timestamptz,
  paciente_assinado_em timestamptz,

  -- ── Auditoria / soft delete ───────────────────────────────────────────────
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avaliacoes_company_idx     ON public.avaliacoes(company_id);
CREATE INDEX IF NOT EXISTS avaliacoes_dentista_idx    ON public.avaliacoes(dentista_id);
CREATE INDEX IF NOT EXISTS avaliacoes_token_idx       ON public.avaliacoes(link_assinatura_token);
CREATE INDEX IF NOT EXISTS avaliacoes_deleted_at_idx  ON public.avaliacoes(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- ── RLS: equipe da clínica gerencia as fichas da própria empresa ────────────
-- clinic_owner / staff / dentist da empresa têm acesso (escopo por company_id).
-- A regra "dentista vê só as enviadas para ele" é aplicada na UI; a RLS mantém
-- o escopo multi-tenant (mesmo padrão de prontuarios/contracts).
DROP POLICY IF EXISTS "clinic_access_avaliacoes" ON public.avaliacoes;
CREATE POLICY "clinic_access_avaliacoes"
ON public.avaliacoes FOR ALL
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ── Triggers: updated_at + autoria (reaproveita funções já existentes) ──────
DROP TRIGGER IF EXISTS avaliacoes_set_updated_at ON public.avaliacoes;
CREATE TRIGGER avaliacoes_set_updated_at
  BEFORE UPDATE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.signed_docs_set_updated_at();

DROP TRIGGER IF EXISTS avaliacoes_set_actor ON public.avaliacoes;
CREATE TRIGGER avaliacoes_set_actor
  BEFORE INSERT OR UPDATE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_row_actor();

-- Realtime (a listagem assina postgres_changes).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.avaliacoes;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── RPC pública: leitura da ficha pelo token (anon, via link) ───────────────
-- SECURITY DEFINER ignora a RLS; o filtro pelo token (UUID secreto) é a única
-- forma de obter o registro. Retorna a linha completa (jsonb) ou NULL.
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
     AND a.status IN ('aguardando_paciente', 'assinado');
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.public_get_avaliacao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_get_avaliacao(uuid) TO anon, authenticated;

-- ── RPC pública: assinatura do paciente pelo token (anon) ───────────────────
-- Só assina quando a ficha está aguardando o paciente e o link não expirou.
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
     AND status = 'aguardando_paciente'
     AND deleted_at IS NULL
     AND (link_assinatura_expira_em IS NULL OR link_assinatura_expira_em > now())
  RETURNING to_jsonb(avaliacoes.*) INTO v_result;

  RETURN v_result; -- NULL quando token inválido / status não permite / expirado
END;
$$;
REVOKE ALL ON FUNCTION public.public_sign_avaliacao(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_sign_avaliacao(uuid, text) TO anon, authenticated;

-- ── Expurgo da lixeira: inclui avaliacoes (30 dias) ─────────────────────────
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
  DELETE FROM public.avaliacoes   WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$func$;
