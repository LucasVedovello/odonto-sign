-- ================================================================
-- Add `username` to public.profiles
--   • Unique + indexed display handle for each user.
--   • Login continues to use EMAIL — username is NOT used for auth,
--     so there is no public username→email lookup surface.
-- ================================================================

-- 1. Add the column nullable first so existing rows can be backfilled.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username varchar(50);

-- 2. Backfill existing rows from the email local-part, sanitized to
--    [a-z0-9_] and capped to 32 chars. Collisions get a numeric suffix
--    so the UNIQUE index added below never fails.
WITH base AS (
  SELECT
    id,
    left(
      regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]', '_', 'g'),
      32
    ) AS raw
  FROM public.profiles
  WHERE username IS NULL
),
numbered AS (
  SELECT id, raw, row_number() OVER (PARTITION BY raw ORDER BY id) AS rn
  FROM base
)
UPDATE public.profiles p
SET username = CASE WHEN n.rn = 1 THEN n.raw ELSE n.raw || (n.rn - 1)::text END
FROM numbered n
WHERE p.id = n.id;

-- 3. Enforce NOT NULL + UNIQUE.
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 4. Populate username on signup via the existing trigger.
--    Takes the username from user metadata, falls back to the email
--    local-part, sanitizes it, and appends a counter on collision so a
--    taken handle never breaks signup (username is display-only).
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
  v_username_base     text;
  v_username          text;
  v_suffix            int := 0;
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

  -- Derive a sanitized, unique username.
  v_username_base := left(
    regexp_replace(
      lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1))),
      '[^a-z0-9_]', '_', 'g'
    ),
    32
  );
  IF v_username_base = '' THEN
    v_username_base := 'user';
  END IF;

  v_username := v_username_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_suffix := v_suffix + 1;
    v_username := v_username_base || v_suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, company_id, first_name, last_name, email, status, username)
  VALUES (new.id, v_company_id, v_first_name, v_last_name, new.email, 'active', v_username);

  RETURN new;
END;
$$;
