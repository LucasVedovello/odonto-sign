-- ============================================================================
-- Sistema completo de contratos (substitui o fluxo antigo de "contratos")
-- Tabela própria `contracts` — independente de `patients`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_number SERIAL,
  treatment_type TEXT NOT NULL CHECK (treatment_type IN ('protese', 'implante', 'ortodontia', 'alinhador_transparente', 'lente_contato_facetas')),
  has_parcela_facil BOOLEAN DEFAULT FALSE,
  has_compra_programada BOOLEAN DEFAULT FALSE,
  has_pagamento_recorrente BOOLEAN DEFAULT FALSE,
  contratante_nome TEXT,
  contratante_nascimento DATE,
  contratante_cpf TEXT,
  contratante_rg TEXT,
  contratante_profissao TEXT,
  contratante_sexo TEXT,
  contratante_endereco TEXT,
  contratante_telefone TEXT,
  contratante_celular TEXT,
  contratante_email TEXT,
  paciente_nome TEXT,
  paciente_nascimento DATE,
  paciente_cpf TEXT,
  paciente_rg TEXT,
  paciente_profissao TEXT,
  paciente_sexo TEXT,
  paciente_endereco TEXT,
  paciente_telefone TEXT,
  paciente_celular TEXT,
  paciente_email TEXT,
  referencia_1_nome TEXT,
  referencia_1_telefone TEXT,
  referencia_2_nome TEXT,
  referencia_2_telefone TEXT,
  procedimentos JSONB DEFAULT '[]',
  valor_total NUMERIC(10,2),
  desconto NUMERIC(10,2) DEFAULT 0,
  valor_final NUMERIC(10,2),
  valor_ortodontico NUMERIC(10,2) DEFAULT 0,
  valor_nao_ortodontico NUMERIC(10,2) DEFAULT 0,
  documentacao_ortodontica NUMERIC(10,2),
  entrada_tipo TEXT,
  entrada_valor NUMERIC(10,2),
  sinal_valor NUMERIC(10,2),
  parcelamento_tipo TEXT,
  parcelamento_qtd INTEGER,
  parcelamento_valor NUMERIC(10,2),
  vencimento_dia INTEGER,
  venc_primeira_parcela DATE,
  materiais_extras JSONB DEFAULT '[]',
  status TEXT DEFAULT 'aguardando_paciente' CHECK (status IN ('aguardando_paciente', 'aguardando_recepcao', 'aguardando_assinatura_paciente', 'concluido')),
  patient_token UUID DEFAULT gen_random_uuid(),
  signing_token UUID DEFAULT gen_random_uuid(),
  clinic_signature TEXT,
  patient_signature TEXT,
  signed_at TIMESTAMP,
  clinic_signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices úteis para os fluxos de leitura por token e por empresa.
CREATE INDEX IF NOT EXISTS contracts_company_idx ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS contracts_patient_token_idx ON public.contracts(patient_token);
CREATE INDEX IF NOT EXISTS contracts_signing_token_idx ON public.contracts(signing_token);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Acesso da clínica (autenticado) restrito à própria empresa.
DROP POLICY IF EXISTS "clinic_access_contracts" ON public.contracts;
CREATE POLICY "clinic_access_contracts" ON public.contracts
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Acesso público (paciente via link/token) — leitura e atualização.
-- Segue o mesmo padrão já usado em `patients` para os links públicos.
DROP POLICY IF EXISTS "public_patient_access" ON public.contracts;
CREATE POLICY "public_patient_access" ON public.contracts
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_patient_update" ON public.contracts;
CREATE POLICY "public_patient_update" ON public.contracts
  FOR UPDATE USING (TRUE);
