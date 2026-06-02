
-- ============================================================
-- Support tickets table
-- ============================================================
CREATE TABLE public.support_tickets (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES public.profiles(id)  ON DELETE CASCADE NOT NULL,
  company_id UUID        REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  images     TEXT[]      DEFAULT '{}',
  status     TEXT        DEFAULT 'open'
             CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX support_tickets_user_idx    ON public.support_tickets(user_id);
CREATE INDEX support_tickets_company_idx ON public.support_tickets(company_id);
CREATE INDEX support_tickets_status_idx  ON public.support_tickets(status);

-- Users can INSERT and SELECT only their own tickets
CREATE POLICY "Users can insert own tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view and update all tickets
CREATE POLICY "Admins view all tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins update all tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- Storage bucket: support-images (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-images', 'support-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own support images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own support images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins view all support images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-images'
    AND public.is_super_admin(auth.uid())
  );
