-- ================================================================
-- RPCs de Dashboard — agregações no servidor (evita N+1 no client)
--   • clinic_*   : restritas a membros da clínica (owner/dentist)
--   • platform_* : restritas a platform_admin
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- Dashboard da clínica: cards
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinic_dashboard_stats(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id(auth.uid());
  v_from timestamptz := coalesce(p_from, 'epoch'::timestamptz);
  v_to   timestamptz := coalesce(p_to, now() + interval '1 day');
  v_month_start timestamptz := date_trunc('month', now());
  v_today_start timestamptz := date_trunc('day', now());
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Usuário sem clínica';
  END IF;

  RETURN jsonb_build_object(
    'total_patients',     (SELECT count(*) FROM patients WHERE company_id = v_company AND deleted_at IS NULL),
    'new_patients_month', (SELECT count(*) FROM patients WHERE company_id = v_company AND deleted_at IS NULL AND created_at >= v_month_start),
    'new_patients_period',(SELECT count(*) FROM patients WHERE company_id = v_company AND deleted_at IS NULL AND created_at BETWEEN v_from AND v_to),
    'total_appointments', (SELECT count(*) FROM appointments WHERE company_id = v_company AND deleted_at IS NULL),
    'appointments_period',(SELECT count(*) FROM appointments WHERE company_id = v_company AND deleted_at IS NULL AND scheduled_at BETWEEN v_from AND v_to),
    'appointments_month', (SELECT count(*) FROM appointments WHERE company_id = v_company AND deleted_at IS NULL AND scheduled_at >= v_month_start),
    'appointments_today', (SELECT count(*) FROM appointments WHERE company_id = v_company AND deleted_at IS NULL AND scheduled_at >= v_today_start AND scheduled_at < v_today_start + interval '1 day'),
    'total_records',      (SELECT count(*) FROM prontuarios WHERE company_id = v_company AND deleted_at IS NULL),
    'records_period',     (SELECT count(*) FROM prontuarios WHERE company_id = v_company AND deleted_at IS NULL AND created_at BETWEEN v_from AND v_to),
    'active_dentists',    (SELECT count(*) FROM profiles WHERE company_id = v_company AND deleted_at IS NULL AND status = 'active' AND role = 'dentist'),
    'active_users',       (SELECT count(*) FROM profiles WHERE company_id = v_company AND deleted_at IS NULL AND status = 'active'),
    'avg_duration',       (SELECT round(avg(duration_minutes)) FROM appointments WHERE company_id = v_company AND deleted_at IS NULL AND duration_minutes IS NOT NULL AND status = 'finished')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.clinic_dashboard_stats(timestamptz, timestamptz) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da clínica: séries temporais de consultas
--   p_granularity: 'day' | 'week' | 'month'
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinic_appointments_series(
  p_granularity text DEFAULT 'day',
  p_from timestamptz DEFAULT now() - interval '30 days',
  p_to   timestamptz DEFAULT now()
)
RETURNS TABLE (bucket date, total bigint, finished bigint, cancelled bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id(auth.uid());
  v_gran text := CASE WHEN p_granularity IN ('day','week','month') THEN p_granularity ELSE 'day' END;
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Usuário sem clínica'; END IF;
  RETURN QUERY
    SELECT date_trunc(v_gran, a.scheduled_at)::date,
           count(*),
           count(*) FILTER (WHERE a.status = 'finished'),
           count(*) FILTER (WHERE a.status = 'cancelled')
    FROM appointments a
    WHERE a.company_id = v_company AND a.deleted_at IS NULL
      AND a.scheduled_at BETWEEN p_from AND p_to
    GROUP BY 1 ORDER BY 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.clinic_appointments_series(text, timestamptz, timestamptz) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da clínica: novos pacientes por mês + acumulado
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinic_patients_series(p_months int DEFAULT 12)
RETURNS TABLE (month date, new_patients bigint, cumulative bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id(auth.uid());
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Usuário sem clínica'; END IF;
  RETURN QUERY
    WITH months AS (
      SELECT date_trunc('month', now()) - (interval '1 month' * g) AS m
      FROM generate_series(p_months - 1, 0, -1) g
    ),
    counts AS (
      SELECT date_trunc('month', created_at) AS m, count(*) AS c
      FROM patients
      WHERE company_id = v_company AND deleted_at IS NULL
      GROUP BY 1
    )
    SELECT months.m::date,
           coalesce(counts.c, 0),
           (SELECT count(*) FROM patients
            WHERE company_id = v_company AND deleted_at IS NULL
              AND created_at < months.m + interval '1 month')
    FROM months LEFT JOIN counts ON counts.m = months.m
    ORDER BY months.m;
END;
$$;
GRANT EXECUTE ON FUNCTION public.clinic_patients_series(int) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da clínica: desempenho por dentista
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinic_dentist_performance(
  p_from timestamptz DEFAULT 'epoch'::timestamptz,
  p_to   timestamptz DEFAULT now()
)
RETURNS TABLE (dentist_id uuid, dentist_name text, total_appointments bigint, finished_appointments bigint, avg_duration numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id(auth.uid());
BEGIN
  IF v_company IS NULL THEN RAISE EXCEPTION 'Usuário sem clínica'; END IF;
  RETURN QUERY
    SELECT p.id,
           nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), '') AS dentist_name,
           count(a.id),
           count(a.id) FILTER (WHERE a.status = 'finished'),
           round(avg(a.duration_minutes) FILTER (WHERE a.duration_minutes IS NOT NULL), 1)
    FROM profiles p
    LEFT JOIN appointments a
      ON a.dentist_id = p.id AND a.deleted_at IS NULL
      AND a.scheduled_at BETWEEN p_from AND p_to
    WHERE p.company_id = v_company AND p.deleted_at IS NULL AND p.role IN ('dentist','clinic_owner')
    GROUP BY p.id, p.first_name, p.last_name
    ORDER BY count(a.id) DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.clinic_dentist_performance(timestamptz, timestamptz) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da plataforma: cards (apenas platform_admin)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_30d timestamptz := now() - interval '30 days';
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma';
  END IF;

  RETURN jsonb_build_object(
    'total_companies',    (SELECT count(*) FROM companies),
    'approved_companies', (SELECT count(*) FROM companies WHERE approval_status = 'approved'),
    'pending_companies',  (SELECT count(*) FROM companies WHERE approval_status = 'pending'),
    'active_companies',   (SELECT count(DISTINCT company_id) FROM audit_logs WHERE created_at > v_30d AND company_id IS NOT NULL),
    'total_users',        (SELECT count(*) FROM profiles WHERE deleted_at IS NULL),
    'total_dentists',     (SELECT count(*) FROM profiles WHERE deleted_at IS NULL AND role = 'dentist'),
    'total_patients',     (SELECT count(*) FROM patients WHERE deleted_at IS NULL),
    'total_appointments', (SELECT count(*) FROM appointments WHERE deleted_at IS NULL),
    'total_records',      (SELECT count(*) FROM prontuarios WHERE deleted_at IS NULL),
    'avg_duration',       (SELECT round(avg(duration_minutes)) FROM appointments WHERE duration_minutes IS NOT NULL AND status = 'finished'),
    'avg_appointments_per_company', (SELECT round(avg(c), 1) FROM (SELECT count(*) AS c FROM appointments WHERE deleted_at IS NULL GROUP BY company_id) s),
    'avg_patients_per_company',     (SELECT round(avg(c), 1) FROM (SELECT count(*) AS c FROM patients WHERE deleted_at IS NULL GROUP BY company_id) s),
    'unread_alerts',      (SELECT count(*) FROM admin_alerts WHERE is_read = false)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_dashboard_stats() TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da plataforma: crescimento mensal
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_growth_series(p_months int DEFAULT 12)
RETURNS TABLE (month date, new_companies bigint, cumulative_companies bigint, new_users bigint, new_patients bigint, appointments bigint, records bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma';
  END IF;
  RETURN QUERY
    WITH months AS (
      SELECT date_trunc('month', now()) - (interval '1 month' * g) AS m
      FROM generate_series(p_months - 1, 0, -1) g
    )
    SELECT months.m::date,
           (SELECT count(*) FROM companies    WHERE date_trunc('month', created_at) = months.m),
           (SELECT count(*) FROM companies    WHERE created_at < months.m + interval '1 month'),
           (SELECT count(*) FROM profiles     WHERE date_trunc('month', created_at) = months.m),
           (SELECT count(*) FROM patients     WHERE date_trunc('month', created_at) = months.m AND deleted_at IS NULL),
           (SELECT count(*) FROM appointments WHERE date_trunc('month', scheduled_at) = months.m AND deleted_at IS NULL),
           (SELECT count(*) FROM prontuarios  WHERE date_trunc('month', created_at) = months.m AND deleted_at IS NULL)
    FROM months
    ORDER BY months.m;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_growth_series(int) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da plataforma: ranking de atividade por clínica
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_company_activity()
RETURNS TABLE (
  company_id uuid, company_name text, approval_status text,
  users bigint, patients bigint, appointments bigint, records bigint,
  last_activity timestamptz, inactive boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma';
  END IF;
  RETURN QUERY
    SELECT c.id, c.company_name, c.approval_status,
           (SELECT count(*) FROM profiles    p WHERE p.company_id = c.id AND p.deleted_at IS NULL),
           (SELECT count(*) FROM patients    pa WHERE pa.company_id = c.id AND pa.deleted_at IS NULL),
           (SELECT count(*) FROM appointments a WHERE a.company_id = c.id AND a.deleted_at IS NULL),
           (SELECT count(*) FROM prontuarios pr WHERE pr.company_id = c.id AND pr.deleted_at IS NULL),
           greatest(
             coalesce((SELECT max(created_at) FROM audit_logs   WHERE audit_logs.company_id = c.id), 'epoch'::timestamptz),
             coalesce((SELECT max(created_at) FROM patients     WHERE patients.company_id = c.id), 'epoch'::timestamptz),
             coalesce((SELECT max(created_at) FROM appointments WHERE appointments.company_id = c.id), 'epoch'::timestamptz),
             c.created_at
           ),
           greatest(
             coalesce((SELECT max(created_at) FROM audit_logs   WHERE audit_logs.company_id = c.id), 'epoch'::timestamptz),
             coalesce((SELECT max(created_at) FROM patients     WHERE patients.company_id = c.id), 'epoch'::timestamptz),
             coalesce((SELECT max(created_at) FROM appointments WHERE appointments.company_id = c.id), 'epoch'::timestamptz),
             c.created_at
           ) < now() - interval '30 days'
    FROM companies c
    ORDER BY 7 DESC NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_company_activity() TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- Dashboard da plataforma: usuários/dentistas mais ativos
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_top_users(p_days int DEFAULT 30, p_limit int DEFAULT 10)
RETURNS TABLE (user_id uuid, user_name text, user_email text, user_role text, company_name text, actions bigint, last_action timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores da plataforma';
  END IF;
  RETURN QUERY
    SELECT p.id,
           nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
           p.email,
           p.role::text,
           c.company_name,
           count(al.id),
           max(al.created_at)
    FROM audit_logs al
    JOIN profiles p ON p.id = al.user_id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE al.created_at > now() - (interval '1 day' * p_days)
    GROUP BY p.id, p.first_name, p.last_name, p.email, p.role, c.company_name
    ORDER BY count(al.id) DESC
    LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_top_users(int, int) TO authenticated;
