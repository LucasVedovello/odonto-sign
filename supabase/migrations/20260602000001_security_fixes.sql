-- ================================================================
-- SECURITY FIXES — Run after existing migrations
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Prevent is_admin privilege escalation via UPDATE
--    Non-admins cannot flip their own is_admin flag to true.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_is_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- Only super-admins may change the is_admin column
    IF NOT coalesce((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
      RAISE EXCEPTION 'Unauthorized: is_admin can only be changed by an admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_is_admin_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_is_admin_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_is_admin_escalation();

-- ----------------------------------------------------------------
-- 2. Admins can UPDATE any company (required for approval workflow)
--    Without this, approval actions silently fail for other companies.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update any company" ON public.companies;
CREATE POLICY "Admins can update any company"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------
-- 3. Admins can DELETE any company
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can delete any company" ON public.companies;
CREATE POLICY "Admins can delete any company"
  ON public.companies FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------
-- 4. Admins can UPDATE any profile (needed for status/admin management)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------
-- 5. Admin DELETE on support_tickets
--    Without this, the delete button in admin chat silently fails.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins delete all tickets" ON public.support_tickets;
CREATE POLICY "Admins delete all tickets"
  ON public.support_tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ----------------------------------------------------------------
-- 6. Users can only DELETE their own pending (unsigned) tickets
--    Prevents deletion of already-processed tickets by the user.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users delete own open tickets" ON public.support_tickets;
CREATE POLICY "Users delete own open tickets"
  ON public.support_tickets FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'open'
  );

-- ----------------------------------------------------------------
-- 7. Restrict patients DELETE to company members + admins only
--    (Extra safety: no anon DELETE, which old migrations allowed)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "anyone can delete" ON public.patients;

-- ----------------------------------------------------------------
-- 8. Lock down companies INSERT to trigger/admin only
--    Regular authenticated users cannot directly INSERT companies.
--    Companies are created via the handle_new_user trigger (SECURITY DEFINER).
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Companies admin insert" ON public.companies;
CREATE POLICY "Companies admin insert"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ----------------------------------------------------------------
-- 9. Re-grant get_user_company_id to authenticated (belt + suspenders)
--    Needed for RLS policies that call this helper.
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;
