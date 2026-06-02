
-- ============================================================
-- Company approval workflow
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_approval_status
  ON public.companies(approval_status);

-- All existing companies are already active — mark them approved
UPDATE public.companies
SET approval_status = 'approved'
WHERE approval_status IS NULL OR approval_status = 'pending';
