-- ============================================================================
-- RECONSTRUÇÃO DO FLUXO DE DOCUMENTOS ASSINÁVEIS (Contratos + Termos)
--
-- Substitui por completo o antigo fluxo de "contratos" (baseado em formulário /
-- geração de PDF a partir de templates). O novo fluxo é:
--   1. a clínica anexa o PDF original (gerado no sistema da franquia);
--   2. a clínica assina no campo dela e gera um link público;
--   3. o paciente acessa o link, lê o PDF completo e assina no campo dele;
--   4. o PDF final (idêntico ao original + assinaturas sobrepostas) fica
--      disponível para a recepção baixar.
--
-- `contracts` e `terms` têm estrutura IDÊNTICA — mudam apenas a tabela/bucket.
--
-- Decisão do projeto: recriar do zero (não há dados a preservar).
-- ============================================================================

-- ── Remove o fluxo antigo de contratos ──────────────────────────────────────
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.terms CASCADE;

-- ── Função utilitária: mantém updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.signed_docs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Definição comum (aplicada a contracts e terms) ──────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contracts', 'terms'] LOOP
    EXECUTE format($f$
      CREATE TABLE public.%1$I (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
        patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
        patient_name TEXT NOT NULL,
        title TEXT,
        original_pdf_path TEXT NOT NULL,
        signed_pdf_path TEXT,
        status TEXT NOT NULL DEFAULT 'aguardando_clinica'
          CHECK (status IN ('aguardando_clinica', 'aguardando_paciente', 'assinado')),
        public_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        clinic_signature TEXT,
        clinic_signature_pos JSONB,
        patient_signature TEXT,
        patient_signature_pos JSONB,
        clinic_signed_at TIMESTAMPTZ,
        patient_signed_at TIMESTAMPTZ,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    $f$, t);

    EXECUTE format('CREATE INDEX %1$I ON public.%2$I(company_id);', t || '_company_idx', t);
    EXECUTE format('CREATE INDEX %1$I ON public.%2$I(public_token);', t || '_public_token_idx', t);
    EXECUTE format('CREATE INDEX %1$I ON public.%2$I(patient_id);', t || '_patient_idx', t);

    EXECUTE format('ALTER TABLE public.%1$I ENABLE ROW LEVEL SECURITY;', t);

    -- updated_at automático
    EXECUTE format(
      'CREATE TRIGGER %1$I BEFORE UPDATE ON public.%2$I
         FOR EACH ROW EXECUTE FUNCTION public.signed_docs_set_updated_at();',
      t || '_set_updated_at', t);

    -- Acesso da clínica (autenticado) restrito à própria empresa.
    EXECUTE format(
      'CREATE POLICY "clinic_access" ON public.%1$I FOR ALL
         USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
         WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));',
      t);

    -- Acesso público via link (paciente sem login): leitura + atualização.
    -- Mesmo padrão já usado nos links públicos de pacientes.
    EXECUTE format('CREATE POLICY "public_read" ON public.%1$I FOR SELECT USING (TRUE);', t);
    EXECUTE format('CREATE POLICY "public_update" ON public.%1$I FOR UPDATE USING (TRUE);', t);

    -- Realtime: a tela de listagem assina postgres_changes para atualizar ao vivo.
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%1$I;', t);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- publicação ausente ou tabela já incluída: ignora
    END;
  END LOOP;
END $$;

-- ── Storage: buckets para os PDFs (originais + finais assinados) ─────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true), ('terms', 'terms', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública: o link do paciente e o download da recepção usam URL pública.
DROP POLICY IF EXISTS "signed_docs read" ON storage.objects;
CREATE POLICY "signed_docs read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('contracts', 'terms'));

-- Upload: a clínica (autenticada) anexa o original e o paciente (anônimo, via
-- link público) salva o PDF final assinado — por isso TO public.
DROP POLICY IF EXISTS "signed_docs insert" ON storage.objects;
CREATE POLICY "signed_docs insert"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id IN ('contracts', 'terms'));

-- Update (upsert do PDF final assinado).
DROP POLICY IF EXISTS "signed_docs update" ON storage.objects;
CREATE POLICY "signed_docs update"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id IN ('contracts', 'terms'));
