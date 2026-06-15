-- ============================================================
-- Garante o bucket de anexos do suporte (chat + ticket inicial)
--
-- Contexto: o formulário de novo ticket subia imagens para o bucket
-- `support-images`, que NÃO existe no projeto remoto ("Bucket not found"),
-- então os anexos nunca eram enviados. Todo o fluxo de suporte passa a usar
-- `support-attachments` (público). Esta migration é idempotente e garante que
-- o bucket exista, seja público e tenha as policies de upload/leitura — mesmo
-- que a migration original (20260602000000) não tenha sido aplicada no remoto.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Upload: qualquer usuário autenticado (clínica ou admin) pode anexar.
DROP POLICY IF EXISTS "authenticated upload support attachments" ON storage.objects;
CREATE POLICY "authenticated upload support attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

-- Leitura pública: as URLs públicas (getPublicUrl) precisam abrir no chat
-- para os dois lados (clínica e admin).
DROP POLICY IF EXISTS "public read support attachments" ON storage.objects;
CREATE POLICY "public read support attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'support-attachments');
