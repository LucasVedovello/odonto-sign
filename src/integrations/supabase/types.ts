export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          alert_type: string
          company_id: string | null
          created_at: string
          description: string | null
          fingerprint: string | null
          id: string
          is_read: boolean
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          fingerprint?: string | null
          id?: string
          is_read?: boolean
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          fingerprint?: string | null
          id?: string
          is_read?: boolean
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          dentist_id: string
          duration_minutes: number | null
          finished_at: string | null
          id: string
          notes: string | null
          patient_id: string
          prontuario_id: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          dentist_id: string
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          prontuario_id?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          dentist_id?: string
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          prontuario_id?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_dentist_id_fkey"
            columns: ["dentist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_prontuario_id_fkey"
            columns: ["prontuario_id"]
            isOneToOne: false
            referencedRelation: "prontuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["audit_action"]
          company_id: string | null
          created_at: string
          description: string | null
          device_info: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["audit_action"]
          company_id?: string | null
          created_at?: string
          description?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["audit_action"]
          company_id?: string | null
          created_at?: string
          description?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accepted_terms_at: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          company_email: string
          company_name: string
          complemento: string | null
          contact_email: string | null
          created_at: string
          deleted_at: string | null
          id: string
          inscricao_estadual: string | null
          last_activity_at: string | null
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          phone: string | null
          razao_social: string | null
          rejection_reason: string | null
          responsavel_cro: string | null
          responsavel_cro_uf: string | null
          responsavel_nome: string | null
          site: string | null
          subscription_expires_at: string | null
          uf: string | null
        }
        Insert: {
          accepted_terms_at?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          company_email: string
          company_name: string
          complemento?: string | null
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          inscricao_estadual?: string | null
          last_activity_at?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          phone?: string | null
          razao_social?: string | null
          rejection_reason?: string | null
          responsavel_cro?: string | null
          responsavel_cro_uf?: string | null
          responsavel_nome?: string | null
          site?: string | null
          subscription_expires_at?: string | null
          uf?: string | null
        }
        Update: {
          accepted_terms_at?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          company_email?: string
          company_name?: string
          complemento?: string | null
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          inscricao_estadual?: string | null
          last_activity_at?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          phone?: string | null
          razao_social?: string | null
          rejection_reason?: string | null
          responsavel_cro?: string | null
          responsavel_cro_uf?: string | null
          responsavel_nome?: string | null
          site?: string | null
          subscription_expires_at?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          assinatura: string | null
          bairro: string | null
          cep: string | null
          company_id: string
          contract_accepted: boolean
          convenio: string | null
          cpf: string | null
          created_at: string
          created_by_user: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          endereco: string | null
          escolaridade: string | null
          estado_civil: string | null
          estado_nascimento: string | null
          id: string
          nome: string | null
          numero: string | null
          procedimentos: string[] | null
          profissao: string | null
          prontuario: string | null
          rg: string | null
          rua: string | null
          signature_data: string | null
          signed_at: string | null
          status: string
          telefone: string | null
          token: string
        }
        Insert: {
          assinatura?: string | null
          bairro?: string | null
          cep?: string | null
          company_id: string
          contract_accepted?: boolean
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          created_by_user?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          estado_nascimento?: string | null
          id?: string
          nome?: string | null
          numero?: string | null
          procedimentos?: string[] | null
          profissao?: string | null
          prontuario?: string | null
          rg?: string | null
          rua?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          telefone?: string | null
          token?: string
        }
        Update: {
          assinatura?: string | null
          bairro?: string | null
          cep?: string | null
          company_id?: string
          contract_accepted?: boolean
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          created_by_user?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          endereco?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          estado_nascimento?: string | null
          id?: string
          nome?: string | null
          numero?: string | null
          procedimentos?: string[] | null
          profissao?: string | null
          prontuario?: string | null
          rg?: string | null
          rua?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string
          telefone?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_user_fkey"
            columns: ["created_by_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string | null
          id: string
          is_admin: boolean
          last_name: string | null
          profile_image_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          username: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_admin?: boolean
          last_name?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          username: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_admin?: boolean
          last_name?: string | null
          profile_image_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_eventos: {
        Row: {
          assinado_em: string | null
          assinado_por: string | null
          assinatura_doutor: string | null
          assinatura_paciente: string | null
          created_at: string | null
          data: string | null
          dente: string | null
          dentista: string | null
          id: string
          procedimento: string | null
          prontuario_id: string
        }
        Insert: {
          assinado_em?: string | null
          assinado_por?: string | null
          assinatura_doutor?: string | null
          assinatura_paciente?: string | null
          created_at?: string | null
          data?: string | null
          dente?: string | null
          dentista?: string | null
          id?: string
          procedimento?: string | null
          prontuario_id: string
        }
        Update: {
          assinado_em?: string | null
          assinado_por?: string | null
          assinatura_doutor?: string | null
          assinatura_paciente?: string | null
          created_at?: string | null
          data?: string | null
          dente?: string | null
          dentista?: string | null
          id?: string
          procedimento?: string | null
          prontuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_eventos_prontuario_id_fkey"
            columns: ["prontuario_id"]
            isOneToOne: false
            referencedRelation: "prontuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuarios: {
        Row: {
          alergico: string | null
          arcada_inferior: Json | null
          arcada_superior: Json | null
          assinatura_doutor: string | null
          assinatura_paciente_planejamento: string | null
          bebe: string | null
          cardiopatia: string | null
          cicatrizacao: string | null
          cobertura: string | null
          company_id: string
          convulsivo: string | null
          created_at: string | null
          data: string | null
          data_nasc: string | null
          deleted_at: string | null
          diabetes: string | null
          dst_aids_sifilis: string | null
          endereco: string | null
          esta_gravida: string | null
          fone_medico: string | null
          fuma: string | null
          gastrointestinal: string | null
          hemorragia: string | null
          hepatite: string | null
          id: string
          initial_signed_at: string | null
          initial_signed_by: string | null
          medicamentos: string | null
          medico: string | null
          nome: string | null
          num_contrato: string | null
          num_prontuario: string | null
          odontograma: Json | null
          outro_problema: string | null
          patient_id: string | null
          planejado_por: string | null
          planejamento_prognostico: string | null
          pressao_arterial: string | null
          prob_respiratorio: string | null
          queixa_principal: string | null
          rg: string | null
          status: string
          telefone: string | null
          ts_tc: string | null
          updated_at: string | null
          usa_drogas: string | null
          vigencia_ate: string | null
          vigencia_de: string | null
        }
        Insert: {
          alergico?: string | null
          arcada_inferior?: Json | null
          arcada_superior?: Json | null
          assinatura_doutor?: string | null
          assinatura_paciente_planejamento?: string | null
          bebe?: string | null
          cardiopatia?: string | null
          cicatrizacao?: string | null
          cobertura?: string | null
          company_id: string
          convulsivo?: string | null
          created_at?: string | null
          data?: string | null
          data_nasc?: string | null
          deleted_at?: string | null
          diabetes?: string | null
          dst_aids_sifilis?: string | null
          endereco?: string | null
          esta_gravida?: string | null
          fone_medico?: string | null
          fuma?: string | null
          gastrointestinal?: string | null
          hemorragia?: string | null
          hepatite?: string | null
          id?: string
          initial_signed_at?: string | null
          initial_signed_by?: string | null
          medicamentos?: string | null
          medico?: string | null
          nome?: string | null
          num_contrato?: string | null
          num_prontuario?: string | null
          odontograma?: Json | null
          outro_problema?: string | null
          patient_id?: string | null
          planejado_por?: string | null
          planejamento_prognostico?: string | null
          pressao_arterial?: string | null
          prob_respiratorio?: string | null
          queixa_principal?: string | null
          rg?: string | null
          status?: string
          telefone?: string | null
          ts_tc?: string | null
          updated_at?: string | null
          usa_drogas?: string | null
          vigencia_ate?: string | null
          vigencia_de?: string | null
        }
        Update: {
          alergico?: string | null
          arcada_inferior?: Json | null
          arcada_superior?: Json | null
          assinatura_doutor?: string | null
          assinatura_paciente_planejamento?: string | null
          bebe?: string | null
          cardiopatia?: string | null
          cicatrizacao?: string | null
          cobertura?: string | null
          company_id?: string
          convulsivo?: string | null
          created_at?: string | null
          data?: string | null
          data_nasc?: string | null
          deleted_at?: string | null
          diabetes?: string | null
          dst_aids_sifilis?: string | null
          endereco?: string | null
          esta_gravida?: string | null
          fone_medico?: string | null
          fuma?: string | null
          gastrointestinal?: string | null
          hemorragia?: string | null
          hepatite?: string | null
          id?: string
          initial_signed_at?: string | null
          initial_signed_by?: string | null
          medicamentos?: string | null
          medico?: string | null
          nome?: string | null
          num_contrato?: string | null
          num_prontuario?: string | null
          odontograma?: Json | null
          outro_problema?: string | null
          patient_id?: string | null
          planejado_por?: string | null
          planejamento_prognostico?: string | null
          pressao_arterial?: string | null
          prob_respiratorio?: string | null
          queixa_principal?: string | null
          rg?: string | null
          status?: string
          telefone?: string | null
          ts_tc?: string | null
          updated_at?: string | null
          usa_drogas?: string | null
          vigencia_ate?: string | null
          vigencia_de?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prontuarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuarios_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string | null
          created_at: string | null
          id: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          images: string[] | null
          message: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          message: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          message?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_request_meta: { Args: never; Returns: Record<string, unknown> }
      fn_write_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_company_id?: string
          p_description: string
          p_user_id?: string
        }
        Returns: undefined
      }
      generate_admin_alerts: { Args: never; Returns: undefined }
      get_clinics_activity_ranking: {
        Args: { p_limit?: number }
        Returns: {
          company_id: string
          company_name: string
          last_activity_at: string
          total_appointments: number
        }[]
      }
      get_clinics_growth: {
        Args: never
        Returns: {
          accumulated: number
          month_label: string
          new_clinics: number
        }[]
      }
      get_inactive_clinics: {
        Args: { p_days?: number }
        Returns: {
          company_id: string
          company_name: string
          last_activity_at: string
        }[]
      }
      get_most_active_users: {
        Args: {
          p_limit?: number
          p_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: {
          total_actions: number
          user_id: string
          user_name: string
        }[]
      }
      get_platform_averages: { Args: never; Returns: Json }
      get_platform_dashboard_stats: { Args: never; Returns: Json }
      get_stats_by_dentist: {
        Args: { p_company_id: string }
        Returns: {
          avg_minutes: number
          dentist_id: string
          dentist_name: string
          total_appointments: number
        }[]
      }
      get_user_company_id:
        | { Args: never; Returns: string }
        | { Args: { _user_id: string }; Returns: string }
      get_user_role:
        | { Args: never; Returns: Database["public"]["Enums"]["user_role"] }
        | {
            Args: { _user_id: string }
            Returns: Database["public"]["Enums"]["user_role"]
          }
      get_users_growth: {
        Args: never
        Returns: {
          month_label: string
          total: number
        }[]
      }
      is_clinic_owner: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: { p_action: string; p_description?: string }
        Returns: undefined
      }
      next_prontuario: { Args: never; Returns: string }
      record_login_attempt: {
        Args: { p_email: string; p_success: boolean }
        Returns: undefined
      }
      refresh_admin_alerts: { Args: never; Returns: number }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "in_progress"
        | "finished"
        | "cancelled"
        | "rescheduled"
      audit_action:
        | "login"
        | "logout"
        | "password_reset"
        | "password_change"
        | "patient_create"
        | "patient_update"
        | "patient_delete"
        | "patient_restore"
        | "appointment_create"
        | "appointment_update"
        | "appointment_reschedule"
        | "appointment_cancel"
        | "appointment_finish"
        | "appointment_delete"
        | "record_create"
        | "record_update"
        | "record_sign"
        | "record_delete"
        | "record_restore"
        | "user_create"
        | "user_update"
        | "user_delete"
        | "permission_change"
        | "clinic_settings_update"
        | "clinic_data_update"
      audit_action_type:
        | "login"
        | "logout"
        | "password_reset"
        | "password_change"
        | "patient_create"
        | "patient_update"
        | "patient_delete"
        | "appointment_create"
        | "appointment_reschedule"
        | "appointment_cancel"
        | "appointment_finish"
        | "record_create"
        | "record_update"
        | "record_sign"
        | "user_create"
        | "user_update"
        | "user_delete"
        | "permission_change"
        | "clinic_settings_update"
        | "clinic_data_update"
      user_role: "platform_admin" | "clinic_owner" | "dentist" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "in_progress",
        "finished",
        "cancelled",
        "rescheduled",
      ],
      audit_action: [
        "login",
        "logout",
        "password_reset",
        "password_change",
        "patient_create",
        "patient_update",
        "patient_delete",
        "patient_restore",
        "appointment_create",
        "appointment_update",
        "appointment_reschedule",
        "appointment_cancel",
        "appointment_finish",
        "appointment_delete",
        "record_create",
        "record_update",
        "record_sign",
        "record_delete",
        "record_restore",
        "user_create",
        "user_update",
        "user_delete",
        "permission_change",
        "clinic_settings_update",
        "clinic_data_update",
      ],
      audit_action_type: [
        "login",
        "logout",
        "password_reset",
        "password_change",
        "patient_create",
        "patient_update",
        "patient_delete",
        "appointment_create",
        "appointment_reschedule",
        "appointment_cancel",
        "appointment_finish",
        "record_create",
        "record_update",
        "record_sign",
        "user_create",
        "user_update",
        "user_delete",
        "permission_change",
        "clinic_settings_update",
        "clinic_data_update",
      ],
      user_role: ["platform_admin", "clinic_owner", "dentist", "staff"],
    },
  },
} as const
