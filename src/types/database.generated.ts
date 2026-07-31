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
      academic_years: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          is_current: boolean
          name: string
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          is_current?: boolean
          name: string
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          is_current?: boolean
          name?: string
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          module: string
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          reason: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          module: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          module?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          reason?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_templates: {
        Row: {
          class_id: string
          component_code: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          end_time: string
          ended_by: string | null
          id: string
          is_active: boolean
          learning_mode: string
          meeting_url: string | null
          room_name: string | null
          start_time: string
          supersedes_schedule_template_id: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          class_id: string
          component_code?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          end_reason?: string | null
          end_time: string
          ended_by?: string | null
          id?: string
          is_active?: boolean
          learning_mode: string
          meeting_url?: string | null
          room_name?: string | null
          start_time: string
          supersedes_schedule_template_id?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          class_id?: string
          component_code?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          end_reason?: string | null
          end_time?: string
          ended_by?: string | null
          id?: string
          is_active?: boolean
          learning_mode?: string
          meeting_url?: string | null
          room_name?: string | null
          start_time?: string
          supersedes_schedule_template_id?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_templates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_templates_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_templates_supersedes_schedule_template_id_fkey"
            columns: ["supersedes_schedule_template_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_id: string
          completed_at: string | null
          completed_by: string | null
          component_code: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          learning_mode: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          makeup_for_session_id: string | null
          meeting_url: string | null
          notes: string | null
          room_name: string | null
          schedule_template_id: string | null
          session_date: string
          session_kind: string
          start_time: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          class_id: string
          completed_at?: string | null
          completed_by?: string | null
          component_code?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          learning_mode: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          makeup_for_session_id?: string | null
          meeting_url?: string | null
          notes?: string | null
          room_name?: string | null
          schedule_template_id?: string | null
          session_date: string
          session_kind?: string
          start_time: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          class_id?: string
          completed_at?: string | null
          completed_by?: string | null
          component_code?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          learning_mode?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          makeup_for_session_id?: string | null
          meeting_url?: string | null
          notes?: string | null
          room_name?: string | null
          schedule_template_id?: string | null
          session_date?: string
          session_kind?: string
          start_time?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_makeup_for_session_id_fkey"
            columns: ["makeup_for_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_schedule_template_id_fkey"
            columns: ["schedule_template_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year_id: string
          classin_url: string | null
          code: string
          created_at: string
          created_by: string | null
          default_learning_mode: string
          grade: number
          id: string
          level: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          weekly_session_count: number
        }
        Insert: {
          academic_year_id: string
          classin_url?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          default_learning_mode?: string
          grade: number
          id?: string
          level: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          weekly_session_count?: number
        }
        Update: {
          academic_year_id?: string
          classin_url?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          default_learning_mode?: string
          grade?: number
          id?: string
          level?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          weekly_session_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_record_events: {
        Row: {
          coaching_record_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
          occurred_at: string
          occurred_by: string
          outcome: string | null
          status: string | null
        }
        Insert: {
          coaching_record_id: string
          created_at?: string
          event_type: string
          id?: string
          note?: string | null
          occurred_at?: string
          occurred_by: string
          outcome?: string | null
          status?: string | null
        }
        Update: {
          coaching_record_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          occurred_at?: string
          occurred_by?: string
          outcome?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_record_events_coaching_record_id_fkey"
            columns: ["coaching_record_id"]
            isOneToOne: false
            referencedRelation: "coaching_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_record_events_occurred_by_fkey"
            columns: ["occurred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_records: {
        Row: {
          assistant_owner_id: string
          campaign_name: string
          created_at: string
          id: string
          opened_at: string
          opened_by: string
          priority: string
          reason: string
          review_at: string | null
          student_id: string
        }
        Insert: {
          assistant_owner_id: string
          campaign_name: string
          created_at?: string
          id?: string
          opened_at?: string
          opened_by: string
          priority: string
          reason: string
          review_at?: string | null
          student_id: string
        }
        Update: {
          assistant_owner_id?: string
          campaign_name?: string
          created_at?: string
          id?: string
          opened_at?: string
          opened_by?: string
          priority?: string
          reason?: string
          review_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_records_assistant_owner_id_fkey"
            columns: ["assistant_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_records_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cases: {
        Row: {
          birth_year: number
          created_at: string
          created_by: string | null
          discount_notes: string | null
          expected_grade: number
          expected_level: string | null
          expected_mode: string | null
          expected_official_start_date: string | null
          expected_tuition_fee_vnd: number | null
          full_name: string
          guardian_full_name: string
          guardian_id: string | null
          guardian_phone: string
          guardian_relationship: string
          id: string
          lead_source_id: string | null
          nickname: string | null
          notes: string | null
          province_city: string | null
          public_code: string
          sale_owner_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          birth_year: number
          created_at?: string
          created_by?: string | null
          discount_notes?: string | null
          expected_grade: number
          expected_level?: string | null
          expected_mode?: string | null
          expected_official_start_date?: string | null
          expected_tuition_fee_vnd?: number | null
          full_name: string
          guardian_full_name: string
          guardian_id?: string | null
          guardian_phone: string
          guardian_relationship?: string
          id?: string
          lead_source_id?: string | null
          nickname?: string | null
          notes?: string | null
          province_city?: string | null
          public_code: string
          sale_owner_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number
          created_at?: string
          created_by?: string | null
          discount_notes?: string | null
          expected_grade?: number
          expected_level?: string | null
          expected_mode?: string | null
          expected_official_start_date?: string | null
          expected_tuition_fee_vnd?: number | null
          full_name?: string
          guardian_full_name?: string
          guardian_id?: string | null
          guardian_phone?: string
          guardian_relationship?: string
          id?: string
          lead_source_id?: string | null
          nickname?: string | null
          notes?: string | null
          province_city?: string | null
          public_code?: string
          sale_owner_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cases_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cases_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cases_sale_owner_id_fkey"
            columns: ["sale_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_assignment_history: {
        Row: {
          assigned_by: string | null
          assignment_method: string
          created_at: string
          crm_case_id: string
          id: string
          new_sale_owner_id: string
          previous_sale_owner_id: string | null
          reason: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_method: string
          created_at?: string
          crm_case_id: string
          id?: string
          new_sale_owner_id: string
          previous_sale_owner_id?: string | null
          reason: string
        }
        Update: {
          assigned_by?: string | null
          assignment_method?: string
          created_at?: string
          crm_case_id?: string
          id?: string
          new_sale_owner_id?: string
          previous_sale_owner_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_assignment_history_crm_case_id_fkey"
            columns: ["crm_case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_assignment_history_new_sale_owner_id_fkey"
            columns: ["new_sale_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_assignment_history_previous_sale_owner_id_fkey"
            columns: ["previous_sale_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_sources: {
        Row: {
          code: string
          created_at: string
          group_code: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          group_code: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          group_code?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      crm_trial_bookings: {
        Row: {
          class_session_id: string | null
          created_at: string
          created_by: string | null
          crm_case_id: string
          id: string
          learning_mode: string
          sale_notes: string | null
          status: string
          teacher_feedback: string | null
          trial_date: string
          updated_at: string
        }
        Insert: {
          class_session_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_case_id: string
          id?: string
          learning_mode: string
          sale_notes?: string | null
          status?: string
          teacher_feedback?: string | null
          trial_date: string
          updated_at?: string
        }
        Update: {
          class_session_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_case_id?: string
          id?: string
          learning_mode?: string
          sale_notes?: string | null
          status?: string
          teacher_feedback?: string | null
          trial_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_trial_bookings_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_trial_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_trial_bookings_crm_case_id_fkey"
            columns: ["crm_case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cashflow_records: {
        Row: {
          amount_vnd: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          record_type: string
          reference_code: string
          sepay_transaction_id: string | null
          student_id: string | null
        }
        Insert: {
          amount_vnd: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          record_type: string
          reference_code: string
          sepay_transaction_id?: string | null
          student_id?: string | null
        }
        Update: {
          amount_vnd?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          record_type?: string
          reference_code?: string
          sepay_transaction_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_cashflow_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cashflow_records_sepay_transaction_id_fkey"
            columns: ["sepay_transaction_id"]
            isOneToOne: false
            referencedRelation: "sepay_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cashflow_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fee_policies: {
        Row: {
          area_code: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          learning_mode: string
          name: string
          standard_unit_price_vnd: number
        }
        Insert: {
          area_code?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          learning_mode: string
          name: string
          standard_unit_price_vnd: number
        }
        Update: {
          area_code?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          learning_mode?: string
          name?: string
          standard_unit_price_vnd?: number
        }
        Relationships: []
      }
      grading_credits: {
        Row: {
          class_session_id: string
          credit_units: number
          credited_at: string
          credited_by: string
          grader_id: string
          id: string
          session_result_id: string
          student_id: string
        }
        Insert: {
          class_session_id: string
          credit_units?: number
          credited_at?: string
          credited_by: string
          grader_id: string
          id?: string
          session_result_id: string
          student_id: string
        }
        Update: {
          class_session_id?: string
          credit_units?: number
          credited_at?: string
          credited_by?: string
          grader_id?: string
          id?: string
          session_result_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_credits_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_credits_credited_by_fkey"
            columns: ["credited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_credits_grader_id_fkey"
            columns: ["grader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_credits_session_result_id_fkey"
            columns: ["session_result_id"]
            isOneToOne: true
            referencedRelation: "session_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_credits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          normalized_phone: string | null
          notes: string | null
          phone: string
          updated_at: string
          zalo: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          normalized_phone?: string | null
          notes?: string | null
          phone: string
          updated_at?: string
          zalo?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          normalized_phone?: string | null
          notes?: string | null
          phone?: string
          updated_at?: string
          zalo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          created_at: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string | null
          event_code: string
          href: string | null
          id: string
          message: string
          metadata: Json
          read_at: string | null
          recipient_user_id: string
          title: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          dedupe_key: string
          entity_id?: string | null
          entity_type?: string | null
          event_code: string
          href?: string | null
          id?: string
          message: string
          metadata?: Json
          read_at?: string | null
          recipient_user_id: string
          title: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          dedupe_key?: string
          entity_id?: string | null
          entity_type?: string | null
          event_code?: string
          href?: string | null
          id?: string
          message?: string
          metadata?: Json
          read_at?: string | null
          recipient_user_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_split_allocations: {
        Row: {
          allocated_amount_vnd: number
          allocated_by: string | null
          allocated_sessions: number
          bonus_sessions: number
          created_at: string
          credit_lot_id: string | null
          guardian_id: string
          id: string
          notes: string | null
          sepay_transaction_id: string
          student_id: string
          unit_price_vnd: number
        }
        Insert: {
          allocated_amount_vnd: number
          allocated_by?: string | null
          allocated_sessions: number
          bonus_sessions?: number
          created_at?: string
          credit_lot_id?: string | null
          guardian_id: string
          id?: string
          notes?: string | null
          sepay_transaction_id: string
          student_id: string
          unit_price_vnd: number
        }
        Update: {
          allocated_amount_vnd?: number
          allocated_by?: string | null
          allocated_sessions?: number
          bonus_sessions?: number
          created_at?: string
          credit_lot_id?: string | null
          guardian_id?: string
          id?: string
          notes?: string | null
          sepay_transaction_id?: string
          student_id?: string
          unit_price_vnd?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_split_allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_split_allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "student_credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_split_allocations_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_split_allocations_sepay_transaction_id_fkey"
            columns: ["sepay_transaction_id"]
            isOneToOne: false
            referencedRelation: "sepay_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_split_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_line_items: {
        Row: {
          amount_vnd: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          line_type: string
          note: string | null
          payroll_statement_id: string
          salary_advance_id: string | null
          source_time_entry_id: string | null
          staff_rate_version_id: string | null
          unit_count: number | null
          unit_rate_vnd: number | null
        }
        Insert: {
          amount_vnd: number
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          line_type: string
          note?: string | null
          payroll_statement_id: string
          salary_advance_id?: string | null
          source_time_entry_id?: string | null
          staff_rate_version_id?: string | null
          unit_count?: number | null
          unit_rate_vnd?: number | null
        }
        Update: {
          amount_vnd?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          line_type?: string
          note?: string | null
          payroll_statement_id?: string
          salary_advance_id?: string | null
          source_time_entry_id?: string | null
          staff_rate_version_id?: string | null
          unit_count?: number | null
          unit_rate_vnd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_line_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_items_payroll_statement_id_fkey"
            columns: ["payroll_statement_id"]
            isOneToOne: false
            referencedRelation: "payroll_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_items_salary_advance_id_fkey"
            columns: ["salary_advance_id"]
            isOneToOne: false
            referencedRelation: "salary_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_items_source_time_entry_id_fkey"
            columns: ["source_time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_line_items_staff_rate_version_id_fkey"
            columns: ["staff_rate_version_id"]
            isOneToOne: false
            referencedRelation: "staff_rate_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          generated_at: string
          generated_by: string
          id: string
          pay_date: string
          period_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          pay_date: string
          period_month: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          pay_date?: string
          period_month?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_statements: {
        Row: {
          created_at: string
          id: string
          payroll_period_id: string
          staff_display_name_snapshot: string
          staff_employee_code_snapshot: string | null
          staff_id: string
          work_hours: number
          work_units: number
        }
        Insert: {
          created_at?: string
          id?: string
          payroll_period_id: string
          staff_display_name_snapshot: string
          staff_employee_code_snapshot?: string | null
          staff_id: string
          work_hours?: number
          work_units?: number
        }
        Update: {
          created_at?: string
          id?: string
          payroll_period_id?: string
          staff_display_name_snapshot?: string
          staff_employee_code_snapshot?: string | null
          staff_id?: string
          work_hours?: number
          work_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_statements_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_statements_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          module: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          module: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          module?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          employee_code: string | null
          employment_status: string
          id: string
          joined_at: string | null
          last_login_at: string | null
          left_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          employee_code?: string | null
          employment_status?: string
          id: string
          joined_at?: string | null
          last_login_at?: string | null
          left_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          employee_code?: string | null
          employment_status?: string
          id?: string
          joined_at?: string | null
          last_login_at?: string | null
          left_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_advances: {
        Row: {
          amount_vnd: number
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          deducted_at: string | null
          deduction_payroll_period_id: string | null
          deduction_period_month: string
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_note: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string
        }
        Insert: {
          amount_vnd: number
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          deducted_at?: string | null
          deduction_payroll_period_id?: string | null
          deduction_period_month: string
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_note: string
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          amount_vnd?: number
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          deducted_at?: string | null
          deduction_payroll_period_id?: string | null
          deduction_period_month?: string
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_note?: string
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_advances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_deduction_payroll_period_id_fkey"
            columns: ["deduction_payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_commission_accruals: {
        Row: {
          created_at: string
          crm_case_id: string
          id: string
          lead_source_code: string
          lead_source_group: string
          lead_source_name: string
          recognized_at: string
          recognized_by: string | null
          recognized_revenue_vnd: number
          sale_owner_id: string
          source_cashflow_record_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          crm_case_id: string
          id?: string
          lead_source_code: string
          lead_source_group: string
          lead_source_name: string
          recognized_at: string
          recognized_by?: string | null
          recognized_revenue_vnd: number
          sale_owner_id: string
          source_cashflow_record_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          crm_case_id?: string
          id?: string
          lead_source_code?: string
          lead_source_group?: string
          lead_source_name?: string
          recognized_at?: string
          recognized_by?: string | null
          recognized_revenue_vnd?: number
          sale_owner_id?: string
          source_cashflow_record_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_commission_accruals_crm_case_id_fkey"
            columns: ["crm_case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_accruals_recognized_by_fkey"
            columns: ["recognized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_accruals_sale_owner_id_fkey"
            columns: ["sale_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_accruals_source_cashflow_record_id_fkey"
            columns: ["source_cashflow_record_id"]
            isOneToOne: true
            referencedRelation: "finance_cashflow_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_commission_accruals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_transactions: {
        Row: {
          account_number: string
          amount_vnd: number
          bank_brand: string
          bank_transaction_id: string
          created_at: string
          id: string
          match_status: string
          matched_at: string | null
          matched_by: string | null
          matched_payment_request_id: string | null
          matched_student_id: string | null
          sepay_webhook_id: string | null
          transaction_at: string
          transfer_content: string
        }
        Insert: {
          account_number: string
          amount_vnd: number
          bank_brand: string
          bank_transaction_id: string
          created_at?: string
          id?: string
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_request_id?: string | null
          matched_student_id?: string | null
          sepay_webhook_id?: string | null
          transaction_at: string
          transfer_content: string
        }
        Update: {
          account_number?: string
          amount_vnd?: number
          bank_brand?: string
          bank_transaction_id?: string
          created_at?: string
          id?: string
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_request_id?: string | null
          matched_student_id?: string | null
          sepay_webhook_id?: string | null
          transaction_at?: string
          transfer_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepay_transactions_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepay_transactions_matched_payment_request_id_fkey"
            columns: ["matched_payment_request_id"]
            isOneToOne: false
            referencedRelation: "student_payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepay_transactions_matched_student_id_fkey"
            columns: ["matched_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepay_transactions_sepay_webhook_id_fkey"
            columns: ["sepay_webhook_id"]
            isOneToOne: false
            referencedRelation: "sepay_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_webhooks: {
        Row: {
          account_number: string
          accumulated: number | null
          amount_in: number
          amount_out: number
          body_raw: Json
          code: string | null
          content: string
          created_at: string
          error_message: string | null
          gateway: string
          id: string
          processed_at: string | null
          processing_status: string
          reference_number: string | null
          sepay_id: number | null
          transaction_date: string
          transfer_type: string
        }
        Insert: {
          account_number: string
          accumulated?: number | null
          amount_in?: number
          amount_out?: number
          body_raw: Json
          code?: string | null
          content: string
          created_at?: string
          error_message?: string | null
          gateway: string
          id?: string
          processed_at?: string | null
          processing_status?: string
          reference_number?: string | null
          sepay_id?: number | null
          transaction_date: string
          transfer_type: string
        }
        Update: {
          account_number?: string
          accumulated?: number | null
          amount_in?: number
          amount_out?: number
          body_raw?: Json
          code?: string | null
          content?: string
          created_at?: string
          error_message?: string | null
          gateway?: string
          id?: string
          processed_at?: string | null
          processing_status?: string
          reference_number?: string | null
          sepay_id?: number | null
          transaction_date?: string
          transfer_type?: string
        }
        Relationships: []
      }
      session_attendance: {
        Row: {
          actual_learning_mode: string
          attendance_status: string
          class_session_id: string
          created_at: string
          id: string
          is_late_update: boolean
          marked_at: string
          marked_by: string
          notes: string | null
          student_enrollment_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          actual_learning_mode: string
          attendance_status: string
          class_session_id: string
          created_at?: string
          id?: string
          is_late_update?: boolean
          marked_at?: string
          marked_by: string
          notes?: string | null
          student_enrollment_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          actual_learning_mode?: string
          attendance_status?: string
          class_session_id?: string
          created_at?: string
          id?: string
          is_late_update?: boolean
          marked_at?: string
          marked_by?: string
          notes?: string | null
          student_enrollment_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      session_results: {
        Row: {
          class_session_id: string
          comment: string | null
          created_at: string
          created_by: string
          graded_at: string | null
          graded_by: string | null
          id: string
          notebook_score: number | null
          notebook_status: string
          student_id: string
          test_score: number | null
          updated_at: string
        }
        Insert: {
          class_session_id: string
          comment?: string | null
          created_at?: string
          created_by: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          notebook_score?: number | null
          notebook_status?: string
          student_id: string
          test_score?: number | null
          updated_at?: string
        }
        Update: {
          class_session_id?: string
          comment?: string | null
          created_at?: string
          created_by?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          notebook_score?: number | null
          notebook_status?: string
          student_id?: string
          test_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_results_attendance_fk"
            columns: ["class_session_id", "student_id"]
            isOneToOne: true
            referencedRelation: "session_attendance"
            referencedColumns: ["class_session_id", "student_id"]
          },
          {
            foreignKeyName: "session_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_rate_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          note: string | null
          offline_hourly_rate_vnd: number
          online_hourly_rate_vnd: number | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          note?: string | null
          offline_hourly_rate_vnd: number
          online_hourly_rate_vnd?: number | null
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          note?: string | null
          offline_hourly_rate_vnd?: number
          online_hourly_rate_vnd?: number | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_rate_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_rate_versions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shift_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          is_active: boolean
          staff_id: string
          supersedes_staff_shift_assignment_id: string | null
          updated_at: string
          weekday: number
          work_shift_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          is_active?: boolean
          staff_id: string
          supersedes_staff_shift_assignment_id?: string | null
          updated_at?: string
          weekday: number
          work_shift_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          is_active?: boolean
          staff_id?: string
          supersedes_staff_shift_assignment_id?: string | null
          updated_at?: string
          weekday?: number
          work_shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shift_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_assignments_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_assignments_supersedes_staff_shift_assignment__fkey"
            columns: ["supersedes_staff_shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shift_assignments_work_shift_id_fkey"
            columns: ["work_shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      student_credit_lots: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          payment_request_id: string | null
          remaining_sessions: number
          sepay_transaction_id: string | null
          status: string
          student_id: string
          topup_type: string
          total_bonus_sessions: number
          total_purchased_sessions: number
          total_sessions: number
          unit_price_vnd: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          payment_request_id?: string | null
          remaining_sessions: number
          sepay_transaction_id?: string | null
          status?: string
          student_id: string
          topup_type?: string
          total_bonus_sessions?: number
          total_purchased_sessions: number
          total_sessions: number
          unit_price_vnd: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          payment_request_id?: string | null
          remaining_sessions?: number
          sepay_transaction_id?: string | null
          status?: string
          student_id?: string
          topup_type?: string
          total_bonus_sessions?: number
          total_purchased_sessions?: number
          total_sessions?: number
          unit_price_vnd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_credit_lots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_credit_lots_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "student_payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_credit_lots_sepay_transaction_id_fkey"
            columns: ["sepay_transaction_id"]
            isOneToOne: false
            referencedRelation: "sepay_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollment_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          crm_case_id: string | null
          id: string
          is_fully_completed: boolean
          item_1_payment_received: boolean
          item_10_communication_group_ready: boolean
          item_2_source_confirmed: boolean
          item_3_sale_confirmed: boolean
          item_4_class_selected: boolean
          item_5_mode_confirmed: boolean
          item_6_fee_confirmed: boolean
          item_7_assistant_sessions_confirmed: boolean
          item_8_accountant_transaction_confirmed: boolean
          item_9_official_start_date_entered: boolean
          student_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          crm_case_id?: string | null
          id?: string
          is_fully_completed?: boolean
          item_1_payment_received?: boolean
          item_10_communication_group_ready?: boolean
          item_2_source_confirmed?: boolean
          item_3_sale_confirmed?: boolean
          item_4_class_selected?: boolean
          item_5_mode_confirmed?: boolean
          item_6_fee_confirmed?: boolean
          item_7_assistant_sessions_confirmed?: boolean
          item_8_accountant_transaction_confirmed?: boolean
          item_9_official_start_date_entered?: boolean
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          crm_case_id?: string | null
          id?: string
          is_fully_completed?: boolean
          item_1_payment_received?: boolean
          item_10_communication_group_ready?: boolean
          item_2_source_confirmed?: boolean
          item_3_sale_confirmed?: boolean
          item_4_class_selected?: boolean
          item_5_mode_confirmed?: boolean
          item_6_fee_confirmed?: boolean
          item_7_assistant_sessions_confirmed?: boolean
          item_8_accountant_transaction_confirmed?: boolean
          item_9_official_start_date_entered?: boolean
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollment_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_checklists_crm_case_id_fkey"
            columns: ["crm_case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_checklists_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          class_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          registered_mode: string
          start_reason: string | null
          started_by: string | null
          status: string
          student_id: string
          supersedes_enrollment_id: string | null
          transition_kind: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          registered_mode: string
          start_reason?: string | null
          started_by?: string | null
          status?: string
          student_id: string
          supersedes_enrollment_id?: string | null
          transition_kind?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          registered_mode?: string
          start_reason?: string | null
          started_by?: string | null
          status?: string
          student_id?: string
          supersedes_enrollment_id?: string | null
          transition_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_supersedes_enrollment_id_fkey"
            columns: ["supersedes_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          guardian_id: string
          id: string
          is_primary: boolean
          linked_at: string
          linked_by: string | null
          relationship: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          guardian_id: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          linked_by?: string | null
          relationship: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          guardian_id?: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          linked_by?: string | null
          relationship?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_import_batches: {
        Row: {
          committed_at: string
          committed_by: string
          guardian_created_count: number
          guardian_reused_count: number
          id: string
          metadata: Json
          reason: string
          row_count: number
          source_filename: string
          source_sha256: string
          student_count: number
        }
        Insert: {
          committed_at?: string
          committed_by: string
          guardian_created_count: number
          guardian_reused_count: number
          id?: string
          metadata?: Json
          reason: string
          row_count: number
          source_filename: string
          source_sha256: string
          student_count: number
        }
        Update: {
          committed_at?: string
          committed_by?: string
          guardian_created_count?: number
          guardian_reused_count?: number
          id?: string
          metadata?: Json
          reason?: string
          row_count?: number
          source_filename?: string
          source_sha256?: string
          student_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_import_batches_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payment_requests: {
        Row: {
          bonus_sessions: number
          calculated_unit_price_vnd: number
          created_at: string
          created_by: string | null
          crm_case_id: string | null
          expected_amount_vnd: number
          guardian_id: string | null
          id: string
          notes: string | null
          paid_amount_vnd: number
          paid_at: string | null
          public_code: string
          purchased_sessions: number
          qr_payload_url: string | null
          status: string
          student_id: string | null
          topup_type: string
          transfer_code: string
          updated_at: string
        }
        Insert: {
          bonus_sessions?: number
          calculated_unit_price_vnd: number
          created_at?: string
          created_by?: string | null
          crm_case_id?: string | null
          expected_amount_vnd: number
          guardian_id?: string | null
          id?: string
          notes?: string | null
          paid_amount_vnd?: number
          paid_at?: string | null
          public_code: string
          purchased_sessions: number
          qr_payload_url?: string | null
          status?: string
          student_id?: string | null
          topup_type?: string
          transfer_code: string
          updated_at?: string
        }
        Update: {
          bonus_sessions?: number
          calculated_unit_price_vnd?: number
          created_at?: string
          created_by?: string | null
          crm_case_id?: string | null
          expected_amount_vnd?: number
          guardian_id?: string | null
          id?: string
          notes?: string | null
          paid_amount_vnd?: number
          paid_at?: string | null
          public_code?: string
          purchased_sessions?: number
          qr_payload_url?: string | null
          status?: string
          student_id?: string | null
          topup_type?: string
          transfer_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payment_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_requests_crm_case_id_fkey"
            columns: ["crm_case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_requests_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_payment_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_session_ledger_entries: {
        Row: {
          class_session_id: string | null
          created_at: string
          created_by: string | null
          delta_sessions: number
          effective_on: string
          entry_type: string
          event_key: string
          id: string
          metadata: Json
          note: string
          reference_code: string | null
          reverses_entry_id: string | null
          session_attendance_id: string | null
          student_enrollment_id: string | null
          student_id: string
          transfer_group_id: string | null
          unit_price_vnd: number | null
        }
        Insert: {
          class_session_id?: string | null
          created_at?: string
          created_by?: string | null
          delta_sessions: number
          effective_on: string
          entry_type: string
          event_key: string
          id?: string
          metadata?: Json
          note: string
          reference_code?: string | null
          reverses_entry_id?: string | null
          session_attendance_id?: string | null
          student_enrollment_id?: string | null
          student_id: string
          transfer_group_id?: string | null
          unit_price_vnd?: number | null
        }
        Update: {
          class_session_id?: string | null
          created_at?: string
          created_by?: string | null
          delta_sessions?: number
          effective_on?: string
          entry_type?: string
          event_key?: string
          id?: string
          metadata?: Json
          note?: string
          reference_code?: string | null
          reverses_entry_id?: string | null
          session_attendance_id?: string | null
          student_enrollment_id?: string | null
          student_id?: string
          transfer_group_id?: string | null
          unit_price_vnd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_session_ledger_entries_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "student_session_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "student_session_ledger_running_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_session_attendance_id_fkey"
            columns: ["session_attendance_id"]
            isOneToOne: false
            referencedRelation: "session_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_year: number
          created_at: string
          created_by: string | null
          current_grade: number
          full_name: string
          id: string
          internal_notes: string | null
          learning_goal: string | null
          learning_level: string | null
          lifecycle_status: string
          nickname: string | null
          official_start_date: string | null
          province_city: string | null
          public_code: string
          registered_mode: string | null
          updated_at: string
        }
        Insert: {
          birth_year: number
          created_at?: string
          created_by?: string | null
          current_grade: number
          full_name: string
          id?: string
          internal_notes?: string | null
          learning_goal?: string | null
          learning_level?: string | null
          lifecycle_status?: string
          nickname?: string | null
          official_start_date?: string | null
          province_city?: string | null
          public_code?: string
          registered_mode?: string | null
          updated_at?: string
        }
        Update: {
          birth_year?: number
          created_at?: string
          created_by?: string | null
          current_grade?: number
          full_name?: string
          id?: string
          internal_notes?: string | null
          learning_goal?: string | null
          learning_level?: string | null
          lifecycle_status?: string
          nickname?: string | null
          official_start_date?: string | null
          province_city?: string | null
          public_code?: string
          registered_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          auto_ended_at: string | null
          check_in_at: string
          check_in_mode: string
          check_out_at: string | null
          check_out_mode: string | null
          created_at: string
          id: string
          staff_id: string
          staff_shift_assignment_id: string
          status: string
          updated_at: string
          work_date: string
        }
        Insert: {
          auto_ended_at?: string | null
          check_in_at: string
          check_in_mode: string
          check_out_at?: string | null
          check_out_mode?: string | null
          created_at?: string
          id?: string
          staff_id: string
          staff_shift_assignment_id: string
          status?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          auto_ended_at?: string | null
          check_in_at?: string
          check_in_mode?: string
          check_out_at?: string | null
          check_out_mode?: string | null
          created_at?: string
          id?: string
          staff_id?: string
          staff_shift_assignment_id?: string
          status?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_staff_shift_assignment_id_fkey"
            columns: ["staff_shift_assignment_id"]
            isOneToOne: false
            referencedRelation: "staff_shift_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_adjustment_requests: {
        Row: {
          created_at: string
          decision_reason: string | null
          id: string
          original_check_in_at: string
          original_check_in_mode: string
          original_check_out_at: string
          original_check_out_mode: string
          request_reason: string
          requested_check_in_at: string
          requested_check_in_mode: string
          requested_check_out_at: string
          requested_check_out_mode: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_entry_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_reason?: string | null
          id?: string
          original_check_in_at: string
          original_check_in_mode: string
          original_check_out_at: string
          original_check_out_mode: string
          request_reason: string
          requested_check_in_at: string
          requested_check_in_mode: string
          requested_check_out_at: string
          requested_check_out_mode: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_entry_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_reason?: string | null
          id?: string
          original_check_in_at?: string
          original_check_in_mode?: string
          original_check_out_at?: string
          original_check_out_mode?: string
          request_reason?: string
          requested_check_in_at?: string
          requested_check_in_mode?: string
          requested_check_out_at?: string
          requested_check_out_mode?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_adjustment_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_adjustment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_adjustment_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_evidence: {
        Row: {
          captured_at: string
          created_at: string
          event_type: string
          evidence_type: string
          gps_accuracy_meters: number | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          time_entry_id: string
          wifi_bssid: string | null
          wifi_ssid: string | null
        }
        Insert: {
          captured_at?: string
          created_at?: string
          event_type: string
          evidence_type: string
          gps_accuracy_meters?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          time_entry_id: string
          wifi_bssid?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          captured_at?: string
          created_at?: string
          event_type?: string
          evidence_type?: string
          gps_accuracy_meters?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          time_entry_id?: string
          wifi_bssid?: string | null
          wifi_ssid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_evidence_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_reason: string | null
          created_at: string
          id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_reason?: string | null
          created_at?: string
          id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_reason?: string | null
          created_at?: string
          id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shifts: {
        Row: {
          break_minutes: number
          code: string
          created_at: string
          created_by: string | null
          crosses_midnight: boolean
          end_time: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          code: string
          created_at?: string
          created_by?: string | null
          crosses_midnight?: boolean
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          code?: string
          created_at?: string
          created_by?: string | null
          crosses_midnight?: boolean
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      student_session_balance_alerts: {
        Row: {
          alert_type: string | null
          balance_sessions: number | null
          description: string | null
          severity: string | null
          student_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_session_ledger_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_session_balances: {
        Row: {
          balance_sessions: number | null
          latest_entry_at: string | null
          ledger_entry_count: number | null
          student_id: string | null
          total_credit_sessions: number | null
          total_debit_sessions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_session_ledger_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_session_ledger_running_balances: {
        Row: {
          balance_after: number | null
          class_session_id: string | null
          created_at: string | null
          created_by: string | null
          delta_sessions: number | null
          effective_on: string | null
          entry_type: string | null
          event_key: string | null
          id: string | null
          metadata: Json | null
          note: string | null
          reference_code: string | null
          reverses_entry_id: string | null
          session_attendance_id: string | null
          student_enrollment_id: string | null
          student_id: string | null
          transfer_group_id: string | null
          unit_price_vnd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_session_ledger_entries_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "student_session_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "student_session_ledger_running_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_session_attendance_id_fkey"
            columns: ["session_attendance_id"]
            isOneToOne: false
            referencedRelation: "session_attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_session_ledger_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_academic_year: {
        Args: { p_academic_year_id: string; p_reason: string }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          is_current: boolean
          name: string
          starts_on: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "academic_years"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_payroll_manual_line: {
        Args: {
          p_amount_vnd: number
          p_line_type: string
          p_note: string
          p_payroll_statement_id: string
        }
        Returns: {
          amount_vnd: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          line_type: string
          note: string | null
          payroll_statement_id: string
          salary_advance_id: string | null
          source_time_entry_id: string | null
          staff_rate_version_id: string | null
          unit_count: number | null
          unit_rate_vnd: number | null
        }
        SetofOptions: {
          from: "*"
          to: "payroll_line_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      allocate_payment_to_students: {
        Args: {
          p_allocations: Json
          p_guardian_id: string
          p_sepay_transaction_id: string
        }
        Returns: Json
      }
      approve_payroll_period: {
        Args: { p_payroll_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          generated_at: string
          generated_by: string
          id: string
          pay_date: string
          period_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_salary_advance: {
        Args: {
          p_decision: string
          p_note: string
          p_salary_advance_id: string
        }
        Returns: {
          amount_vnd: number
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          deducted_at: string | null
          deduction_payroll_period_id: string | null
          deduction_period_month: string
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_note: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "salary_advances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_user_role: {
        Args: {
          assignment_reason: string
          target_role_code: string
          target_user_id: string
        }
        Returns: {
          assigned_at: string
          assignment_id: string
          role_code: string
          role_id: string
          user_id: string
        }[]
      }
      auto_end_stale_teaching_assistant_time_entries: {
        Args: never
        Returns: number
      }
      book_crm_trial_session: {
        Args: {
          p_class_session_id?: string
          p_crm_case_id: string
          p_learning_mode: string
          p_sale_notes?: string
          p_trial_date: string
        }
        Returns: {
          class_session_id: string | null
          created_at: string
          created_by: string | null
          crm_case_id: string
          id: string
          learning_mode: string
          sale_notes: string | null
          status: string
          teacher_feedback: string | null
          trial_date: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_trial_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_class_session: {
        Args: { p_class_session_id: string; p_reason: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_id: string
          completed_at: string | null
          completed_by: string | null
          component_code: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          learning_mode: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          makeup_for_session_id: string | null
          meeting_url: string | null
          notes: string | null
          room_name: string | null
          schedule_template_id: string | null
          session_date: string
          session_kind: string
          start_time: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_academic_year_status: {
        Args: {
          p_academic_year_id: string
          p_reason: string
          p_target_status: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          is_current: boolean
          name: string
          starts_on: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "academic_years"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_class_status: {
        Args: { p_class_id: string; p_reason: string; p_target_status: string }
        Returns: {
          academic_year_id: string
          classin_url: string | null
          code: string
          created_at: string
          created_by: string | null
          default_learning_mode: string
          grade: number
          id: string
          level: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          weekly_session_count: number
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_in_time_entry: {
        Args: {
          p_gps_accuracy_meters: number
          p_gps_latitude: number
          p_gps_longitude: number
          p_mode: string
          p_wifi_bssid: string
          p_wifi_ssid: string
        }
        Returns: {
          auto_ended_at: string | null
          check_in_at: string
          check_in_mode: string
          check_out_at: string | null
          check_out_mode: string | null
          created_at: string
          id: string
          staff_id: string
          staff_shift_assignment_id: string
          status: string
          updated_at: string
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out_time_entry: {
        Args: {
          p_gps_accuracy_meters: number
          p_gps_latitude: number
          p_gps_longitude: number
          p_mode: string
          p_wifi_bssid: string
          p_wifi_ssid: string
        }
        Returns: {
          auto_ended_at: string | null
          check_in_at: string
          check_in_mode: string
          check_out_at: string | null
          check_out_mode: string | null
          created_at: string
          id: string
          staff_id: string
          staff_shift_assignment_id: string
          status: string
          updated_at: string
          work_date: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_student_import_rows: {
        Args: {
          p_reason: string
          p_rows: Json
          p_source_filename: string
          p_source_sha256: string
        }
        Returns: Json
      }
      complete_class_session: {
        Args: { p_class_session_id: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_id: string
          completed_at: string | null
          completed_by: string | null
          component_code: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          learning_mode: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          makeup_for_session_id: string | null
          meeting_url: string | null
          notes: string | null
          room_name: string | null
          schedule_template_id: string | null
          session_date: string
          session_kind: string
          start_time: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_crm_case_to_official_student: {
        Args: {
          p_checklist_items?: Json
          p_class_id: string
          p_crm_case_id: string
          p_official_start_date: string
          p_registered_mode: string
        }
        Returns: {
          birth_year: number
          created_at: string
          created_by: string | null
          current_grade: number
          full_name: string
          id: string
          internal_notes: string | null
          learning_goal: string | null
          learning_level: string | null
          lifecycle_status: string
          nickname: string | null
          official_start_date: string | null
          province_city: string | null
          public_code: string
          registered_mode: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "students"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_academic_year: {
        Args: {
          p_code: string
          p_ends_on: string
          p_name: string
          p_starts_on: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          is_current: boolean
          name: string
          starts_on: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "academic_years"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_class: {
        Args: {
          p_academic_year_id: string
          p_classin_url: string
          p_code: string
          p_default_learning_mode: string
          p_grade: number
          p_level: string
          p_name: string
          p_notes: string
          p_weekly_session_count: number
        }
        Returns: {
          academic_year_id: string
          classin_url: string | null
          code: string
          created_at: string
          created_by: string | null
          default_learning_mode: string
          grade: number
          id: string
          level: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          weekly_session_count: number
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_class_schedule_template: {
        Args: {
          p_class_id: string
          p_component_code: string
          p_effective_from: string
          p_end_time: string
          p_learning_mode: string
          p_meeting_url: string
          p_room_name: string
          p_start_time: string
          p_weekday: number
        }
        Returns: {
          class_id: string
          component_code: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          end_time: string
          ended_by: string | null
          id: string
          is_active: boolean
          learning_mode: string
          meeting_url: string | null
          room_name: string | null
          start_time: string
          supersedes_schedule_template_id: string | null
          updated_at: string
          weekday: number
        }
        SetofOptions: {
          from: "*"
          to: "class_schedule_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_class_session: {
        Args: {
          p_class_id: string
          p_component_code?: string
          p_end_time?: string
          p_learning_mode?: string
          p_makeup_for_session_id?: string
          p_meeting_url?: string
          p_notes?: string
          p_room_name?: string
          p_schedule_template_id?: string
          p_session_date: string
          p_session_kind: string
          p_start_time?: string
        }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_id: string
          completed_at: string | null
          completed_by: string | null
          component_code: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          learning_mode: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          makeup_for_session_id: string | null
          meeting_url: string | null
          notes: string | null
          room_name: string | null
          schedule_template_id: string | null
          session_date: string
          session_kind: string
          start_time: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_crm_case: {
        Args: {
          p_birth_year: number
          p_discount_notes?: string
          p_expected_grade: number
          p_expected_level?: string
          p_expected_mode?: string
          p_expected_tuition_fee_vnd?: number
          p_full_name: string
          p_guardian_full_name: string
          p_guardian_phone: string
          p_lead_source_code: string
          p_notes?: string
          p_province_city?: string
          p_sale_owner_id?: string
        }
        Returns: {
          birth_year: number
          created_at: string
          created_by: string | null
          discount_notes: string | null
          expected_grade: number
          expected_level: string | null
          expected_mode: string | null
          expected_official_start_date: string | null
          expected_tuition_fee_vnd: number | null
          full_name: string
          guardian_full_name: string
          guardian_id: string | null
          guardian_phone: string
          guardian_relationship: string
          id: string
          lead_source_id: string | null
          nickname: string | null
          notes: string | null
          province_city: string | null
          public_code: string
          sale_owner_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payroll_draft: {
        Args: { p_period_month: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          generated_at: string
          generated_by: string
          id: string
          pay_date: string
          period_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_rate_version: {
        Args: {
          p_effective_from: string
          p_note: string
          p_offline_hourly_rate_vnd: number
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          created_at: string
          effective_from: string
          id: string
          note: string
          offline_hourly_rate_vnd: number
          online_hourly_rate_vnd: number
          staff_id: string
        }[]
      }
      create_staff_shift_assignment: {
        Args: {
          p_effective_from: string
          p_reason: string
          p_staff_id: string
          p_weekday: number
          p_work_shift_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          is_active: boolean
          staff_id: string
          supersedes_staff_shift_assignment_id: string | null
          updated_at: string
          weekday: number
          work_shift_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_shift_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_student_payment_request: {
        Args: {
          p_bonus_sessions?: number
          p_calculated_unit_price_vnd?: number
          p_expected_amount_vnd: number
          p_notes?: string
          p_purchased_sessions: number
          p_student_id: string
          p_topup_type?: string
        }
        Returns: Json
      }
      create_student_with_primary_guardian: {
        Args: {
          p_birth_year: number
          p_current_grade: number
          p_duplicate_override_reason: string
          p_full_name: string
          p_guardian_email: string
          p_guardian_full_name: string
          p_guardian_notes: string
          p_guardian_phone: string
          p_guardian_relationship: string
          p_guardian_zalo: string
          p_internal_notes: string
          p_learning_goal: string
          p_learning_level: string
          p_nickname: string
          p_province_city: string
          p_reason: string
          p_registered_mode: string
        }
        Returns: {
          guardian_id: string
          guardian_reused: boolean
          student_id: string
          student_public_code: string
        }[]
      }
      create_work_shift: {
        Args: {
          p_break_minutes: number
          p_code: string
          p_crosses_midnight: boolean
          p_end_time: string
          p_name: string
          p_notes: string
          p_reason: string
          p_start_time: string
        }
        Returns: {
          break_minutes: number
          code: string
          created_at: string
          created_by: string | null
          crosses_midnight: boolean
          end_time: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_time: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "work_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_time_entry_adjustment: {
        Args: {
          p_decision: string
          p_decision_reason: string
          p_time_entry_adjustment_request_id: string
        }
        Returns: {
          created_at: string
          decision_reason: string | null
          id: string
          original_check_in_at: string
          original_check_in_mode: string
          original_check_out_at: string
          original_check_out_mode: string
          request_reason: string
          requested_check_in_at: string
          requested_check_in_mode: string
          requested_check_out_at: string
          requested_check_out_mode: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_entry_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entry_adjustment_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_class_schedule_template: {
        Args: {
          p_effective_to: string
          p_reason: string
          p_schedule_template_id: string
        }
        Returns: {
          class_id: string
          component_code: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          end_time: string
          ended_by: string | null
          id: string
          is_active: boolean
          learning_mode: string
          meeting_url: string | null
          room_name: string | null
          start_time: string
          supersedes_schedule_template_id: string | null
          updated_at: string
          weekday: number
        }
        SetofOptions: {
          from: "*"
          to: "class_schedule_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_staff_shift_assignment: {
        Args: {
          p_effective_to: string
          p_reason: string
          p_staff_shift_assignment_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          is_active: boolean
          staff_id: string
          supersedes_staff_shift_assignment_id: string | null
          updated_at: string
          weekday: number
          work_shift_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_shift_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enroll_student_in_class: {
        Args: {
          p_class_id: string
          p_effective_from: string
          p_reason: string
          p_registered_mode: string
          p_student_id: string
        }
        Returns: {
          class_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          registered_mode: string
          start_reason: string | null
          started_by: string | null
          status: string
          student_id: string
          supersedes_enrollment_id: string | null
          transition_kind: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_student_form_duplicates: {
        Args: {
          p_birth_year: number
          p_full_name: string
          p_guardian_phone: string
          p_student_id: string
        }
        Returns: {
          guardian_full_name: string
          guardian_id: string
          guardian_phone: string
          is_exact_student_duplicate: boolean
          linked_student_birth_year: number
          linked_student_full_name: string
          linked_student_id: string
          linked_student_lifecycle_status: string
          linked_student_public_code: string
        }[]
      }
      get_coaching_record_detail: {
        Args: { p_coaching_record_id: string }
        Returns: {
          assistant_owner_display_name: string
          assistant_owner_id: string
          campaign_name: string
          coaching_record_id: string
          current_status: string
          latest_event_at: string
          latest_outcome: string
          opened_at: string
          priority: string
          reason: string
          review_at: string
          student_full_name: string
          student_id: string
          student_public_code: string
        }[]
      }
      get_coaching_record_events: {
        Args: { p_coaching_record_id: string }
        Returns: {
          coaching_record_event_id: string
          event_type: string
          note: string
          occurred_at: string
          occurred_by_display_name: string
          outcome: string
          status: string
        }[]
      }
      get_coaching_records_dashboard: {
        Args: { p_limit?: number }
        Returns: {
          assistant_owner_display_name: string
          assistant_owner_id: string
          campaign_name: string
          coaching_record_id: string
          current_status: string
          latest_event_at: string
          latest_outcome: string
          opened_at: string
          priority: string
          reason: string
          review_at: string
          student_full_name: string
          student_id: string
          student_public_code: string
        }[]
      }
      get_finance_cashflow_summary: {
        Args: never
        Returns: {
          disbursement_vnd: number
          receipt_vnd: number
          refund_vnd: number
        }[]
      }
      get_grading_credits_dashboard: {
        Args: { p_limit?: number }
        Returns: {
          class_code: string
          class_name: string
          class_session_id: string
          credit_units: number
          credited_at: string
          grader_display_name: string
          grader_id: string
          grading_credit_id: string
          session_date: string
          session_result_id: string
          student_full_name: string
          student_id: string
          student_public_code: string
        }[]
      }
      get_my_permissions: {
        Args: never
        Returns: {
          permission_code: string
        }[]
      }
      get_my_time_entry_adjustment_requests: {
        Args: never
        Returns: {
          created_at: string
          decision_reason: string
          original_check_in_at: string
          original_check_in_mode: string
          original_check_out_at: string
          original_check_out_mode: string
          request_id: string
          request_reason: string
          request_status: string
          requested_check_in_at: string
          requested_check_in_mode: string
          requested_check_out_at: string
          requested_check_out_mode: string
          reviewed_at: string
          reviewer_display_name: string
          time_entry_id: string
          work_date: string
        }[]
      }
      get_my_timekeeping_adjustable_entries: {
        Args: never
        Returns: {
          adjustment_status: string
          check_in_at: string
          check_in_mode: string
          check_out_at: string
          check_out_mode: string
          entry_status: string
          time_entry_id: string
          work_date: string
          work_shift_code: string
          work_shift_name: string
        }[]
      }
      get_my_timekeeping_entries: {
        Args: never
        Returns: {
          auto_ended_at: string
          check_in_at: string
          check_in_mode: string
          check_out_at: string
          check_out_mode: string
          entry_id: string
          entry_status: string
          has_check_in_gps_evidence: boolean
          has_check_in_wifi_evidence: boolean
          has_check_out_gps_evidence: boolean
          has_check_out_wifi_evidence: boolean
          scheduled_end_time: string
          scheduled_start_time: string
          work_date: string
          work_shift_code: string
          work_shift_name: string
        }[]
      }
      get_payroll_dashboard: {
        Args: never
        Returns: {
          pay_date: string
          payable_amount_vnd: number
          payroll_period_id: string
          payroll_statement_id: string
          period_month: string
          period_status: string
          staff_display_name: string
          staff_employee_code: string
          staff_id: string
          total_deductions_vnd: number
          total_earnings_vnd: number
          work_hours: number
          work_units: number
        }[]
      }
      get_salary_advances_dashboard: {
        Args: never
        Returns: {
          advance_status: string
          amount_vnd: number
          approval_note: string
          approved_at: string
          approved_by_display_name: string
          deducted_at: string
          deduction_payroll_period_id: string
          deduction_period_month: string
          rejected_at: string
          rejected_by_display_name: string
          rejection_reason: string
          request_note: string
          requested_at: string
          review_note: string
          reviewed_at: string
          reviewed_by_display_name: string
          salary_advance_id: string
          staff_display_name: string
          staff_employee_code: string
          staff_id: string
        }[]
      }
      get_sales_commission_accruals_dashboard: {
        Args: { p_limit?: number }
        Returns: {
          accrual_status: string
          crm_case_id: string
          lead_source_code: string
          lead_source_group: string
          lead_source_name: string
          recognized_at: string
          recognized_revenue_vnd: number
          sale_owner_display_name: string
          sale_owner_employee_code: string
          sale_owner_id: string
          sales_commission_accrual_id: string
          source_cashflow_record_id: string
          student_full_name: string
          student_id: string
          student_public_code: string
        }[]
      }
      get_time_entry_adjustment_approval_queue: {
        Args: never
        Returns: {
          created_at: string
          original_check_in_at: string
          original_check_in_mode: string
          original_check_out_at: string
          original_check_out_mode: string
          request_id: string
          request_reason: string
          requested_check_in_at: string
          requested_check_in_mode: string
          requested_check_out_at: string
          requested_check_out_mode: string
          requester_display_name: string
          requester_employee_code: string
          requester_id: string
          time_entry_id: string
          work_date: string
        }[]
      }
      get_timekeeping_day_entries: {
        Args: never
        Returns: {
          auto_ended_at: string
          check_in_at: string
          check_in_mode: string
          check_out_at: string
          check_out_mode: string
          entry_id: string
          entry_status: string
          has_check_in_gps_evidence: boolean
          has_check_in_wifi_evidence: boolean
          has_check_out_gps_evidence: boolean
          has_check_out_wifi_evidence: boolean
          scheduled_end_time: string
          scheduled_start_time: string
          staff_display_name: string
          staff_employee_code: string
          staff_id: string
          work_date: string
          work_shift_code: string
          work_shift_name: string
        }[]
      }
      get_timekeeping_schedule: {
        Args: never
        Returns: {
          assignment_id: string
          break_minutes: number
          crosses_midnight: boolean
          effective_from: string
          effective_to: string
          end_time: string
          staff_display_name: string
          staff_employee_code: string
          staff_employment_status: string
          staff_id: string
          start_time: string
          weekday: number
          work_shift_code: string
          work_shift_id: string
          work_shift_name: string
        }[]
      }
      get_timekeeping_staff_options: {
        Args: never
        Returns: {
          staff_display_name: string
          staff_employee_code: string
          staff_id: string
        }[]
      }
      has_permission: {
        Args: { required_permission: string }
        Returns: boolean
      }
      lock_class_session: {
        Args: { p_class_session_id: string; p_reason: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_id: string
          completed_at: string | null
          completed_by: string | null
          component_code: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          learning_mode: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          makeup_for_session_id: string | null
          meeting_url: string | null
          notes: string | null
          room_name: string | null
          schedule_template_id: string | null
          session_date: string
          session_kind: string
          start_time: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          actor_user_id: string | null
          created_at: string
          dedupe_key: string
          entity_id: string | null
          entity_type: string | null
          event_code: string
          href: string | null
          id: string
          message: string
          metadata: Json
          read_at: string | null
          recipient_user_id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_session_attendance: {
        Args: {
          p_actual_learning_mode: string
          p_attendance_status: string
          p_class_session_id: string
          p_notes?: string
          p_student_id: string
        }
        Returns: {
          actual_learning_mode: string
          attendance_status: string
          class_session_id: string
          created_at: string
          id: string
          is_late_update: boolean
          marked_at: string
          marked_by: string
          notes: string | null
          student_enrollment_id: string | null
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_student_public_code: { Args: never; Returns: string }
      normalize_student_name: { Args: { name_value: string }; Returns: string }
      normalize_vietnam_phone: {
        Args: { phone_value: string }
        Returns: string
      }
      process_sepay_webhook_transaction: {
        Args: {
          p_account_number: string
          p_amount_in: number
          p_amount_out: number
          p_body_raw?: Json
          p_code: string
          p_content: string
          p_gateway: string
          p_reference_number?: string
          p_sepay_id: number
          p_transaction_date: string
          p_transfer_type: string
        }
        Returns: Json
      }
      process_student_refund: {
        Args: {
          p_reason: string
          p_refund_amount_vnd: number
          p_refund_sessions: number
          p_student_id: string
        }
        Returns: Json
      }
      record_session_result: {
        Args: {
          p_class_session_id: string
          p_comment?: string
          p_notebook_score?: number
          p_notebook_status?: string
          p_student_id: string
          p_test_score?: number
        }
        Returns: {
          class_session_id: string
          comment: string | null
          created_at: string
          created_by: string
          graded_at: string | null
          graded_by: string | null
          id: string
          notebook_score: number | null
          notebook_status: string
          student_id: string
          test_score: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_class_schedule_template: {
        Args: {
          p_effective_from: string
          p_end_time: string
          p_learning_mode: string
          p_meeting_url: string
          p_reason: string
          p_room_name: string
          p_schedule_template_id: string
          p_start_time: string
          p_weekday: number
        }
        Returns: {
          class_id: string
          component_code: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          end_time: string
          ended_by: string | null
          id: string
          is_active: boolean
          learning_mode: string
          meeting_url: string | null
          room_name: string | null
          start_time: string
          supersedes_schedule_template_id: string | null
          updated_at: string
          weekday: number
        }
        SetofOptions: {
          from: "*"
          to: "class_schedule_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_staff_shift_assignment: {
        Args: {
          p_effective_from: string
          p_reason: string
          p_staff_shift_assignment_id: string
          p_work_shift_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          is_active: boolean
          staff_id: string
          supersedes_staff_shift_assignment_id: string | null
          updated_at: string
          weekday: number
          work_shift_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_shift_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_salary_advance: {
        Args: {
          p_amount_vnd: number
          p_deduction_period_month: string
          p_request_note: string
        }
        Returns: {
          amount_vnd: number
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          deducted_at: string | null
          deduction_payroll_period_id: string | null
          deduction_period_month: string
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_note: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "salary_advances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_time_entry_adjustment: {
        Args: {
          p_request_reason: string
          p_requested_check_in_at: string
          p_requested_check_in_mode: string
          p_requested_check_out_at: string
          p_requested_check_out_mode: string
          p_time_entry_id: string
        }
        Returns: {
          created_at: string
          decision_reason: string | null
          id: string
          original_check_in_at: string
          original_check_in_mode: string
          original_check_out_at: string
          original_check_out_mode: string
          request_reason: string
          requested_check_in_at: string
          requested_check_in_mode: string
          requested_check_out_at: string
          requested_check_out_mode: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_entry_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entry_adjustment_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_student_enrollment: {
        Args: {
          p_reason: string
          p_reserved_from: string
          p_student_id: string
        }
        Returns: {
          class_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          registered_mode: string
          start_reason: string | null
          started_by: string | null
          status: string
          student_id: string
          supersedes_enrollment_id: string | null
          transition_kind: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resume_student_enrollment: {
        Args: {
          p_effective_from: string
          p_reason: string
          p_registered_mode: string
          p_student_id: string
          p_target_class_id: string
        }
        Returns: {
          class_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          registered_mode: string
          start_reason: string | null
          started_by: string | null
          status: string
          student_id: string
          supersedes_enrollment_id: string | null
          transition_kind: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retire_work_shift: {
        Args: { p_reason: string; p_work_shift_id: string }
        Returns: {
          break_minutes: number
          code: string
          created_at: string
          created_by: string | null
          crosses_midnight: boolean
          end_time: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_time: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "work_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_session_charge: {
        Args: { p_reason: string; p_session_attendance_id: string }
        Returns: {
          class_session_id: string | null
          created_at: string
          created_by: string | null
          delta_sessions: number
          effective_on: string
          entry_type: string
          event_key: string
          id: string
          metadata: Json
          note: string
          reference_code: string | null
          reverses_entry_id: string | null
          session_attendance_id: string | null
          student_enrollment_id: string | null
          student_id: string
          transfer_group_id: string | null
          unit_price_vnd: number | null
        }
        SetofOptions: {
          from: "*"
          to: "student_session_ledger_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_salary_advance: {
        Args: {
          p_decision: string
          p_note: string
          p_salary_advance_id: string
        }
        Returns: {
          amount_vnd: number
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          deducted_at: string | null
          deduction_payroll_period_id: string | null
          deduction_period_month: string
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_note: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "salary_advances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_user_role_assignment: {
        Args: { revocation_reason: string; target_assignment_id: string }
        Returns: {
          assignment_id: string
          revoked_at: string
          role_code: string
          role_id: string
          user_id: string
        }[]
      }
      start_class_session: {
        Args: { p_class_session_id: string }
        Returns: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_id: string
          completed_at: string | null
          completed_by: string | null
          component_code: string | null
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          learning_mode: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          makeup_for_session_id: string | null
          meeting_url: string | null
          notes: string | null
          room_name: string | null
          schedule_template_id: string | null
          session_date: string
          session_kind: string
          start_time: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_payroll_for_review: {
        Args: { p_payroll_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          generated_at: string
          generated_by: string
          id: string
          pay_date: string
          period_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_crm_case_lead: {
        Args: {
          p_crm_case_id: string
          p_new_sale_owner_id: string
          p_reason: string
        }
        Returns: {
          birth_year: number
          created_at: string
          created_by: string | null
          discount_notes: string | null
          expected_grade: number
          expected_level: string | null
          expected_mode: string | null
          expected_official_start_date: string | null
          expected_tuition_fee_vnd: number | null
          full_name: string
          guardian_full_name: string
          guardian_id: string | null
          guardian_phone: string
          guardian_relationship: string
          id: string
          lead_source_id: string | null
          nickname: string | null
          notes: string | null
          province_city: string | null
          public_code: string
          sale_owner_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crm_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_student_class: {
        Args: {
          p_effective_from: string
          p_reason: string
          p_registered_mode: string
          p_student_id: string
          p_target_class_id: string
        }
        Returns: {
          class_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          registered_mode: string
          start_reason: string | null
          started_by: string | null
          status: string
          student_id: string
          supersedes_enrollment_id: string | null
          transition_kind: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_class: {
        Args: {
          p_academic_year_id: string
          p_class_id: string
          p_classin_url: string
          p_code: string
          p_default_learning_mode: string
          p_grade: number
          p_level: string
          p_name: string
          p_notes: string
          p_reason: string
          p_weekly_session_count: number
        }
        Returns: {
          academic_year_id: string
          classin_url: string | null
          code: string
          created_at: string
          created_by: string | null
          default_learning_mode: string
          grade: number
          id: string
          level: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          weekly_session_count: number
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_session_attendance: {
        Args: {
          p_actual_learning_mode: string
          p_attendance_status: string
          p_notes: string
          p_reason: string
          p_session_attendance_id: string
        }
        Returns: {
          actual_learning_mode: string
          attendance_status: string
          class_session_id: string
          created_at: string
          id: string
          is_late_update: boolean
          marked_at: string
          marked_by: string
          notes: string | null
          student_enrollment_id: string | null
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_session_result: {
        Args: {
          p_comment: string
          p_notebook_score: number
          p_notebook_status: string
          p_reason: string
          p_session_result_id: string
          p_test_score: number
        }
        Returns: {
          class_session_id: string
          comment: string | null
          created_at: string
          created_by: string
          graded_at: string | null
          graded_by: string | null
          id: string
          notebook_score: number | null
          notebook_status: string
          student_id: string
          test_score: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_staff_profile: {
        Args: {
          p_display_name: string
          p_employee_code: string
          p_employment_status: string
          p_joined_at?: string
          p_left_at?: string
          p_phone: string
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          display_name: string
          employee_code: string
          employment_status: string
          id: string
          joined_at: string
          left_at: string
          phone: string
        }[]
      }
      update_student_with_primary_guardian: {
        Args: {
          p_birth_year: number
          p_current_grade: number
          p_duplicate_override_reason: string
          p_full_name: string
          p_guardian_email: string
          p_guardian_full_name: string
          p_guardian_notes: string
          p_guardian_phone: string
          p_guardian_relationship: string
          p_guardian_zalo: string
          p_internal_notes: string
          p_learning_goal: string
          p_learning_level: string
          p_nickname: string
          p_province_city: string
          p_reason: string
          p_registered_mode: string
          p_student_id: string
        }
        Returns: {
          guardian_id: string
          guardian_reused: boolean
          student_id: string
          student_public_code: string
        }[]
      }
      update_work_shift: {
        Args: {
          p_break_minutes: number
          p_code: string
          p_crosses_midnight: boolean
          p_end_time: string
          p_name: string
          p_notes: string
          p_reason: string
          p_start_time: string
          p_work_shift_id: string
        }
        Returns: {
          break_minutes: number
          code: string
          created_at: string
          created_by: string | null
          crosses_midnight: boolean
          end_time: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_time: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "work_shifts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_student_import_rows: { Args: { p_rows: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
