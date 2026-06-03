-- ============================================================
-- support_messages: bidirecional chat por ticket
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id       UUID        NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES public.profiles(id),
  sender_role     TEXT        NOT NULL CHECK (sender_role IN ('user', 'admin')),
  content         TEXT,
  attachment_url  TEXT,
  attachment_name TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id);

-- Usuário vê mensagens dos próprios tickets
CREATE POLICY "users_read_own_ticket_messages"
ON public.support_messages FOR SELECT
USING (
  ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
);

-- Admin vê tudo
CREATE POLICY "admin_read_all_messages"
ON public.support_messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Usuário insere mensagem no próprio ticket
CREATE POLICY "users_insert_own_messages"
ON public.support_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
);

-- Admin insere em qualquer ticket
CREATE POLICY "admin_insert_messages"
ON public.support_messages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================================
-- Garantir que status existe na support_tickets
-- ============================================================
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'in_progress', 'resolved'));

-- ============================================================
-- Bucket support-attachments (anexos do chat)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated upload support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY "public read support attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'support-attachments');
