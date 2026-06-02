
-- ============================================================
-- 1. Fix INSERT for non-admin users
--    REVOKE EXECUTE was issued on get_user_company_id in a
--    previous migration, which breaks the INSERT RLS policy
--    for authenticated users. Re-grant it.
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;

-- ============================================================
-- 2. Raise user-per-company limit from 10 → 20
--    Updates the trigger that enforces the cap on new signups
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id        uuid;
  v_company_name      text;
  v_invite_company_id uuid;
  v_first_name        text;
  v_last_name         text;
  v_count             int;
BEGIN
  v_company_name      := new.raw_user_meta_data->>'company_name';
  v_invite_company_id := nullif(new.raw_user_meta_data->>'invite_company_id', '')::uuid;
  v_first_name        := coalesce(new.raw_user_meta_data->>'first_name', '');
  v_last_name         := coalesce(new.raw_user_meta_data->>'last_name', '');

  IF v_invite_company_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE company_id = v_invite_company_id;

    IF v_count >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 contas atingido para esta empresa';
    END IF;
    v_company_id := v_invite_company_id;

  ELSIF v_company_name IS NOT NULL AND v_company_name <> '' THEN
    INSERT INTO public.companies (company_name, company_email)
    VALUES (v_company_name, new.email)
    RETURNING id INTO v_company_id;

  ELSE
    RETURN new;
  END IF;

  INSERT INTO public.profiles (id, company_id, first_name, last_name, email, status)
  VALUES (new.id, v_company_id, v_first_name, v_last_name, new.email, 'active');

  RETURN new;
END;
$$;
