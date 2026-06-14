-- ================================================================
-- Fix: erro 400 ao excluir (soft delete) contrato/paciente
--
-- Causa raiz: o trigger de auditoria trg_audit_* -> fn_audit_row()
-- roda em todo UPDATE de patients. fn_write_audit() já engole erros
-- ("auditoria nunca deve quebrar a operação principal"), mas a lógica
-- de fn_audit_row() ANTES do PERFORM (montagem de v_action/v_desc,
-- casts de enum) não estava protegida — qualquer falha ali propagava
-- e o PostgREST devolvia 400, abortando a exclusão.
--
-- Correção:
--   1. fn_audit_row() totalmente à prova de falhas (envolve todo o
--      corpo em EXCEPTION WHEN OTHERS, garantindo que a auditoria
--      jamais quebre a operação principal).
--   2. Reforça a policy de UPDATE de patients com WITH CHECK explícito
--      (clinic_owner da própria company + super admin).
--   3. Recarrega o schema cache do PostgREST.
-- ================================================================

-- 1. Trigger de auditoria à prova de falhas
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
EXCEPTION WHEN OTHERS THEN
  -- A auditoria nunca deve quebrar a operação principal (INSERT/UPDATE/DELETE).
  RETURN coalesce(NEW, OLD);
END;
$$;

-- 2. Policy de UPDATE de patients com WITH CHECK explícito.
--    Permite ao membro da própria clínica (inclui clinic_owner) e ao
--    super admin atualizar/soft-deletar pacientes.
DROP POLICY IF EXISTS "Company members can update patients" ON public.patients;
CREATE POLICY "Company members can update patients"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- 3. Recarrega o schema cache do PostgREST (evita 400 PGRST por cache defasado).
NOTIFY pgrst, 'reload schema';
