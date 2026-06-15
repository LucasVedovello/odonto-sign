-- ================================================================
-- Cadastro completo da clínica + aceite de termos (LGPD)
--   • Novas colunas em public.companies para os dados coletados no
--     formulário multi-etapa de cadastro (dados da empresa, endereço,
--     responsável técnico, contato) e o timestamp de aceite dos termos.
--   • handle_new_user() passa a persistir todos esses campos a partir
--     do raw_user_meta_data preenchido no signUp.
-- ================================================================

-- 1. Novas colunas (todas nullable — empresas antigas não as possuem)
ALTER TABLE public.companies
  -- Etapa 1 — Dados da empresa
  ADD COLUMN IF NOT EXISTS razao_social        text,
  ADD COLUMN IF NOT EXISTS nome_fantasia       text,
  ADD COLUMN IF NOT EXISTS cnpj                 text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual   text,
  -- Etapa 2 — Endereço
  ADD COLUMN IF NOT EXISTS cep                  text,
  ADD COLUMN IF NOT EXISTS logradouro           text,
  ADD COLUMN IF NOT EXISTS numero               text,
  ADD COLUMN IF NOT EXISTS complemento          text,
  ADD COLUMN IF NOT EXISTS bairro               text,
  ADD COLUMN IF NOT EXISTS cidade               text,
  ADD COLUMN IF NOT EXISTS uf                   text,
  -- Etapa 3 — Responsável técnico
  ADD COLUMN IF NOT EXISTS responsavel_nome     text,
  ADD COLUMN IF NOT EXISTS responsavel_cro      text,
  ADD COLUMN IF NOT EXISTS responsavel_cro_uf   text,
  -- Etapa 4 — Contato
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS contact_email        text,
  ADD COLUMN IF NOT EXISTS site                 text,
  -- Etapa 6 — Aceite de termos
  ADD COLUMN IF NOT EXISTS accepted_terms_at    timestamptz;

-- 2. handle_new_user — persiste os dados completos no momento do signup.
--    Mantém intacto o fluxo de convite (invite_company_id) e a derivação
--    de username/role já existentes.
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

  RETURN new;
END;
$$;

-- 3. Recarrega o schema cache do PostgREST (novas colunas visíveis na API).
NOTIFY pgrst, 'reload schema';
