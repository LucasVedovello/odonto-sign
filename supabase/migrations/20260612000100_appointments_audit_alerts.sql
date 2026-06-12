-- ================================================================
-- Consultas (appointments), Auditoria (audit_logs + login_attempts),
-- Alertas administrativos (admin_alerts) e Soft delete
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. APPOINTMENTS — consultas com tempo de atendimento
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  patient_id       uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  dentist_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  prontuario_id    uuid REFERENCES public.prontuarios(id) ON DELETE SET NULL,
  scheduled_at     timestamptz NOT NULL,
  started_at       timestamptz,
  finished_at      timestamptz,
  duration_minutes int,
  status           text NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','in_progress','finished','cancelled','rescheduled')),
  notes            text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_appointments_company   ON public.appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist   ON public.appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient   ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status    ON public.appointments(status);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage appointments"
  ON public.appointments FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Trigger: calcula duration_minutes ao preencher finished_at + updated_at
CREATE OR REPLACE FUNCTION public.fn_appointment_before_update()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.finished_at IS NOT NULL AND (OLD.finished_at IS NULL OR NEW.finished_at IS DISTINCT FROM OLD.finished_at) THEN
    NEW.duration_minutes := greatest(
      0,
      round(extract(epoch FROM (NEW.finished_at - coalesce(NEW.started_at, NEW.scheduled_at))) / 60)::int
    );
    IF NEW.status NOT IN ('cancelled') THEN
      NEW.status := 'finished';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_before_update ON public.appointments;
CREATE TRIGGER trg_appointment_before_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_appointment_before_update();

-- ────────────────────────────────────────────────────────────────
-- 2. SOFT DELETE — deleted_at nas tabelas críticas
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.patients    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.prontuarios ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_patients_deleted    ON public.patients(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prontuarios_deleted ON public.prontuarios(deleted_at) WHERE deleted_at IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. AUDIT LOGS
-- ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'login', 'logout', 'password_reset', 'password_change',
    'patient_create', 'patient_update', 'patient_delete', 'patient_restore',
    'appointment_create', 'appointment_update', 'appointment_reschedule',
    'appointment_cancel', 'appointment_finish', 'appointment_delete',
    'record_create', 'record_update', 'record_sign', 'record_delete', 'record_restore',
    'user_create', 'user_update', 'user_delete', 'permission_change',
    'clinic_settings_update', 'clinic_data_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name   text,
  user_role   text,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type public.audit_action NOT NULL,
  description text,
  ip_address  text,
  user_agent  text,
  device_info text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action  ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- platform_admin vê tudo; clinic_owner vê só a própria clínica
CREATE POLICY "Admins view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Owners view own clinic audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.get_user_role(auth.uid()) = 'clinic_owner'
  );
-- INSERT apenas via funções SECURITY DEFINER (sem policy de INSERT)

-- Helper interno: extrai IP / user-agent dos headers do PostgREST
CREATE OR REPLACE FUNCTION public.fn_request_meta(OUT ip text, OUT ua text, OUT device text)
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  headers json;
BEGIN
  BEGIN
    headers := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;
  ip := coalesce(headers->>'cf-connecting-ip', split_part(coalesce(headers->>'x-forwarded-for', ''), ',', 1));
  ua := headers->>'user-agent';
  device := CASE
    WHEN ua IS NULL THEN NULL
    WHEN ua ILIKE '%android%'                       THEN 'Android'
    WHEN ua ILIKE '%iphone%' OR ua ILIKE '%ipad%'   THEN 'iOS'
    WHEN ua ILIKE '%windows%'                       THEN 'Windows'
    WHEN ua ILIKE '%mac os%' OR ua ILIKE '%macintosh%' THEN 'macOS'
    WHEN ua ILIKE '%linux%'                         THEN 'Linux'
    ELSE 'Outro'
  END;
END;
$$;

-- Núcleo: grava um log de auditoria (uso interno por triggers/RPCs)
CREATE OR REPLACE FUNCTION public.fn_write_audit(
  p_action      public.audit_action,
  p_description text,
  p_company_id  uuid DEFAULT NULL,
  p_user_id     uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := coalesce(p_user_id, auth.uid());
  v_profile record;
  v_meta    record;
BEGIN
  SELECT ip, ua, device INTO v_meta FROM public.fn_request_meta();

  IF v_uid IS NOT NULL THEN
    SELECT first_name, last_name, role, company_id INTO v_profile
    FROM public.profiles WHERE id = v_uid;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_name, user_role, company_id, action_type, description, ip_address, user_agent, device_info)
  VALUES (
    v_uid,
    nullif(trim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), ''),
    v_profile.role::text,
    coalesce(p_company_id, v_profile.company_id),
    p_action,
    p_description,
    v_meta.ip,
    v_meta.ua,
    v_meta.device
  );
EXCEPTION WHEN OTHERS THEN
  -- auditoria nunca deve quebrar a operação principal
  NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_write_audit(public.audit_action, text, uuid, uuid) FROM anon, authenticated, public;

-- RPC pública (autenticada): eventos de auth e ações client-side
CREATE OR REPLACE FUNCTION public.log_audit_event(p_action text, p_description text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.fn_write_audit(p_action::public.audit_action, p_description);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text) TO authenticated;

-- Trigger genérico de auditoria em tabelas críticas
CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action  public.audit_action;
  v_desc    text;
  v_company uuid;
  v_label   text;
BEGIN
  IF TG_TABLE_NAME = 'patients' THEN
    v_company := coalesce(NEW.company_id, OLD.company_id);
    v_label   := coalesce(NEW.nome, OLD.nome, 'sem nome');
    IF    TG_OP = 'INSERT' THEN v_action := 'patient_create'; v_desc := 'Paciente criado: ' || v_label;
    ELSIF TG_OP = 'DELETE' THEN v_action := 'patient_delete'; v_desc := 'Paciente excluído: ' || v_label;
    ELSE
      IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        v_action := 'patient_delete'; v_desc := 'Paciente movido para a lixeira: ' || v_label;
      ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        v_action := 'patient_restore'; v_desc := 'Paciente restaurado: ' || v_label;
      ELSE
        v_action := 'patient_update'; v_desc := 'Paciente atualizado: ' || v_label;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'appointments' THEN
    v_company := coalesce(NEW.company_id, OLD.company_id);
    IF    TG_OP = 'INSERT' THEN v_action := 'appointment_create'; v_desc := 'Consulta criada';
    ELSIF TG_OP = 'DELETE' THEN v_action := 'appointment_delete'; v_desc := 'Consulta excluída';
    ELSE
      IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
        v_action := 'appointment_cancel'; v_desc := 'Consulta cancelada';
      ELSIF NEW.status = 'finished' AND OLD.status <> 'finished' THEN
        v_action := 'appointment_finish';
        v_desc := 'Consulta finalizada (' || coalesce(NEW.duration_minutes::text, '?') || ' min)';
      ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
        v_action := 'appointment_reschedule'; v_desc := 'Consulta remarcada';
      ELSE
        v_action := 'appointment_update'; v_desc := 'Consulta atualizada';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'prontuarios' THEN
    v_company := coalesce(NEW.company_id, OLD.company_id);
    v_label   := coalesce(NEW.nome, OLD.nome, 'sem nome');
    IF    TG_OP = 'INSERT' THEN v_action := 'record_create'; v_desc := 'Prontuário criado: ' || v_label;
    ELSIF TG_OP = 'DELETE' THEN v_action := 'record_delete'; v_desc := 'Prontuário excluído: ' || v_label;
    ELSE
      IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        v_action := 'record_delete'; v_desc := 'Prontuário movido para a lixeira: ' || v_label;
      ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        v_action := 'record_restore'; v_desc := 'Prontuário restaurado: ' || v_label;
      ELSIF NEW.status IN ('signed', 'finalized') AND OLD.status IS DISTINCT FROM NEW.status THEN
        v_action := 'record_sign'; v_desc := 'Prontuário assinado: ' || v_label || ' (' || NEW.status || ')';
      ELSE
        v_action := 'record_update'; v_desc := 'Prontuário atualizado: ' || v_label;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'profiles' THEN
    v_company := coalesce(NEW.company_id, OLD.company_id);
    v_label   := coalesce(NEW.email, OLD.email);
    IF    TG_OP = 'INSERT' THEN v_action := 'user_create'; v_desc := 'Usuário criado: ' || v_label;
    ELSIF TG_OP = 'DELETE' THEN v_action := 'user_delete'; v_desc := 'Usuário excluído: ' || v_label;
    ELSE
      IF NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        v_action := 'permission_change';
        v_desc := 'Permissão alterada: ' || v_label || ' (' || OLD.role::text || ' → ' || NEW.role::text || ')';
      ELSE
        v_action := 'user_update'; v_desc := 'Usuário atualizado: ' || v_label;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'companies' THEN
    v_company := coalesce(NEW.id, OLD.id);
    v_label   := coalesce(NEW.company_name, OLD.company_name);
    IF TG_OP = 'UPDATE' THEN
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        v_action := 'clinic_settings_update';
        v_desc := 'Status de aprovação da clínica ' || v_label || ': ' || coalesce(NEW.approval_status, '—');
      ELSE
        v_action := 'clinic_data_update'; v_desc := 'Dados da clínica atualizados: ' || v_label;
      END IF;
    ELSE
      RETURN coalesce(NEW, OLD);
    END IF;
  ELSE
    RETURN coalesce(NEW, OLD);
  END IF;

  PERFORM public.fn_write_audit(v_action, v_desc, v_company);
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_patients ON public.patients;
CREATE TRIGGER trg_audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_appointments ON public.appointments;
CREATE TRIGGER trg_audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_prontuarios ON public.prontuarios;
CREATE TRIGGER trg_audit_prontuarios
  AFTER INSERT OR UPDATE OR DELETE ON public.prontuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

DROP TRIGGER IF EXISTS trg_audit_companies ON public.companies;
CREATE TRIGGER trg_audit_companies
  AFTER UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

-- ────────────────────────────────────────────────────────────────
-- 4. LOGIN ATTEMPTS — tentativas de login (sucesso/falha)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email      text,
  ip_address text,
  user_agent text,
  success    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email   ON public.login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON public.login_attempts(created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view login attempts"
  ON public.login_attempts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- RPC: registra tentativa (anon pode registrar falhas; sucesso loga auditoria)
CREATE OR REPLACE FUNCTION public.record_login_attempt(p_email text, p_success boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_meta record;
  v_uid  uuid;
BEGIN
  SELECT ip, ua INTO v_meta FROM public.fn_request_meta();
  SELECT id INTO v_uid FROM public.profiles WHERE lower(email) = lower(p_email) LIMIT 1;

  INSERT INTO public.login_attempts (user_id, email, ip_address, user_agent, success)
  VALUES (v_uid, left(p_email, 255), v_meta.ip, v_meta.ua, p_success);

  IF p_success AND auth.uid() IS NOT NULL THEN
    PERFORM public.fn_write_audit('login', 'Login realizado');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. ADMIN ALERTS — alertas administrativos da plataforma
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type  text NOT NULL CHECK (alert_type IN ('inactive_clinic','failed_logins','critical_error','subscription_expiring','blocked_user')),
  severity    text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title       text NOT NULL,
  description text,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint text UNIQUE,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unread ON public.admin_alerts(is_read, created_at DESC);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage alerts"
  ON public.admin_alerts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Gera/atualiza alertas (chamado pelo dashboard admin; idempotente por fingerprint)
CREATE OR REPLACE FUNCTION public.refresh_admin_alerts()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  r record;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma';
  END IF;

  -- 5.1 Clínicas aprovadas sem atividade há mais de 30 dias
  FOR r IN
    SELECT c.id, c.company_name,
           greatest(
             coalesce((SELECT max(created_at) FROM public.audit_logs    WHERE company_id = c.id), 'epoch'::timestamptz),
             coalesce((SELECT max(created_at) FROM public.patients      WHERE company_id = c.id), 'epoch'::timestamptz),
             coalesce((SELECT max(created_at) FROM public.appointments  WHERE company_id = c.id), 'epoch'::timestamptz),
             c.created_at
           ) AS last_activity
    FROM public.companies c
    WHERE c.approval_status = 'approved'
  LOOP
    IF r.last_activity < now() - interval '30 days' THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, company_id, fingerprint)
      VALUES (
        'inactive_clinic', 'warning',
        'Clínica inativa: ' || r.company_name,
        'Sem atividade desde ' || to_char(r.last_activity, 'DD/MM/YYYY'),
        r.id,
        'inactive_clinic:' || r.id::text
      )
      ON CONFLICT (fingerprint) DO NOTHING;
      IF FOUND THEN v_inserted := v_inserted + 1; END IF;
    ELSE
      -- clínica voltou a usar: remove alerta antigo
      DELETE FROM public.admin_alerts WHERE fingerprint = 'inactive_clinic:' || r.id::text;
    END IF;
  END LOOP;

  -- 5.2 Múltiplas tentativas de login inválidas (>= 5 na última hora por email)
  FOR r IN
    SELECT email, count(*) AS attempts, max(created_at) AS last_at
    FROM public.login_attempts
    WHERE success = false AND created_at > now() - interval '1 hour' AND email IS NOT NULL
    GROUP BY email
    HAVING count(*) >= 5
  LOOP
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, fingerprint)
    VALUES (
      'failed_logins', 'critical',
      'Tentativas de login suspeitas: ' || r.email,
      r.attempts || ' tentativas inválidas na última hora (última em ' || to_char(r.last_at, 'DD/MM HH24:MI') || ')',
      'failed_logins:' || r.email || ':' || to_char(r.last_at, 'YYYYMMDDHH24')
    )
    ON CONFLICT (fingerprint) DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  -- 5.3 Usuários bloqueados/inativos
  FOR r IN
    SELECT p.id, p.email, p.company_id
    FROM public.profiles p
    WHERE p.status <> 'active' AND p.deleted_at IS NULL
  LOOP
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, company_id, user_id, fingerprint)
    VALUES (
      'blocked_user', 'info',
      'Usuário bloqueado: ' || r.email,
      'Conta com status diferente de ativo',
      r.company_id, r.id,
      'blocked_user:' || r.id::text
    )
    ON CONFLICT (fingerprint) DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_admin_alerts() TO authenticated;
