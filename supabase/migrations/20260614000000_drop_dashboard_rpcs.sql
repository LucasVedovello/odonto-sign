-- ================================================================
-- Remove o sistema de dashboard: dropa as RPCs de agregação que
-- alimentavam os dashboards da clínica e da plataforma.
-- (criadas em 20260612000200_dashboard_rpcs.sql)
-- ================================================================

-- Dashboard da clínica
DROP FUNCTION IF EXISTS public.clinic_dashboard_stats(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.clinic_appointments_series(text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.clinic_patients_series(int);
DROP FUNCTION IF EXISTS public.clinic_dentist_performance(timestamptz, timestamptz);

-- Dashboard da plataforma
DROP FUNCTION IF EXISTS public.platform_dashboard_stats();
DROP FUNCTION IF EXISTS public.platform_growth_series(int);
DROP FUNCTION IF EXISTS public.platform_company_activity();
DROP FUNCTION IF EXISTS public.platform_top_users(int, int);
