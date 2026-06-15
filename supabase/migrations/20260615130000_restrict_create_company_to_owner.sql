-- ================================================================
-- Segurança: create_company_for_current_user só para clinic_owner
--
--   A restrição até aqui era apenas de interface. Esta migration
--   adiciona a verificação SERVER-SIDE na própria RPC: a criação é
--   rejeitada se o usuário autenticado NÃO for clinic_owner em pelo
--   menos um registro de company_users (super admin também pode).
--   Assim, chamadas diretas à API ficam bloqueadas para staff/dentist.
-- ================================================================

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

  -- Apenas proprietários (clinic_owner) podem criar novas clínicas.
  -- Super admin também é permitido (mais privilegiado).
  IF NOT (
    public.is_super_admin(v_uid)
    OR EXISTS (
      SELECT 1 FROM public.company_users
      WHERE user_id = v_uid AND role = 'clinic_owner'
    )
  ) THEN
    RAISE EXCEPTION 'Apenas proprietários de clínica podem cadastrar uma nova clínica';
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

NOTIFY pgrst, 'reload schema';
