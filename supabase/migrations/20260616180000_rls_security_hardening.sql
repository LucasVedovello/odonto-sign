-- ============================================================================
-- Auditoria de seguranca (multi-tenant): remove policies permissivas
-- "USING (true)" para {anon,authenticated} / {public} que permitiam vazamento
-- de dados entre clinicas e escalonamento de privilegio, substituindo por
-- policies com escopo correto. Aplicado em producao (ref dziinqtztpolawyfbakr).
-- ============================================================================

-- ── PATIENTS ────────────────────────────────────────────────────────────────
-- Os fluxos legitimos ja sao cobertos por "Company members ..." (clinica
-- autenticada) e "Public ... by token" (cadastro publico do paciente, anon).
DROP POLICY IF EXISTS "anyone can select patients" ON public.patients;
DROP POLICY IF EXISTS "anyone can insert patients" ON public.patients;
DROP POLICY IF EXISTS "anyone can update patients" ON public.patients;
DROP POLICY IF EXISTS "anyone can delete patients" ON public.patients;

-- ── PROFILES ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anyone can select profiles" ON public.profiles;
DROP POLICY IF EXISTS "anyone can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "anyone can update profiles" ON public.profiles;

-- Ler o proprio perfil (cobre usuario recem-criado, ainda sem company_id).
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

-- Gerenciar perfis da propria clinica (ex.: dono altera status de um membro)
-- e super admin gerencia qualquer um. Sem vazamento entre clinicas.
DROP POLICY IF EXISTS "Company members update company profiles" ON public.profiles;
CREATE POLICY "Company members update company profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()) OR company_id = get_user_company_id(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()) OR company_id = get_user_company_id(auth.uid()));

-- Inserir o proprio perfil (o trigger handle_new_user e SECURITY DEFINER e
-- nao depende disto; mantido apenas como rede de seguranca).
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ── COMPANIES ───────────────────────────────────────────────────────────────
-- Insert e feito via RPC create_company_for_current_user (SECURITY DEFINER).
DROP POLICY IF EXISTS "anyone can select companies" ON public.companies;
DROP POLICY IF EXISTS "anyone can insert companies" ON public.companies;
DROP POLICY IF EXISTS "anyone can update companies" ON public.companies;

-- Super admin aprova/edita qualquer empresa (painel admin). Donos ja editam a
-- propria via "Users can update their company".
DROP POLICY IF EXISTS "Super admins can update any company" ON public.companies;
CREATE POLICY "Super admins can update any company" ON public.companies
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ── CONTRACTS / TERMS ───────────────────────────────────────────────────────
-- As policies publicas (leitura/assinatura por token) valem apenas para anon.
-- Usuario autenticado usa "clinic_access" (escopo da propria clinica).
DROP POLICY IF EXISTS "public_read" ON public.contracts;
CREATE POLICY "public_read" ON public.contracts FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public_update" ON public.contracts;
CREATE POLICY "public_update" ON public.contracts FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "public_read" ON public.terms;
CREATE POLICY "public_read" ON public.terms FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public_update" ON public.terms;
CREATE POLICY "public_update" ON public.terms FOR UPDATE TO anon USING (true);

-- ── SUPPORT_TICKETS ─────────────────────────────────────────────────────────
-- "allow_all" (USING true) permitia ver/editar tickets de outras clinicas.
DROP POLICY IF EXISTS "allow_all" ON public.support_tickets;
DROP POLICY IF EXISTS "Users manage own tickets" ON public.support_tickets;
CREATE POLICY "Users manage own tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));
