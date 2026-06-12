-- ================================================================
-- RBAC — Sistema de funções (roles)
--   platform_admin : super admin da plataforma (substitui is_admin)
--   clinic_owner   : proprietário da clínica (primeiro usuário)
--   dentist        : dentista (usuários convidados, padrão)
--   staff          : recepção/secretaria (sem acesso a configurações)
--
--   is_admin é mantido por compatibilidade e fica sincronizado com
--   role = 'platform_admin' via trigger.
-- ================================================================

-- 1. Enum de roles
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('platform_admin', 'clinic_owner', 'dentist', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Coluna role em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'dentist';

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. Backfill: is_admin → platform_admin; primeiro usuário de cada
--    empresa → clinic_owner; demais permanecem dentist.
UPDATE public.profiles SET role = 'platform_admin' WHERE is_admin = true;

WITH firsts AS (
  SELECT DISTINCT ON (company_id) id
  FROM public.profiles
  WHERE is_admin = false
  ORDER BY company_id, created_at ASC
)
UPDATE public.profiles p
SET role = 'clinic_owner'
FROM firsts f
WHERE p.id = f.id;

-- 4. Helpers (SECURITY DEFINER para uso em RLS sem recursão)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_clinic_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce((SELECT role IN ('clinic_owner', 'platform_admin') FROM public.profiles WHERE id = _user_id), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_clinic_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_clinic_owner(uuid) TO authenticated;

-- is_super_admin passa a considerar o role também
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT is_admin OR role = 'platform_admin' FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

-- 5. Proteção contra escalação de privilégio (substitui o trigger antigo)
CREATE OR REPLACE FUNCTION public.prevent_is_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_role public.user_role;
  v_actor_company uuid;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- Mudanças vindas de contexto sem usuário (service role / migrations) passam
    IF auth.uid() IS NOT NULL THEN
      SELECT role, company_id INTO v_actor_role, v_actor_company
      FROM public.profiles WHERE id = auth.uid();

      IF v_actor_role = 'platform_admin' THEN
        NULL; -- pode tudo
      ELSIF v_actor_role = 'clinic_owner'
            AND v_actor_company = OLD.company_id
            AND OLD.role <> 'platform_admin'
            AND NEW.role <> 'platform_admin'
            AND NEW.is_admin = false THEN
        NULL; -- owner gerencia roles dentro da própria clínica (exceto platform_admin)
      ELSE
        RAISE EXCEPTION 'Sem permissão para alterar funções/permissões';
      END IF;
    END IF;

    -- Mantém is_admin e role sincronizados
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.is_admin := (NEW.role = 'platform_admin');
    ELSIF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      NEW.role := CASE WHEN NEW.is_admin THEN 'platform_admin'::public.user_role ELSE 'dentist'::public.user_role END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- (o trigger trg_prevent_is_admin_escalation já existe e aponta para esta função)

-- 6. handle_new_user: define role no signup
--    • Criador de empresa → clinic_owner
--    • Convidado → role do metadata do convite (dentist/staff), padrão dentist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  v_role              public.user_role := 'dentist';
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
    BEGIN
      v_role := coalesce(nullif(new.raw_user_meta_data->>'invite_role', ''), 'dentist')::public.user_role;
    EXCEPTION WHEN invalid_text_representation THEN
      v_role := 'dentist';
    END;
    IF v_role = 'platform_admin' THEN v_role := 'dentist'; END IF;

  ELSIF v_company_name IS NOT NULL AND v_company_name <> '' THEN
    INSERT INTO public.companies (company_name, company_email)
    VALUES (v_company_name, new.email)
    RETURNING id INTO v_company_id;
    v_role := 'clinic_owner';

  ELSE
    RETURN new;
  END IF;

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

  INSERT INTO public.profiles (id, company_id, first_name, last_name, email, status, username, role)
  VALUES (new.id, v_company_id, v_first_name, v_last_name, new.email, 'active', v_username, v_role);

  RETURN new;
END;
$$;
