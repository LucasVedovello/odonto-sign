-- ============================================================
-- Prontuários — Ficha de Planejamento (IOP046) +
--               Eventos Efetivamente Realizados (IOP043)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prontuarios (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID        NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  patient_id      UUID        REFERENCES public.patients(id)            ON DELETE SET NULL,

  -- Cabeçalho
  data            DATE,
  planejado_por   TEXT,
  nome            TEXT,
  data_nasc       DATE,
  rg              TEXT,
  endereco        TEXT,
  telefone        TEXT,
  num_prontuario  TEXT,
  num_contrato    TEXT,

  -- Anamnese
  alergico        TEXT, hemorragia      TEXT, diabetes         TEXT, cardiopatia      TEXT,
  esta_gravida    TEXT, prob_respiratorio TEXT, dst_aids_sifilis TEXT, usa_drogas       TEXT,
  fuma            TEXT, bebe            TEXT, gastrointestinal TEXT, cicatrizacao      TEXT,
  hepatite        TEXT, ts_tc           TEXT, convulsivo       TEXT, pressao_arterial  TEXT,
  vigencia_de     TEXT, vigencia_ate    TEXT, medico           TEXT, fone_medico       TEXT,
  medicamentos    TEXT, outro_problema  TEXT, queixa_principal TEXT,

  -- Planejamento
  planejamento_prognostico TEXT,
  cobertura                TEXT,

  -- Arcadas (JSONB): { "18": { "periodontia": true, ... }, ... }
  arcada_superior JSONB DEFAULT '{}',
  arcada_inferior JSONB DEFAULT '{}',

  -- Assinaturas
  assinatura_paciente_planejamento TEXT,
  assinatura_doutor                TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prontuario_eventos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prontuario_id   UUID NOT NULL REFERENCES public.prontuarios(id) ON DELETE CASCADE,
  data            DATE,
  dente           TEXT,
  procedimento    TEXT,
  dentista        TEXT,
  assinatura_paciente TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prontuarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prontuario_eventos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS prontuarios_company_idx      ON public.prontuarios(company_id);
CREATE INDEX IF NOT EXISTS prontuarios_patient_idx      ON public.prontuarios(patient_id);
CREATE INDEX IF NOT EXISTS prontuario_eventos_pront_idx ON public.prontuario_eventos(prontuario_id);

-- Company members can access their own company's prontuarios; admins see all
CREATE POLICY "company_access_prontuarios"
ON public.prontuarios FOR ALL
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "company_access_eventos"
ON public.prontuario_eventos FOR ALL
USING (
  prontuario_id IN (
    SELECT id FROM public.prontuarios
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  )
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
