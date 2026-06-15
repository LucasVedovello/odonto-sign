-- ================================================================
-- Suporte a múltiplas clínicas por usuário (relação N:N)
--
--   • Nova tabela public.company_users — vínculo usuário↔clínica com
--     papel (role) por clínica. Passa a ser a FONTE DE VERDADE de
--     quais clínicas um usuário pode acessar.
--   • profiles.company_id é MANTIDO, porém passa a representar a
--     "clínica ativa" do usuário (um ponteiro). Toda a RLS existente
--     continua usando get_user_company_id(auth.uid()) = clínica ativa,
--     então nada quebra. A troca de clínica ativa só é permitida para
--     clínicas em company_users (via RPC set_active_company).
--   • RPCs: set_active_company, get_user_companies,
--     create_company_for_current_user, set_company_user_role.
--   • Backfill a partir dos profiles existentes.
--   • handle_new_user passa a popular company_users também.
-- ================================================================

-- 1. Tabela ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role        public.user_role NOT NULL DEFAULT 'clinic_owner',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_user    ON public.company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON public.company_users(company_id);

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- 2. Helpers (SECURITY DEFINER — evitam recursão nas policies) ---
CREATE OR REPLACE FUNCTION public.user_company_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.user_company_ids(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.user_company_ids(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_company_owner(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (
           SELECT 1 FROM public.company_users
           WHERE user_id = _user_id
             AND company_id = _company_id
             AND role = 'clinic_owner'
         );
$$;
REVOKE EXECUTE ON FUNCTION public.is_company_owner(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_company_owner(uuid, uuid) TO authenticated;

-- 3. RLS company_users -------------------------------------------
-- SELECT: o próprio usuário; super admin; e membros da mesma clínica.
DROP POLICY IF EXISTS "cu_select" ON public.company_users;
CREATE POLICY "cu_select" ON public.company_users
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR company_id IN (SELECT public.user_company_ids(auth.uid()))
  );

-- INSERT direto: somente super admin. Usuários comuns inserem via
-- RPCs SECURITY DEFINER (create_company_for_current_user / trigger).
DROP POLICY IF EXISTS "cu_insert" ON public.company_users;
CREATE POLICY "cu_insert" ON public.company_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- UPDATE/DELETE: super admin ou proprietário (clinic_owner) da clínica.
DROP POLICY IF EXISTS "cu_update" ON public.company_users;
CREATE POLICY "cu_update" ON public.company_users
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_company_owner(auth.uid(), company_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_company_owner(auth.uid(), company_id));

DROP POLICY IF EXISTS "cu_delete" ON public.company_users;
CREATE POLICY "cu_delete" ON public.company_users
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_company_owner(auth.uid(), company_id));

-- 4. companies: permitir que membros leiam TODAS as clínicas
--    vinculadas (não apenas a ativa). Política aditiva (OR) à
--    existente "Users can view their company".
DROP POLICY IF EXISTS "Members can view linked companies" ON public.companies;
CREATE POLICY "Members can view linked companies"
  ON public.companies FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_company_ids(auth.uid())));

-- 5. Backfill: cada profile com company_id vira um vínculo. -------
INSERT INTO public.company_users (user_id, company_id, role)
SELECT p.id, p.company_id, p.role
FROM public.profiles p
WHERE p.company_id IS NOT NULL
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 6. Trigger anti-escalação: ganha um bypass controlado por GUC
--    para que RPCs SECURITY DEFINER confiáveis (que já validaram a
--    operação) possam sincronizar profiles.role sem disparar a
--    verificação de permissão.
CREATE OR REPLACE FUNCTION public.prevent_is_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_role    public.user_role;
  v_actor_company uuid;
BEGIN
  -- Bypass confiável (set pelas RPCs set_active_company / set_company_user_role)
  IF current_setting('app.bypass_role_guard', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
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
        NULL; -- owner gerencia roles dentro da própria clínica
      ELSE
        RAISE EXCEPTION 'Sem permissão para alterar funções/permissões';
      END IF;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.is_admin := (NEW.role = 'platform_admin');
    ELSIF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      NEW.role := CASE WHEN NEW.is_admin THEN 'platform_admin'::public.user_role ELSE 'dentist'::public.user_role END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. RPC: trocar a clínica ativa (valida vínculo + aprovação). ----
CREATE OR REPLACE FUNCTION public.set_active_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_role   public.user_role;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT cu.role INTO v_role
  FROM public.company_users cu
  WHERE cu.user_id = v_uid AND cu.company_id = p_company_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não vinculado a esta clínica';
  END IF;

  SELECT approval_status INTO v_status FROM public.companies WHERE id = p_company_id;
  IF coalesce(v_status, 'pending') <> 'approved' THEN
    RAISE EXCEPTION 'Clínica ainda não aprovada';
  END IF;

  PERFORM set_config('app.bypass_role_guard', '1', true);
  UPDATE public.profiles
     SET company_id = p_company_id,
         role       = v_role
   WHERE id = v_uid;
  PERFORM set_config('app.bypass_role_guard', '0', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_active_company(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.set_active_company(uuid) TO authenticated;

-- 8. RPC: clínicas do usuário (detalhes p/ a tela de seleção). ----
CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE (
  company_id      uuid,
  company_name    text,
  nome_fantasia   text,
  cidade          text,
  uf              text,
  role            public.user_role,
  approval_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.company_name, c.nome_fantasia, c.cidade, c.uf, cu.role, c.approval_status
  FROM public.company_users cu
  JOIN public.companies c ON c.id = cu.company_id
  WHERE cu.user_id = auth.uid()
  ORDER BY c.company_name;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_companies() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;

-- 8b. RPC: membros de uma clínica (para gestão de equipe do owner).
--     Permite que owner/membro liste colegas mesmo que a clínica ativa
--     deles seja outra (a RLS de profiles é restrita à clínica ativa).
CREATE OR REPLACE FUNCTION public.get_company_members(p_company_id uuid)
RETURNS TABLE (
  user_id           uuid,
  first_name        text,
  last_name         text,
  email             text,
  profile_image_url text,
  status            text,
  created_at        timestamptz,
  role              public.user_role
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.email, p.profile_image_url,
         p.status, p.created_at, cu.role
  FROM public.company_users cu
  JOIN public.profiles p ON p.id = cu.user_id
  WHERE cu.company_id = p_company_id
    AND (public.is_super_admin(auth.uid()) OR public.is_company_member(auth.uid(), p_company_id))
  ORDER BY p.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_company_members(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_company_members(uuid) TO authenticated;

-- 9. RPC: criar nova clínica vinculada ao usuário logado (pendente).
--    Não cria novo login; apenas insere a empresa (approval_status
--    'pending') e o vínculo em company_users como clinic_owner.
CREATE OR REPLACE FUNCTION public.create_company_for_current_user(p jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_company_id uuid;
  v_email      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- company_email é NOT NULL UNIQUE; usa contact_email se livre, senão gera único.
  v_email := nullif(p->>'contact_email', '');
  IF v_email IS NULL OR EXISTS (SELECT 1 FROM public.companies WHERE company_email = v_email) THEN
    v_email := 'clinic-' || gen_random_uuid()::text || '@odontosign.app';
  END IF;

  INSERT INTO public.companies (
    company_name, company_email,
    razao_social, nome_fantasia, cnpj, inscricao_estadual,
    cep, logradouro, numero, complemento, bairro, cidade, uf,
    responsavel_nome, responsavel_cro, responsavel_cro_uf,
    phone, contact_email, site,
    accepted_terms_at, approval_status
  ) VALUES (
    coalesce(nullif(p->>'nome_fantasia',''), nullif(p->>'razao_social',''), 'Nova clínica'),
    v_email,
    nullif(p->>'razao_social',''),
    nullif(p->>'nome_fantasia',''),
    nullif(p->>'cnpj',''),
    nullif(p->>'inscricao_estadual',''),
    nullif(p->>'cep',''),
    nullif(p->>'logradouro',''),
    nullif(p->>'numero',''),
    nullif(p->>'complemento',''),
    nullif(p->>'bairro',''),
    nullif(p->>'cidade',''),
    nullif(p->>'uf',''),
    nullif(p->>'responsavel_nome',''),
    nullif(p->>'responsavel_cro',''),
    nullif(p->>'responsavel_cro_uf',''),
    nullif(p->>'phone',''),
    nullif(p->>'contact_email',''),
    nullif(p->>'site',''),
    coalesce(nullif(p->>'accepted_terms_at','')::timestamptz, now()),
    'pending'
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_users (user_id, company_id, role)
  VALUES (v_uid, v_company_id, 'clinic_owner')
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RETURN v_company_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_company_for_current_user(jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.create_company_for_current_user(jsonb) TO authenticated;

-- 10. RPC: alterar o papel de um usuário numa clínica (admin/owner).
--     Atualiza company_users e, se for a clínica ativa do usuário,
--     sincroniza profiles.role.
CREATE OR REPLACE FUNCTION public.set_company_user_role(
  p_user_id uuid, p_company_id uuid, p_role public.user_role
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF p_role = 'platform_admin' THEN
    RAISE EXCEPTION 'Não é permitido atribuir platform_admin';
  END IF;
  IF NOT (public.is_super_admin(v_uid) OR public.is_company_owner(v_uid, p_company_id)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar funções nesta clínica';
  END IF;
  IF NOT public.is_company_member(p_user_id, p_company_id) THEN
    RAISE EXCEPTION 'Usuário não pertence a esta clínica';
  END IF;

  UPDATE public.company_users
     SET role = p_role
   WHERE user_id = p_user_id AND company_id = p_company_id;

  -- Sincroniza profiles.role quando esta é a clínica ativa do usuário.
  PERFORM set_config('app.bypass_role_guard', '1', true);
  UPDATE public.profiles
     SET role = p_role
   WHERE id = p_user_id AND company_id = p_company_id;
  PERFORM set_config('app.bypass_role_guard', '0', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_company_user_role(uuid, uuid, public.user_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.set_company_user_role(uuid, uuid, public.user_role) TO authenticated;

-- 11. handle_new_user: além de criar profile, popula company_users.
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
  m                   jsonb;
  v_accepted_at       timestamptz;
BEGIN
  m                   := new.raw_user_meta_data;
  v_company_name      := m->>'company_name';
  v_invite_company_id := nullif(m->>'invite_company_id', '')::uuid;
  v_first_name        := coalesce(m->>'first_name', '');
  v_last_name         := coalesce(m->>'last_name', '');

  IF v_invite_company_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE company_id = v_invite_company_id;

    IF v_count >= 20 THEN
      RAISE EXCEPTION 'Limite de 20 contas atingido para esta empresa';
    END IF;
    v_company_id := v_invite_company_id;
    BEGIN
      v_role := coalesce(nullif(m->>'invite_role', ''), 'dentist')::public.user_role;
    EXCEPTION WHEN invalid_text_representation THEN
      v_role := 'dentist';
    END;
    IF v_role = 'platform_admin' THEN v_role := 'dentist'; END IF;

  ELSIF v_company_name IS NOT NULL AND v_company_name <> '' THEN
    v_accepted_at := coalesce(nullif(m->>'accepted_terms_at', '')::timestamptz, now());

    INSERT INTO public.companies (
      company_name, company_email,
      razao_social, nome_fantasia, cnpj, inscricao_estadual,
      cep, logradouro, numero, complemento, bairro, cidade, uf,
      responsavel_nome, responsavel_cro, responsavel_cro_uf,
      phone, contact_email, site,
      accepted_terms_at
    )
    VALUES (
      v_company_name, new.email,
      nullif(m->>'razao_social', ''),
      nullif(m->>'nome_fantasia', ''),
      nullif(m->>'cnpj', ''),
      nullif(m->>'inscricao_estadual', ''),
      nullif(m->>'cep', ''),
      nullif(m->>'logradouro', ''),
      nullif(m->>'numero', ''),
      nullif(m->>'complemento', ''),
      nullif(m->>'bairro', ''),
      nullif(m->>'cidade', ''),
      nullif(m->>'uf', ''),
      nullif(m->>'responsavel_nome', ''),
      nullif(m->>'responsavel_cro', ''),
      nullif(m->>'responsavel_cro_uf', ''),
      nullif(m->>'phone', ''),
      nullif(m->>'contact_email', ''),
      nullif(m->>'site', ''),
      v_accepted_at
    )
    RETURNING id INTO v_company_id;
    v_role := 'clinic_owner';

  ELSE
    RETURN new;
  END IF;

  v_username_base := left(
    regexp_replace(
      lower(coalesce(nullif(m->>'username', ''), split_part(new.email, '@', 1))),
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

  -- Vínculo N:N (fonte de verdade de acesso às clínicas)
  INSERT INTO public.company_users (user_id, company_id, role)
  VALUES (new.id, v_company_id, v_role)
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RETURN new;
END;
$$;

-- 12. Recarrega o schema cache do PostgREST (novas tabela/funcs).
NOTIFY pgrst, 'reload schema';
