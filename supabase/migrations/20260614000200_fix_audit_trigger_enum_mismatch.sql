-- ================================================================
-- Fix REAL do erro 400 ao excluir/atualizar pacientes (e demais writes
-- auditados). Diagnóstico via Management API contra o banco remoto.
--
-- Causa raiz (schema drift do Lovable):
--   Os triggers trg_audit_{patients,appointments,profiles,prontuarios}
--   no banco remoto apontavam para uma função log_audit_event() (sem
--   args, criada fora das migrations) que monta a ação como enum
--   `audit_action_type`. Mas a coluna audit_logs.action_type é do tipo
--   `audit_action`. No INSERT (contexto de atribuição estrito) os dois
--   enums são incompatíveis:
--     ERROR 42804: column "action_type" is of type audit_action but
--                  expression is of type audit_action_type
--   Resultado: todo INSERT/UPDATE auditado falhava e o PostgREST
--   devolvia 400. (Por isso o fix anterior em fn_audit_row não teve
--   efeito: os triggers sequer chamavam fn_audit_row — só companies
--   chamava.)
--
-- Correção:
--   Repontar os 4 triggers para public.fn_audit_row(), que:
--     • usa fn_write_audit() -> casta para o tipo correto audit_action
--     • é SECURITY DEFINER (bypassa RLS de audit_logs)
--     • é exception-safe (auditoria nunca quebra a operação principal)
--   E remover a função trigger log_audit_event() (sem args) defasada.
--   A sobrecarga log_audit_event(text, text) — RPC usada pelo client —
--   é preservada.
-- ================================================================

-- Repontar triggers para a função correta (AFTER INSERT OR UPDATE OR DELETE)
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

-- Remove a função trigger defasada (sem args). A sobrecarga (text,text)
-- usada como RPC pelo client é mantida.
DROP FUNCTION IF EXISTS public.log_audit_event();

NOTIFY pgrst, 'reload schema';
