export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      account_invitation_roles: {
        Row: {
          granted_at: string
          granted_by: string
          invitation_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          invitation_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          invitation_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invitation_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitation_roles_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "account_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitation_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invitation_reason: string
          invited_at: string
          invited_by: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invitation_reason: string
          invited_at?: string
          invited_by: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invitation_reason?: string
          invited_at?: string
          invited_by?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exception_reviews: {
        Row: {
          check_in_reason: string | null
          check_out_reason: string | null
          decision_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          time_entry_id: string
        }
        Insert: {
          check_in_reason?: string | null
          check_out_reason?: string | null
          decision_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_entry_id: string
        }
        Update: {
          check_in_reason?: string | null
          check_out_reason?: string | null
          decision_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exception_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exception_reviews_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: true
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exception_submissions: {
        Row: {
          created_at: string
          operation: string
          reason: string
          request_id: string
          staff_id: string
          time_entry_id: string
        }
        Insert: {
          created_at?: string
          operation: string
          reason: string
          request_id: string
          staff_id: string
          time_entry_id: string
        }
        Update: {
          created_at?: string
          operation?: string
          reason?: string
          request_id?: string
          staff_id?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_exception_submissions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_exception_submissions_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
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
      center_attendance_configs: {
        Row: {
          attendance_radius_m: number
          center_latitude: number | null
          center_longitude: number | null
          code: string
          created_at: string
          created_by: string | null
          gps_max_accuracy_m: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
          updated_by: string | null
          wifi_verification_enabled: boolean
        }
        Insert: {
          attendance_radius_m?: number
          center_latitude?: number | null
          center_longitude?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          gps_max_accuracy_m?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
          wifi_verification_enabled?: boolean
        }
        Update: {
          attendance_radius_m?: number
          center_latitude?: number | null
          center_longitude?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          gps_max_accuracy_m?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
          wifi_verification_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "center_attendance_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_attendance_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      center_attendance_wifi_networks: {
        Row: {
          bssid: string
          center_config_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          ssid: string
          updated_at: string
        }
        Insert: {
          bssid: string
          center_config_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          ssid: string
          updated_at?: string
        }
        Update: {
          bssid?: string
          center_config_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          ssid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "center_attendance_wifi_networks_center_config_id_fkey"
            columns: ["center_config_id"]
            isOneToOne: false
            referencedRelation: "center_attendance_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "center_attendance_wifi_networks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_component_links: {
        Row: {
          component_class_id: string
          component_order: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          parent_class_id: string
        }
        Insert: {
          component_class_id: string
          component_order: number
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          parent_class_id: string
        }
        Update: {
          component_class_id?: string
          component_order?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          parent_class_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_component_links_component_class_id_fkey"
            columns: ["component_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_component_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_component_links_parent_class_id_fkey"
            columns: ["parent_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_import_batches: {
        Row: {
          academic_year_code: string
          academic_year_id: string | null
          class_conflict_count: number
          class_invalid_count: number
          class_matching_count: number
          class_new_count: number
          class_row_count: number
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          reason: string
          schedule_conflict_count: number
          schedule_invalid_count: number
          schedule_matching_count: number
          schedule_new_count: number
          schedule_row_count: number
          source_filename: string
          source_sha256: string
          status: string
        }
        Insert: {
          academic_year_code: string
          academic_year_id?: string | null
          class_conflict_count?: number
          class_invalid_count?: number
          class_matching_count?: number
          class_new_count?: number
          class_row_count?: number
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          reason: string
          schedule_conflict_count?: number
          schedule_invalid_count?: number
          schedule_matching_count?: number
          schedule_new_count?: number
          schedule_row_count?: number
          source_filename: string
          source_sha256: string
          status?: string
        }
        Update: {
          academic_year_code?: string
          academic_year_id?: string | null
          class_conflict_count?: number
          class_invalid_count?: number
          class_matching_count?: number
          class_new_count?: number
          class_row_count?: number
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          reason?: string
          schedule_conflict_count?: number
          schedule_invalid_count?: number
          schedule_matching_count?: number
          schedule_new_count?: number
          schedule_row_count?: number
          source_filename?: string
          source_sha256?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_import_batches_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_import_batches_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_import_class_rows: {
        Row: {
          academic_year_code: string
          batch_id: string
          class_code: string
          class_name: string
          classification: string
          created_at: string
          default_learning_mode: string
          grade: number
          id: string
          level: string
          resolved_academic_year_id: string | null
          resolved_class_id: string | null
          source_row_number: number
          status: string
          validation_code: string | null
          validation_message: string | null
          weekly_session_count: number
        }
        Insert: {
          academic_year_code: string
          batch_id: string
          class_code: string
          class_name: string
          classification: string
          created_at?: string
          default_learning_mode?: string
          grade: number
          id?: string
          level: string
          resolved_academic_year_id?: string | null
          resolved_class_id?: string | null
          source_row_number: number
          status?: string
          validation_code?: string | null
          validation_message?: string | null
          weekly_session_count?: number
        }
        Update: {
          academic_year_code?: string
          batch_id?: string
          class_code?: string
          class_name?: string
          classification?: string
          created_at?: string
          default_learning_mode?: string
          grade?: number
          id?: string
          level?: string
          resolved_academic_year_id?: string | null
          resolved_class_id?: string | null
          source_row_number?: number
          status?: string
          validation_code?: string | null
          validation_message?: string | null
          weekly_session_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_import_class_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_import_class_rows_resolved_academic_year_id_fkey"
            columns: ["resolved_academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_import_class_rows_resolved_class_id_fkey"
            columns: ["resolved_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_import_schedule_rows: {
        Row: {
          batch_id: string
          class_code: string
          classification: string
          component_code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          end_time: string
          id: string
          learning_mode: string
          meeting_url: string | null
          resolved_class_id: string | null
          resolved_schedule_template_id: string | null
          room_name: string | null
          source_row_number: number
          start_time: string
          validation_code: string | null
          validation_message: string | null
          weekday: number
        }
        Insert: {
          batch_id: string
          class_code: string
          classification: string
          component_code: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          end_time: string
          id?: string
          learning_mode?: string
          meeting_url?: string | null
          resolved_class_id?: string | null
          resolved_schedule_template_id?: string | null
          room_name?: string | null
          source_row_number: number
          start_time: string
          validation_code?: string | null
          validation_message?: string | null
          weekday: number
        }
        Update: {
          batch_id?: string
          class_code?: string
          classification?: string
          component_code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          end_time?: string
          id?: string
          learning_mode?: string
          meeting_url?: string | null
          resolved_class_id?: string | null
          resolved_schedule_template_id?: string | null
          room_name?: string | null
          source_row_number?: number
          start_time?: string
          validation_code?: string | null
          validation_message?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_import_schedul_resolved_schedule_template_i_fkey"
            columns: ["resolved_schedule_template_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_import_schedule_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "class_schedule_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_import_schedule_rows_resolved_class_id_fkey"
            columns: ["resolved_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
      coaching_form_answers: {
        Row: {
          answer: Json
          created_at: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer: Json
          created_at?: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer?: Json
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_form_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "coaching_form_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "coaching_form_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_form_questions: {
        Row: {
          configuration: Json
          created_at: string
          description: string | null
          form_version_id: string
          id: string
          is_required: boolean
          question_type: string
          sort_order: number
          title: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          description?: string | null
          form_version_id: string
          id?: string
          is_required?: boolean
          question_type: string
          sort_order: number
          title: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          description?: string | null
          form_version_id?: string
          id?: string
          is_required?: boolean
          question_type?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_form_questions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "coaching_form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_form_responses: {
        Row: {
          coaching_record_id: string
          created_at: string
          form_id: string
          form_version_id: string
          id: string
          public_link_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          coaching_record_id: string
          created_at?: string
          form_id: string
          form_version_id: string
          id?: string
          public_link_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          coaching_record_id?: string
          created_at?: string
          form_id?: string
          form_version_id?: string
          id?: string
          public_link_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_form_responses_coaching_record_id_fkey"
            columns: ["coaching_record_id"]
            isOneToOne: false
            referencedRelation: "coaching_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "coaching_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_responses_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "coaching_form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_responses_public_link_id_fkey"
            columns: ["public_link_id"]
            isOneToOne: true
            referencedRelation: "coaching_public_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_form_versions: {
        Row: {
          created_at: string
          created_by: string
          form_id: string
          id: string
          instructions: string | null
          published_at: string | null
          published_by: string | null
          status: string
          title: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          form_id: string
          id?: string
          instructions?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          title: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          form_id?: string
          id?: string
          instructions?: string | null
          published_at?: string | null
          published_by?: string | null
          status?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "coaching_form_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "coaching_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_form_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_forms: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          status: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_forms_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_public_links: {
        Row: {
          coaching_record_id: string
          expires_at: string
          form_version_id: string
          id: string
          issued_at: string
          issued_by: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          student_id: string
          token_hash: string
        }
        Insert: {
          coaching_record_id: string
          expires_at: string
          form_version_id: string
          id?: string
          issued_at?: string
          issued_by: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          student_id: string
          token_hash: string
        }
        Update: {
          coaching_record_id?: string
          expires_at?: string
          form_version_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          student_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_public_links_coaching_record_id_fkey"
            columns: ["coaching_record_id"]
            isOneToOne: false
            referencedRelation: "coaching_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_public_links_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "coaching_form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_public_links_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_public_links_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_public_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_record_events: {
        Row: {
          coaching_record_id: string
          created_at: string
          event_sequence: number
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
          event_sequence?: never
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
          event_sequence?: never
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
          effective_on: string
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
          effective_on: string
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
          effective_on?: string
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
      finance_order_reviews: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string
          is_checked: boolean
          source_cashflow_record_id: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          is_checked?: boolean
          source_cashflow_record_id: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          is_checked?: boolean
          source_cashflow_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_order_reviews_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_order_reviews_source_cashflow_record_id_fkey"
            columns: ["source_cashflow_record_id"]
            isOneToOne: true
            referencedRelation: "finance_cashflow_records"
            referencedColumns: ["id"]
          },
        ]
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
      payroll_calculation_issues: {
        Row: {
          calculation_run_id: string
          created_at: string
          details: Json
          id: string
          issue_code: string
          severity: string
          source_fact_id: string | null
          staff_id: string | null
        }
        Insert: {
          calculation_run_id: string
          created_at?: string
          details?: Json
          id?: string
          issue_code: string
          severity?: string
          source_fact_id?: string | null
          staff_id?: string | null
        }
        Update: {
          calculation_run_id?: string
          created_at?: string
          details?: Json
          id?: string
          issue_code?: string
          severity?: string
          source_fact_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculation_issues_calculation_run_id_fkey"
            columns: ["calculation_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_calculation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_issues_source_fact_id_fkey"
            columns: ["source_fact_id"]
            isOneToOne: false
            referencedRelation: "payroll_source_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_issues_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_calculation_runs: {
        Row: {
          generated_at: string
          generated_by: string
          id: string
          payroll_period_id: string
          reason: string
          revision: number
          status: string
        }
        Insert: {
          generated_at?: string
          generated_by: string
          id?: string
          payroll_period_id: string
          reason: string
          revision: number
          status: string
        }
        Update: {
          generated_at?: string
          generated_by?: string
          id?: string
          payroll_period_id?: string
          reason?: string
          revision?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_calculation_runs_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_calculation_runs_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_correction_request_items: {
        Row: {
          created_at: string
          evidence_url: string | null
          id: string
          item_label: string
          payroll_line_item_id: string | null
          request_id: string
          requested_change: string
        }
        Insert: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          item_label: string
          payroll_line_item_id?: string | null
          request_id: string
          requested_change: string
        }
        Update: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          item_label?: string
          payroll_line_item_id?: string | null
          request_id?: string
          requested_change?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_correction_request_items_payroll_line_item_id_fkey"
            columns: ["payroll_line_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_correction_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "payroll_correction_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_correction_requests: {
        Row: {
          id: string
          payroll_period_id: string
          payroll_statement_id: string
          request_message: string
          requested_at: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          response_message: string | null
          status: string
        }
        Insert: {
          id?: string
          payroll_period_id: string
          payroll_statement_id: string
          request_message: string
          requested_at?: string
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          response_message?: string | null
          status?: string
        }
        Update: {
          id?: string
          payroll_period_id?: string
          payroll_statement_id?: string
          request_message?: string
          requested_at?: string
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response_message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_correction_requests_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_correction_requests_payroll_statement_id_fkey"
            columns: ["payroll_statement_id"]
            isOneToOne: false
            referencedRelation: "payroll_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_correction_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_correction_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_import_batches: {
        Row: {
          conflict_rows: number
          dataset_type: string
          error_rows: number
          file_name: string
          file_sha256: string
          id: string
          period_month: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_rows: number
          uploaded_at: string
          uploaded_by: string
          valid_rows: number
        }
        Insert: {
          conflict_rows?: number
          dataset_type: string
          error_rows?: number
          file_name: string
          file_sha256: string
          id?: string
          period_month: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_rows?: number
          uploaded_at?: string
          uploaded_by: string
          valid_rows?: number
        }
        Update: {
          conflict_rows?: number
          dataset_type?: string
          error_rows?: number
          file_name?: string
          file_sha256?: string
          id?: string
          period_month?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_rows?: number
          uploaded_at?: string
          uploaded_by?: string
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_import_batches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_import_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_import_rows: {
        Row: {
          batch_id: string
          conflict_payload: Json | null
          created_at: string
          id: string
          normalized_payload: Json | null
          raw_payload: Json
          resolution: string | null
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          row_number: number
          source_key: string
          validation_errors: Json
          validation_status: string
        }
        Insert: {
          batch_id: string
          conflict_payload?: Json | null
          created_at?: string
          id?: string
          normalized_payload?: Json | null
          raw_payload: Json
          resolution?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_number: number
          source_key: string
          validation_errors?: Json
          validation_status: string
        }
        Update: {
          batch_id?: string
          conflict_payload?: Json | null
          created_at?: string
          id?: string
          normalized_payload?: Json | null
          raw_payload?: Json
          resolution?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          row_number?: number
          source_key?: string
          validation_errors?: Json
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_import_rows_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lead_source_mapping_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          lead_source_id: string
          payroll_source_code: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          lead_source_id: string
          payroll_source_code: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          lead_source_id?: string
          payroll_source_code?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lead_source_mapping_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lead_source_mapping_versions_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_sources"
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
          evidence_snapshot: Json
          formula_snapshot: Json
          id: string
          line_type: string
          note: string | null
          payroll_statement_id: string
          policy_code: string | null
          quantity: number | null
          salary_advance_id: string | null
          source_id: string | null
          source_kind: string | null
          source_time_entry_id: string | null
          staff_daily_rate_version_id: string | null
          staff_rate_version_id: string | null
          unit_count: number | null
          unit_label: string | null
          unit_rate_vnd: number | null
          work_minutes: number | null
        }
        Insert: {
          amount_vnd: number
          created_at?: string
          created_by?: string | null
          direction: string
          evidence_snapshot?: Json
          formula_snapshot?: Json
          id?: string
          line_type: string
          note?: string | null
          payroll_statement_id: string
          policy_code?: string | null
          quantity?: number | null
          salary_advance_id?: string | null
          source_id?: string | null
          source_kind?: string | null
          source_time_entry_id?: string | null
          staff_daily_rate_version_id?: string | null
          staff_rate_version_id?: string | null
          unit_count?: number | null
          unit_label?: string | null
          unit_rate_vnd?: number | null
          work_minutes?: number | null
        }
        Update: {
          amount_vnd?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          evidence_snapshot?: Json
          formula_snapshot?: Json
          id?: string
          line_type?: string
          note?: string | null
          payroll_statement_id?: string
          policy_code?: string | null
          quantity?: number | null
          salary_advance_id?: string | null
          source_id?: string | null
          source_kind?: string | null
          source_time_entry_id?: string | null
          staff_daily_rate_version_id?: string | null
          staff_rate_version_id?: string | null
          unit_count?: number | null
          unit_label?: string | null
          unit_rate_vnd?: number | null
          work_minutes?: number | null
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
            foreignKeyName: "payroll_line_items_staff_daily_rate_version_id_fkey"
            columns: ["staff_daily_rate_version_id"]
            isOneToOne: false
            referencedRelation: "staff_daily_rate_versions"
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
      payroll_live_revisions: {
        Row: {
          changed_at: string
          id: string
          month: string
          revision: number
          scope: string
          staff_id: string | null
        }
        Insert: {
          changed_at?: string
          id?: string
          month: string
          revision?: number
          scope: string
          staff_id?: string | null
        }
        Update: {
          changed_at?: string
          id?: string
          month?: string
          revision?: number
          scope?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_live_revisions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
          period_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          current_calculation_run_id?: string | null
          feedback_closed_at?: string | null
          feedback_closed_by?: string | null
          feedback_opened_at?: string
          generated_at?: string
          generated_by: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          paid_on?: string | null
          pay_date: string
          payment_note?: string | null
          payment_reference?: string | null
          period_month: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          current_calculation_run_id?: string | null
          feedback_closed_at?: string | null
          feedback_closed_by?: string | null
          feedback_opened_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          paid_on?: string | null
          pay_date?: string
          payment_note?: string | null
          payment_reference?: string | null
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
            foreignKeyName: "payroll_periods_current_calculation_run_id_fkey"
            columns: ["current_calculation_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_calculation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_periods_feedback_closed_by_fkey"
            columns: ["feedback_closed_by"]
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
            foreignKeyName: "payroll_periods_paid_by_fkey"
            columns: ["paid_by"]
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
      payroll_policy_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          parameters: Json
          policy_code: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          parameters: Json
          policy_code: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          parameters?: Json
          policy_code?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_policy_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_source_facts: {
        Row: {
          amount_vnd: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          event_date: string
          fact_type: string
          grade: number | null
          id: string
          import_batch_id: string | null
          import_row_id: string | null
          metadata: Json
          quantity: number | null
          source_code: string | null
          source_key: string
          source_origin: string
          staff_id: string | null
          student_id: string | null
        }
        Insert: {
          amount_vnd?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          event_date: string
          fact_type: string
          grade?: number | null
          id?: string
          import_batch_id?: string | null
          import_row_id?: string | null
          metadata?: Json
          quantity?: number | null
          source_code?: string | null
          source_key: string
          source_origin: string
          staff_id?: string | null
          student_id?: string | null
        }
        Update: {
          amount_vnd?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          event_date?: string
          fact_type?: string
          grade?: number | null
          id?: string
          import_batch_id?: string | null
          import_row_id?: string | null
          metadata?: Json
          quantity?: number | null
          source_code?: string | null
          source_key?: string
          source_origin?: string
          staff_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_source_facts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_source_facts_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_source_facts_import_row_id_fkey"
            columns: ["import_row_id"]
            isOneToOne: false
            referencedRelation: "payroll_import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_source_facts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_source_facts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_source_revisions: {
        Row: {
          input_fingerprint: string | null
          month: string
          revision: number
          updated_at: string
        }
        Insert: {
          input_fingerprint?: string | null
          month: string
          revision?: number
          updated_at?: string
        }
        Update: {
          input_fingerprint?: string | null
          month?: string
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
      payroll_statements: {
        Row: {
          calculation_run_id: string
          created_at: string
          id: string
          payroll_period_id: string
          staff_display_name_snapshot: string
          staff_employee_code_snapshot: string | null
          staff_id: string
          work_hours: number
          work_minutes: number
          work_units: number
        }
        Insert: {
          calculation_run_id: string
          created_at?: string
          id?: string
          payroll_period_id: string
          staff_display_name_snapshot: string
          staff_employee_code_snapshot?: string | null
          staff_id: string
          work_hours?: number
          work_minutes?: number
          work_units?: number
        }
        Update: {
          calculation_run_id?: string
          created_at?: string
          id?: string
          payroll_period_id?: string
          staff_display_name_snapshot?: string
          staff_employee_code_snapshot?: string | null
          staff_id?: string
          work_hours?: number
          work_minutes?: number
          work_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_statements_calculation_run_id_fkey"
            columns: ["calculation_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_calculation_runs"
            referencedColumns: ["id"]
          },
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
          account_deleted_at: string | null
          account_deleted_by: string | null
          account_deletion_reason: string | null
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
          account_deleted_at?: string | null
          account_deleted_by?: string | null
          account_deletion_reason?: string | null
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
          account_deleted_at?: string | null
          account_deleted_by?: string | null
          account_deletion_reason?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_account_deleted_by_fkey"
            columns: ["account_deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          recognized_on: string
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
          recognized_on: string
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
          recognized_on?: string
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
      sepay_receiving_account_versions: {
        Row: {
          account_display_name: string
          account_number: string
          audit_metadata: Json
          bank_code: string
          changed_at: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          purpose: string
          sepay_bank_account_id: string | null
          signed_account_number: string | null
          status: string
        }
        Insert: {
          account_display_name: string
          account_number: string
          audit_metadata?: Json
          bank_code: string
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          purpose: string
          sepay_bank_account_id?: string | null
          signed_account_number?: string | null
          status?: string
        }
        Update: {
          account_display_name?: string
          account_number?: string
          audit_metadata?: Json
          bank_code?: string
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          purpose?: string
          sepay_bank_account_id?: string | null
          signed_account_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepay_receiving_account_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepay_receiving_account_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_sync_runs: {
        Row: {
          account_version_id: string
          completed_at: string | null
          date_from: string
          date_to: string
          duplicate_count: number
          error_code: string | null
          failed_count: number
          id: string
          linked_count: number
          manual_review_count: number
          pages_processed: number
          recorded_count: number
          requested_by: string
          started_at: string
          status: string
          sync_session_id: string
          total_available: number
          total_seen: number
        }
        Insert: {
          account_version_id: string
          completed_at?: string | null
          date_from: string
          date_to: string
          duplicate_count?: number
          error_code?: string | null
          failed_count?: number
          id?: string
          linked_count?: number
          manual_review_count?: number
          pages_processed?: number
          recorded_count?: number
          requested_by: string
          started_at?: string
          status?: string
          sync_session_id: string
          total_available?: number
          total_seen?: number
        }
        Update: {
          account_version_id?: string
          completed_at?: string | null
          date_from?: string
          date_to?: string
          duplicate_count?: number
          error_code?: string | null
          failed_count?: number
          id?: string
          linked_count?: number
          manual_review_count?: number
          pages_processed?: number
          recorded_count?: number
          requested_by?: string
          started_at?: string
          status?: string
          sync_session_id?: string
          total_available?: number
          total_seen?: number
        }
        Relationships: [
          {
            foreignKeyName: "sepay_sync_runs_account_version_id_fkey"
            columns: ["account_version_id"]
            isOneToOne: false
            referencedRelation: "sepay_receiving_account_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepay_sync_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sepay_transactions: {
        Row: {
          account_number: string
          account_purpose: string
          amount_vnd: number
          bank_brand: string
          bank_transaction_id: string
          created_at: string
          id: string
          ingestion_source: string
          match_status: string
          matched_at: string | null
          matched_by: string | null
          matched_payment_request_id: string | null
          matched_student_id: string | null
          reference_number: string | null
          sepay_v2_id: string | null
          sepay_webhook_id: string | null
          source_payloads: Json
          transaction_at: string
          transfer_content: string
          transfer_type: string | null
        }
        Insert: {
          account_number: string
          account_purpose?: string
          amount_vnd: number
          bank_brand: string
          bank_transaction_id: string
          created_at?: string
          id?: string
          ingestion_source?: string
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_request_id?: string | null
          matched_student_id?: string | null
          reference_number?: string | null
          sepay_v2_id?: string | null
          sepay_webhook_id?: string | null
          source_payloads?: Json
          transaction_at: string
          transfer_content: string
          transfer_type?: string | null
        }
        Update: {
          account_number?: string
          account_purpose?: string
          amount_vnd?: number
          bank_brand?: string
          bank_transaction_id?: string
          created_at?: string
          id?: string
          ingestion_source?: string
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_payment_request_id?: string | null
          matched_student_id?: string | null
          reference_number?: string | null
          sepay_v2_id?: string | null
          sepay_webhook_id?: string | null
          source_payloads?: Json
          transaction_at?: string
          transfer_content?: string
          transfer_type?: string | null
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
      session_balance_import_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          excluded_count: number | null
          id: string
          invalid_count: number | null
          metadata: Json
          no_change_count: number | null
          posted_at: string | null
          posted_by: string | null
          posted_count: number | null
          reason: string
          reconciled_at: string | null
          reconciled_by: string | null
          review_count: number | null
          row_count: number | null
          source_filename: string
          source_sha256: string
          status: string
          valid_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_on: string
          excluded_count?: number | null
          id?: string
          invalid_count?: number | null
          metadata?: Json
          no_change_count?: number | null
          posted_at?: string | null
          posted_by?: string | null
          posted_count?: number | null
          reason: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          review_count?: number | null
          row_count?: number | null
          source_filename: string
          source_sha256: string
          status?: string
          valid_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_on?: string
          excluded_count?: number | null
          id?: string
          invalid_count?: number | null
          metadata?: Json
          no_change_count?: number | null
          posted_at?: string | null
          posted_by?: string | null
          posted_count?: number | null
          reason?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          review_count?: number | null
          row_count?: number | null
          source_filename?: string
          source_sha256?: string
          status?: string
          valid_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_balance_import_batches_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_batches_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_batches_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_balance_import_rows: {
        Row: {
          batch_id: string
          created_at: string
          current_balance_before: number | null
          delta_sessions: number | null
          excluded_reason: string | null
          expected_balance_after: number | null
          id: string
          ledger_entry_id: string | null
          source_balance: number
          source_row_number: number
          source_student_name: string | null
          student_enrollment_id: string | null
          student_id: string | null
          student_public_code: string
          validation_code: string | null
          validation_message: string | null
          validation_status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          current_balance_before?: number | null
          delta_sessions?: number | null
          excluded_reason?: string | null
          expected_balance_after?: number | null
          id?: string
          ledger_entry_id?: string | null
          source_balance: number
          source_row_number: number
          source_student_name?: string | null
          student_enrollment_id?: string | null
          student_id?: string | null
          student_public_code: string
          validation_code?: string | null
          validation_message?: string | null
          validation_status: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          current_balance_before?: number | null
          delta_sessions?: number | null
          excluded_reason?: string | null
          expected_balance_after?: number | null
          id?: string
          ledger_entry_id?: string | null
          source_balance?: number
          source_row_number?: number
          source_student_name?: string | null
          student_enrollment_id?: string | null
          student_id?: string | null
          student_public_code?: string
          validation_code?: string | null
          validation_message?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_balance_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "session_balance_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_rows_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "student_session_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_rows_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "student_session_ledger_running_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_rows_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_balance_import_rows_student_id_fkey"
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
      staff_bank_account_change_requests: {
        Row: {
          account_holder_name: string
          account_number: string
          bank_name: string
          effective_from: string
          id: string
          reason: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: string
          status: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          bank_name: string
          effective_from: string
          id?: string
          reason: string
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          bank_name?: string
          effective_from?: string
          id?: string
          reason?: string
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
            foreignKeyName: "staff_bank_account_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_bank_account_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_bank_account_change_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_bank_account_versions: {
        Row: {
          account_holder_name: string
          account_number: string
          approved_at: string
          approved_by: string
          bank_name: string
          created_at: string
          effective_from: string
          id: string
          source_request_id: string | null
          staff_id: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          approved_at?: string
          approved_by: string
          bank_name: string
          created_at?: string
          effective_from: string
          id?: string
          source_request_id?: string | null
          staff_id: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          approved_at?: string
          approved_by?: string
          bank_name?: string
          created_at?: string
          effective_from?: string
          id?: string
          source_request_id?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_bank_account_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_bank_account_versions_source_request_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "staff_bank_account_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_bank_account_versions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_daily_rate_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          migrated_from_staff_rate_version_id: string | null
          note: string | null
          offline_daily_rate_vnd: number
          online_rate_basis_points: number
          reason: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          migrated_from_staff_rate_version_id?: string | null
          note?: string | null
          offline_daily_rate_vnd: number
          online_rate_basis_points?: number
          reason: string
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          migrated_from_staff_rate_version_id?: string | null
          note?: string | null
          offline_daily_rate_vnd?: number
          online_rate_basis_points?: number
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_daily_rate_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_daily_rate_versions_migrated_from_staff_rate_version_fkey"
            columns: ["migrated_from_staff_rate_version_id"]
            isOneToOne: false
            referencedRelation: "staff_rate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_daily_rate_versions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_grade_assignments: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          grade: number
          id: string
          reason: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          effective_to?: string | null
          grade: number
          id?: string
          reason: string
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          grade?: number
          id?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_grade_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_grade_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payroll_position_versions: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          id: string
          position_code: string
          reason: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          id?: string
          position_code: string
          reason: string
          staff_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          id?: string
          position_code?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payroll_position_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payroll_position_versions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payroll_task_versions: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          id: string
          is_enabled: boolean
          reason: string
          staff_id: string
          task_code: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from: string
          id?: string
          is_enabled: boolean
          reason: string
          staff_id: string
          task_code: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          id?: string
          is_enabled?: boolean
          reason?: string
          staff_id?: string
          task_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payroll_task_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payroll_task_versions_staff_id_fkey"
            columns: ["staff_id"]
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
          week_start: string | null
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
          week_start?: string | null
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
          week_start?: string | null
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
      student_acquisition_source_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          crm_case_id: string | null
          id: string
          is_current: boolean
          lead_source_id: string
          reason: string
          student_id: string
          supersedes_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          crm_case_id?: string | null
          id?: string
          is_current?: boolean
          lead_source_id: string
          reason: string
          student_id: string
          supersedes_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          crm_case_id?: string | null
          id?: string
          is_current?: boolean
          lead_source_id?: string
          reason?: string
          student_id?: string
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_acquisition_source_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_acquisition_source_assignments_crm_case_id_fkey"
            columns: ["crm_case_id"]
            isOneToOne: false
            referencedRelation: "crm_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_acquisition_source_assignments_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_acquisition_source_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_acquisition_source_assignments_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "student_acquisition_source_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_assignments: {
        Row: {
          owner_id: string
          student_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          owner_id: string
          student_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          owner_id?: string
          student_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_care_assignments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_assignments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_coaching_links: {
        Row: {
          coaching_id: string
          created_at: string
          created_by: string
          task_id: string
        }
        Insert: {
          coaching_id: string
          created_at?: string
          created_by: string
          task_id: string
        }
        Update: {
          coaching_id?: string
          created_at?: string
          created_by?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_care_coaching_links_coaching_id_fkey"
            columns: ["coaching_id"]
            isOneToOne: false
            referencedRelation: "coaching_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_coaching_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_coaching_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "student_care_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_evaluation_queue: {
        Row: {
          attempts: number
          generation: number
          last_error: string | null
          queued_at: string
          retry_at: string
          student_id: string
        }
        Insert: {
          attempts?: number
          generation?: number
          last_error?: string | null
          queued_at?: string
          retry_at?: string
          student_id: string
        }
        Update: {
          attempts?: number
          generation?: number
          last_error?: string | null
          queued_at?: string
          retry_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_care_evaluation_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_events: {
        Row: {
          actor_id: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          request_id: string | null
          student_id: string
          task_id: string | null
        }
        Insert: {
          actor_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          request_id?: string | null
          student_id: string
          task_id?: string | null
        }
        Update: {
          actor_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          request_id?: string | null
          student_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_care_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "student_care_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_monthly_contacts: {
        Row: {
          contact_event_id: string
          task_id: string
        }
        Insert: {
          contact_event_id: string
          task_id: string
        }
        Update: {
          contact_event_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_care_monthly_contacts_contact_event_id_fkey"
            columns: ["contact_event_id"]
            isOneToOne: true
            referencedRelation: "student_care_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_monthly_contacts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "student_care_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_settings: {
        Row: {
          enabled: boolean
          id: boolean
          initialized_at: string | null
          last_error: string | null
          last_reconcile_at: string | null
          last_success_at: string | null
          policy_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          initialized_at?: string | null
          last_error?: string | null
          last_reconcile_at?: string | null
          last_success_at?: string | null
          policy_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: boolean
          initialized_at?: string | null
          last_error?: string | null
          last_reconcile_at?: string | null
          last_success_at?: string | null
          policy_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_care_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_signal_state: {
        Row: {
          evaluated_at: string
          evidence: Json
          student_id: string
        }
        Insert: {
          evaluated_at?: string
          evidence?: Json
          student_id: string
        }
        Update: {
          evaluated_at?: string
          evidence?: Json
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_care_signal_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_care_tasks: {
        Row: {
          claim_due_at: string | null
          claimed_at: string | null
          completed_at: string | null
          contact_due_at: string | null
          detected_at: string
          due_at: string | null
          evidence: Json
          evidence_current: boolean
          first_contact_at: string | null
          id: string
          kind: string
          next_followup_at: string | null
          outcome: string | null
          owner_id: string | null
          period_month: string | null
          policy_version: number
          status: string
          student_id: string
          updated_at: string
          version: number
        }
        Insert: {
          claim_due_at?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          contact_due_at?: string | null
          detected_at?: string
          due_at?: string | null
          evidence?: Json
          evidence_current?: boolean
          first_contact_at?: string | null
          id?: string
          kind: string
          next_followup_at?: string | null
          outcome?: string | null
          owner_id?: string | null
          period_month?: string | null
          policy_version?: number
          status?: string
          student_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          claim_due_at?: string | null
          claimed_at?: string | null
          completed_at?: string | null
          contact_due_at?: string | null
          detected_at?: string
          due_at?: string | null
          evidence?: Json
          evidence_current?: boolean
          first_contact_at?: string | null
          id?: string
          kind?: string
          next_followup_at?: string | null
          outcome?: string | null
          owner_id?: string | null
          period_month?: string | null
          policy_version?: number
          status?: string
          student_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_care_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_care_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      student_enrollment_import_batches: {
        Row: {
          academic_year_code: string
          academic_year_id: string | null
          committed_at: string | null
          committed_by: string | null
          conflict_count: number
          created_at: string
          created_by: string | null
          id: string
          invalid_count: number
          matching_count: number
          metadata: Json
          new_count: number
          reason: string
          row_count: number
          source_filename: string
          source_sha256: string
          status: string
        }
        Insert: {
          academic_year_code: string
          academic_year_id?: string | null
          committed_at?: string | null
          committed_by?: string | null
          conflict_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invalid_count?: number
          matching_count?: number
          metadata?: Json
          new_count?: number
          reason: string
          row_count?: number
          source_filename: string
          source_sha256: string
          status?: string
        }
        Update: {
          academic_year_code?: string
          academic_year_id?: string | null
          committed_at?: string | null
          committed_by?: string | null
          conflict_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invalid_count?: number
          matching_count?: number
          metadata?: Json
          new_count?: number
          reason?: string
          row_count?: number
          source_filename?: string
          source_sha256?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollment_import_batches_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_import_batches_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollment_import_rows: {
        Row: {
          academic_year_code: string
          batch_id: string
          class_code: string
          classification: string
          created_at: string
          effective_from: string
          id: string
          registered_mode: string
          resolved_class_id: string | null
          resolved_enrollment_id: string | null
          resolved_student_id: string | null
          source_row: number
          student_public_code: string
          validation_code: string | null
          validation_message: string | null
        }
        Insert: {
          academic_year_code: string
          batch_id: string
          class_code: string
          classification: string
          created_at?: string
          effective_from: string
          id?: string
          registered_mode: string
          resolved_class_id?: string | null
          resolved_enrollment_id?: string | null
          resolved_student_id?: string | null
          source_row: number
          student_public_code: string
          validation_code?: string | null
          validation_message?: string | null
        }
        Update: {
          academic_year_code?: string
          batch_id?: string
          class_code?: string
          classification?: string
          created_at?: string
          effective_from?: string
          id?: string
          registered_mode?: string
          resolved_class_id?: string | null
          resolved_enrollment_id?: string | null
          resolved_student_id?: string | null
          source_row?: number
          student_public_code?: string
          validation_code?: string | null
          validation_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollment_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "student_enrollment_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_import_rows_resolved_class_id_fkey"
            columns: ["resolved_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_import_rows_resolved_enrollment_id_fkey"
            columns: ["resolved_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollment_import_rows_resolved_student_id_fkey"
            columns: ["resolved_student_id"]
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
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
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
          superseded_by_request_id: string | null
          topup_type: string
          transfer_code: string
          updated_at: string
        }
        Insert: {
          bonus_sessions?: number
          calculated_unit_price_vnd: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          superseded_by_request_id?: string | null
          topup_type?: string
          transfer_code: string
          updated_at?: string
        }
        Update: {
          bonus_sessions?: number
          calculated_unit_price_vnd?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
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
          superseded_by_request_id?: string | null
          topup_type?: string
          transfer_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_payment_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "student_payment_requests_superseded_by_request_id_fkey"
            columns: ["superseded_by_request_id"]
            isOneToOne: false
            referencedRelation: "student_payment_requests"
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
      student_tuition_rate_versions: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          reason: string
          student_id: string
          unit_price_vnd: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          reason: string
          student_id: string
          unit_price_vnd: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          reason?: string
          student_id?: string
          unit_price_vnd?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_tuition_rate_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tuition_rate_versions_student_id_fkey"
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
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
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
          clock_out_reason: string | null
          created_at: string
          id: string
          last_latitude: number | null
          last_location_accuracy: number | null
          last_location_at: string | null
          last_longitude: number | null
          staff_id: string
          staff_shift_assignment_id: string | null
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
          clock_out_reason?: string | null
          created_at?: string
          id?: string
          last_latitude?: number | null
          last_location_accuracy?: number | null
          last_location_at?: string | null
          last_longitude?: number | null
          staff_id: string
          staff_shift_assignment_id?: string | null
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
          clock_out_reason?: string | null
          created_at?: string
          id?: string
          last_latitude?: number | null
          last_location_accuracy?: number | null
          last_location_at?: string | null
          last_longitude?: number | null
          staff_id?: string
          staff_shift_assignment_id?: string | null
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
      tuition_collection_item_adjustments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          original_item_id: string
          reason: string
          replacement_item_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          original_item_id: string
          reason: string
          replacement_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          original_item_id?: string
          reason?: string
          replacement_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_collection_item_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_item_adjustments_original_item_id_fkey"
            columns: ["original_item_id"]
            isOneToOne: false
            referencedRelation: "tuition_collection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_item_adjustments_replacement_item_id_fkey"
            columns: ["replacement_item_id"]
            isOneToOne: true
            referencedRelation: "tuition_collection_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_collection_item_lines: {
        Row: {
          amount_vnd: number
          class_session_id: string | null
          id: string
          item_id: string
          line_kind: string
          payable_session_count: number
          session_count: number
          session_date: string | null
          session_kind: string | null
          snapshot: Json
          unit_price_vnd: number
        }
        Insert: {
          amount_vnd?: number
          class_session_id?: string | null
          id?: string
          item_id: string
          line_kind: string
          payable_session_count?: number
          session_count?: number
          session_date?: string | null
          session_kind?: string | null
          snapshot?: Json
          unit_price_vnd: number
        }
        Update: {
          amount_vnd?: number
          class_session_id?: string | null
          id?: string
          item_id?: string
          line_kind?: string
          payable_session_count?: number
          session_count?: number
          session_date?: string | null
          session_kind?: string | null
          snapshot?: Json
          unit_price_vnd?: number
        }
        Relationships: [
          {
            foreignKeyName: "tuition_collection_item_lines_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_item_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tuition_collection_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_collection_items: {
        Row: {
          acquisition_source_id: string | null
          class_id: string | null
          created_at: string
          created_by: string
          credit_offset_sessions: number
          debit_carry_sessions: number
          enrollment_id: string | null
          id: string
          opening_balance_sessions: number
          payable_amount_vnd: number
          payable_sessions: number
          payment_contract_snapshot: Json
          payment_request_id: string | null
          period_id: string
          receipt_template_snapshot: Json
          receipt_template_version_id: string | null
          reissued_from_item_id: string | null
          scheduled_chargeable_sessions: number
          source_snapshot: Json
          status: string
          student_id: string
          student_snapshot: Json
        }
        Insert: {
          acquisition_source_id?: string | null
          class_id?: string | null
          created_at?: string
          created_by: string
          credit_offset_sessions?: number
          debit_carry_sessions?: number
          enrollment_id?: string | null
          id?: string
          opening_balance_sessions: number
          payable_amount_vnd: number
          payable_sessions: number
          payment_contract_snapshot?: Json
          payment_request_id?: string | null
          period_id: string
          receipt_template_snapshot: Json
          receipt_template_version_id?: string | null
          reissued_from_item_id?: string | null
          scheduled_chargeable_sessions: number
          source_snapshot: Json
          status: string
          student_id: string
          student_snapshot: Json
        }
        Update: {
          acquisition_source_id?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string
          credit_offset_sessions?: number
          debit_carry_sessions?: number
          enrollment_id?: string | null
          id?: string
          opening_balance_sessions?: number
          payable_amount_vnd?: number
          payable_sessions?: number
          payment_contract_snapshot?: Json
          payment_request_id?: string | null
          period_id?: string
          receipt_template_snapshot?: Json
          receipt_template_version_id?: string | null
          reissued_from_item_id?: string | null
          scheduled_chargeable_sessions?: number
          source_snapshot?: Json
          status?: string
          student_id?: string
          student_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tuition_collection_items_acquisition_source_id_fkey"
            columns: ["acquisition_source_id"]
            isOneToOne: false
            referencedRelation: "crm_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: true
            referencedRelation: "student_payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "tuition_collection_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_receipt_template_version_id_fkey"
            columns: ["receipt_template_version_id"]
            isOneToOne: false
            referencedRelation: "tuition_receipt_template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_reissued_from_item_id_fkey"
            columns: ["reissued_from_item_id"]
            isOneToOne: false
            referencedRelation: "tuition_collection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_collection_periods: {
        Row: {
          created_at: string
          created_by: string
          due_on: string | null
          ends_on: string
          id: string
          locked_at: string | null
          locked_by: string | null
          name: string
          receipt_template_version_id: string | null
          starts_on: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_on?: string | null
          ends_on: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          name: string
          receipt_template_version_id?: string | null
          starts_on: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_on?: string | null
          ends_on?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          name?: string
          receipt_template_version_id?: string | null
          starts_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_collection_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_periods_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_collection_periods_receipt_template_version_id_fkey"
            columns: ["receipt_template_version_id"]
            isOneToOne: false
            referencedRelation: "tuition_receipt_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_receipt_template_versions: {
        Row: {
          content: Json
          id: string
          published_at: string
          published_by: string | null
          reason: string
          template_id: string
          version_number: number
        }
        Insert: {
          content?: Json
          id?: string
          published_at?: string
          published_by?: string | null
          reason: string
          template_id: string
          version_number: number
        }
        Update: {
          content?: Json
          id?: string
          published_at?: string
          published_by?: string | null
          reason?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tuition_receipt_template_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_receipt_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tuition_receipt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_receipt_templates: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_receipt_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      website_configuration: {
        Row: {
          draft: Json | null
          id: boolean
          published: Json | null
          updated_at: string
          version: number
        }
        Insert: {
          draft?: Json | null
          id?: boolean
          published?: Json | null
          updated_at?: string
          version?: number
        }
        Update: {
          draft?: Json | null
          id?: boolean
          published?: Json | null
          updated_at?: string
          version?: number
        }
        Relationships: []
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
      accept_my_account_invitation: { Args: never; Returns: boolean }
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
      add_coaching_note: {
        Args: { p_coaching_record_id: string; p_note: string }
        Returns: {
          id: string
        }[]
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
          evidence_snapshot: Json
          formula_snapshot: Json
          id: string
          line_type: string
          note: string | null
          payroll_statement_id: string
          policy_code: string | null
          quantity: number | null
          salary_advance_id: string | null
          source_id: string | null
          source_kind: string | null
          source_time_entry_id: string | null
          staff_daily_rate_version_id: string | null
          staff_rate_version_id: string | null
          unit_count: number | null
          unit_label: string | null
          unit_rate_vnd: number | null
          work_minutes: number | null
        }
        SetofOptions: {
          from: "*"
          to: "payroll_line_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_adjust_time_entry: {
        Args: {
          p_check_in_at: string
          p_check_out_at: string
          p_reason: string
          p_time_entry_id: string
        }
        Returns: {
          auto_ended_at: string | null
          check_in_at: string
          check_in_mode: string
          check_out_at: string | null
          check_out_mode: string | null
          clock_out_reason: string | null
          created_at: string
          id: string
          last_latitude: number | null
          last_location_accuracy: number | null
          last_location_at: string | null
          last_longitude: number | null
          staff_id: string
          staff_shift_assignment_id: string | null
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
      admin_create_time_entry: {
        Args: {
          p_check_in_at: string
          p_check_out_at: string
          p_mode: string
          p_notes: string
          p_staff_id: string
          p_work_date: string
        }
        Returns: {
          auto_ended_at: string | null
          check_in_at: string
          check_in_mode: string
          check_out_at: string | null
          check_out_mode: string | null
          clock_out_reason: string | null
          created_at: string
          id: string
          last_latitude: number | null
          last_location_accuracy: number | null
          last_location_at: string | null
          last_longitude: number | null
          staff_id: string
          staff_shift_assignment_id: string | null
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
      advance_coaching_status: {
        Args: {
          p_coaching_record_id: string
          p_note?: string
          p_outcome?: string
          p_target_status: string
        }
        Returns: {
          id: string
        }[]
      }
      allocate_payment_to_students: {
        Args: {
          p_allocations: Json
          p_guardian_id: string
          p_sepay_transaction_id: string
        }
        Returns: Json
      }
      allocate_sepay_tuition_manually: {
        Args: {
          p_allocations: Json
          p_reason: string
          p_sepay_transaction_id: string
        }
        Returns: Json
      }
      approve_payroll_period: {
        Args: { p_payroll_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
      approve_session_balance_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          excluded_count: number | null
          id: string
          invalid_count: number | null
          metadata: Json
          no_change_count: number | null
          posted_at: string | null
          posted_by: string | null
          posted_count: number | null
          reason: string
          reconciled_at: string | null
          reconciled_by: string | null
          review_count: number | null
          row_count: number | null
          source_filename: string
          source_sha256: string
          status: string
          valid_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "session_balance_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_payroll_configuration_date_allowed: {
        Args: { p_effective_from: string }
        Returns: undefined
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
      audit_coaching_form_mutation: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_reason?: string
        }
        Returns: undefined
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
      build_staff_payroll_estimate: {
        Args: { p_month: string; p_staff_id: string }
        Returns: Json
      }
      bulk_transition_student_lifecycle_status: {
        Args: {
          p_expected_count: number
          p_reason?: string
          p_source_status: string
          p_student_ids?: string[]
          p_target_status: string
        }
        Returns: Json
      }
      bump_payroll_live_revision: {
        Args: { p_month: string; p_scope: string; p_staff_id?: string }
        Returns: undefined
      }
      calculate_haversine_distance_m: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
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
      cancel_payment_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: {
          bonus_sessions: number
          calculated_unit_price_vnd: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
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
          superseded_by_request_id: string | null
          topup_type: string
          transfer_code: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_payment_requests"
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
          clock_out_reason: string | null
          created_at: string
          id: string
          last_latitude: number | null
          last_location_accuracy: number | null
          last_location_at: string | null
          last_longitude: number | null
          staff_id: string
          staff_shift_assignment_id: string | null
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
          clock_out_reason: string | null
          created_at: string
          id: string
          last_latitude: number | null
          last_location_accuracy: number | null
          last_location_at: string | null
          last_longitude: number | null
          staff_id: string
          staff_shift_assignment_id: string | null
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
      close_payroll_feedback: {
        Args: { p_payroll_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
      coaching_validate_question: {
        Args: { p_configuration: Json; p_question_type: string }
        Returns: boolean
      }
      commission_recognized_at_for_cashflow: {
        Args: {
          p_cashflow: Database["public"]["Tables"]["finance_cashflow_records"]["Row"]
        }
        Returns: string
      }
      commit_class_schedule_import_batch: {
        Args: { p_batch_id: string; p_reason: string }
        Returns: {
          academic_year_code: string
          academic_year_id: string | null
          class_conflict_count: number
          class_invalid_count: number
          class_matching_count: number
          class_new_count: number
          class_row_count: number
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          reason: string
          schedule_conflict_count: number
          schedule_invalid_count: number
          schedule_matching_count: number
          schedule_new_count: number
          schedule_row_count: number
          source_filename: string
          source_sha256: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "class_schedule_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      commit_student_enrollment_import_batch: {
        Args: { p_batch_id: string; p_reason: string }
        Returns: Json
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
      compute_payroll_projection: {
        Args: {
          p_as_of?: string
          p_mode?: string
          p_month: string
          p_target_staff_id?: string
        }
        Returns: Json
      }
      configure_staff_payroll_compensation: {
        Args: {
          p_effective_from: string
          p_note: string
          p_offline_daily_rate_vnd: number
          p_position_code: string
          p_reason: string
          p_staff_id: string
        }
        Returns: Json
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
      correct_student_acquisition_source: {
        Args: {
          p_lead_source_id: string
          p_reason: string
          p_student_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string
          crm_case_id: string | null
          id: string
          is_current: boolean
          lead_source_id: string
          reason: string
          student_id: string
          supersedes_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "student_acquisition_source_assignments"
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
      create_account_invitation: {
        Args: {
          invitation_reason: string
          target_email: string
          target_role_ids: string[]
        }
        Returns: {
          email: string
          invitation_id: string
          invited_at: string
        }[]
      }
      create_batch_class_sessions: {
        Args: { p_class_id: string; p_reason?: string; p_sessions: Json }
        Returns: Json
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
      create_class_component_link: {
        Args: {
          p_component_class_id: string
          p_component_order: number
          p_effective_from: string
          p_effective_to: string
          p_parent_class_id: string
          p_reason: string
        }
        Returns: {
          component_class_id: string
          component_order: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          parent_class_id: string
        }
        SetofOptions: {
          from: "*"
          to: "class_component_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_class_schedule_import_batch: {
        Args: {
          p_academic_year_code: string
          p_classes: Json
          p_reason: string
          p_schedules: Json
          p_source_filename: string
          p_source_sha256: string
        }
        Returns: {
          academic_year_code: string
          academic_year_id: string | null
          class_conflict_count: number
          class_invalid_count: number
          class_matching_count: number
          class_new_count: number
          class_row_count: number
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          reason: string
          schedule_conflict_count: number
          schedule_invalid_count: number
          schedule_matching_count: number
          schedule_new_count: number
          schedule_row_count: number
          source_filename: string
          source_sha256: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "class_schedule_import_batches"
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
      create_coaching_form_version_draft: {
        Args: { p_form_id: string }
        Returns: {
          form_version_id: string
          version_number: number
        }[]
      }
      create_coaching_record: {
        Args: {
          p_assistant_owner_id: string
          p_campaign_name: string
          p_priority: string
          p_reason: string
          p_review_at?: string
          p_student_id: string
        }
        Returns: {
          id: string
        }[]
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
      create_manual_payroll_source_fact: {
        Args: {
          p_amount_vnd: number
          p_event_date: string
          p_fact_type: string
          p_grade: number
          p_metadata: Json
          p_quantity: number
          p_source_code: string
          p_source_key: string
          p_staff_id: string
          p_student_id: string
        }
        Returns: {
          amount_vnd: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          event_date: string
          fact_type: string
          grade: number | null
          id: string
          import_batch_id: string | null
          import_row_id: string | null
          metadata: Json
          quantity: number | null
          source_code: string | null
          source_key: string
          source_origin: string
          staff_id: string | null
          student_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payroll_source_facts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payroll_draft: {
        Args: { p_period_month: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
      create_payroll_import_batch: {
        Args: {
          p_dataset_type: string
          p_file_name: string
          p_file_sha256: string
          p_period_month: string
          p_rows: Json
        }
        Returns: {
          conflict_rows: number
          dataset_type: string
          error_rows: number
          file_name: string
          file_sha256: string
          id: string
          period_month: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_rows: number
          uploaded_at: string
          uploaded_by: string
          valid_rows: number
        }
        SetofOptions: {
          from: "*"
          to: "payroll_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payroll_lead_source_mapping_version: {
        Args: {
          p_effective_from: string
          p_lead_source_id: string
          p_payroll_source_code: string
          p_reason: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          lead_source_id: string
          payroll_source_code: string
          reason: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_lead_source_mapping_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_payroll_policy_version: {
        Args: {
          p_effective_from: string
          p_parameters: Json
          p_policy_code: string
          p_reason: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          parameters: Json
          policy_code: string
          reason: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_policy_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_sepay_receiving_account_version: {
        Args: {
          p_account_display_name: string
          p_account_number: string
          p_bank_code: string
          p_effective_from: string
          p_purpose: string
          p_reason: string
          p_sepay_bank_account_id?: string
        }
        Returns: {
          account_display_name: string
          account_number: string
          audit_metadata: Json
          bank_code: string
          changed_at: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          purpose: string
          sepay_bank_account_id: string | null
          signed_account_number: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "sepay_receiving_account_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_session_balance_import_batch: {
        Args: {
          p_effective_on: string
          p_reason: string
          p_rows: Json
          p_source_filename: string
          p_source_sha256: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          excluded_count: number | null
          id: string
          invalid_count: number | null
          metadata: Json
          no_change_count: number | null
          posted_at: string | null
          posted_by: string | null
          posted_count: number | null
          reason: string
          reconciled_at: string | null
          reconciled_by: string | null
          review_count: number | null
          row_count: number | null
          source_filename: string
          source_sha256: string
          status: string
          valid_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "session_balance_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_daily_rate_version: {
        Args: {
          p_effective_from: string
          p_note: string
          p_offline_daily_rate_vnd: number
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          migrated_from_staff_rate_version_id: string | null
          note: string | null
          offline_daily_rate_vnd: number
          online_rate_basis_points: number
          reason: string
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_daily_rate_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_grade_assignment: {
        Args: {
          p_effective_from: string
          p_effective_to: string
          p_grade: number
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          grade: number
          id: string
          reason: string
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_grade_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_payroll_position_version: {
        Args: {
          p_effective_from: string
          p_position_code: string
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          effective_from: string
          id: string
          position_code: string
          reason: string
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_payroll_position_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_payroll_task_version: {
        Args: {
          p_effective_from: string
          p_is_enabled: boolean
          p_reason: string
          p_staff_id: string
          p_task_code: string
        }
        Returns: {
          created_at: string
          created_by: string
          effective_from: string
          id: string
          is_enabled: boolean
          reason: string
          staff_id: string
          task_code: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_payroll_task_versions"
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
          week_start: string | null
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
      create_student_enrollment_import_batch: {
        Args: {
          p_academic_year_code: string
          p_reason: string
          p_rows: Json
          p_source_filename: string
          p_source_sha256: string
        }
        Returns: Json
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
      create_student_tuition_rate_version: {
        Args: {
          p_effective_from: string
          p_reason: string
          p_student_id: string
          p_unit_price_vnd: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          reason: string
          student_id: string
          unit_price_vnd: number
        }
        SetofOptions: {
          from: "*"
          to: "student_tuition_rate_versions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      create_tuition_collection_period: {
        Args: {
          p_due_on?: string
          p_ends_on: string
          p_name: string
          p_receipt_template_version_id?: string
          p_starts_on: string
        }
        Returns: {
          created_at: string
          created_by: string
          due_on: string | null
          ends_on: string
          id: string
          locked_at: string | null
          locked_by: string | null
          name: string
          receipt_template_version_id: string | null
          starts_on: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "tuition_collection_periods"
          isOneToOne: true
          isSetofReturn: false
        }
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
      decide_attendance_exception: {
        Args: { p_decision: string; p_entry_id: string; p_reason: string }
        Returns: string
      }
      decide_payroll_import_batch: {
        Args: { p_batch_id: string; p_decision: string; p_review_note: string }
        Returns: {
          conflict_rows: number
          dataset_type: string
          error_rows: number
          file_name: string
          file_sha256: string
          id: string
          period_month: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_rows: number
          uploaded_at: string
          uploaded_by: string
          valid_rows: number
        }
        SetofOptions: {
          from: "*"
          to: "payroll_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_staff_bank_account_change: {
        Args: {
          p_decision: string
          p_request_id: string
          p_review_note: string
        }
        Returns: {
          account_holder_name: string
          account_number: string
          bank_name: string
          effective_from: string
          id: string
          reason: string
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
          to: "staff_bank_account_change_requests"
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
      delete_staff_account: {
        Args: { deletion_reason: string; target_user_id: string }
        Returns: Json
      }
      dry_run_class_schedule_import: {
        Args: {
          p_academic_year_code: string
          p_classes: Json
          p_schedules: Json
        }
        Returns: Json
      }
      dry_run_class_session_generation: {
        Args: {
          p_academic_year_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: Json
      }
      dry_run_session_balance_import_rows: {
        Args: { p_effective_on: string; p_rows: Json }
        Returns: Json
      }
      dry_run_student_enrollment_import: {
        Args: { p_academic_year_code: string; p_rows: Json }
        Returns: Json
      }
      end_class_component_link: {
        Args: { p_effective_to: string; p_link_id: string; p_reason: string }
        Returns: {
          component_class_id: string
          component_order: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          parent_class_id: string
        }
        SetofOptions: {
          from: "*"
          to: "class_component_links"
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
      end_staff_grade_assignment: {
        Args: {
          p_assignment_id: string
          p_effective_to: string
          p_reason: string
        }
        Returns: {
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          grade: number
          id: string
          reason: string
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_grade_assignments"
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
          week_start: string | null
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
      exclude_session_balance_import_row: {
        Args: { p_excluded_reason: string; p_row_id: string }
        Returns: {
          batch_id: string
          created_at: string
          current_balance_before: number | null
          delta_sessions: number | null
          excluded_reason: string | null
          expected_balance_after: number | null
          id: string
          ledger_entry_id: string | null
          source_balance: number
          source_row_number: number
          source_student_name: string | null
          student_enrollment_id: string | null
          student_id: string | null
          student_public_code: string
          validation_code: string | null
          validation_message: string | null
          validation_status: string
        }
        SetofOptions: {
          from: "*"
          to: "session_balance_import_rows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_sepay_payment_candidates: {
        Args: { p_code: string; p_content: string }
        Returns: string[]
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
      format_student_payment_transfer_code: {
        Args: {
          p_guardian_id: string
          p_public_code: string
          p_student_id: string
        }
        Returns: string
      }
      generate_payroll_calculation_run: {
        Args: { p_payroll_period_id: string; p_reason: string }
        Returns: {
          generated_at: string
          generated_by: string
          id: string
          payroll_period_id: string
          reason: string
          revision: number
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_calculation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_attendance_exception_reviews: { Args: never; Returns: Json }
      get_attendance_verification_config: { Args: never; Returns: Json }
      get_attendance_verification_policy: { Args: never; Returns: Json }
      get_attendance_verification_policy_before_endpoint: {
        Args: never
        Returns: Json
      }
      get_center_display_name: { Args: never; Returns: string }
      get_center_monthly_timekeeping_overview: {
        Args: { p_month: number; p_year: number }
        Returns: {
          auto_ended_count: number
          pending_adjustment_count: number
          primary_role_name: string
          staff_display_name: string
          staff_employee_code: string
          staff_id: string
          total_entries: number
          total_hours: number
          total_work_days: number
        }[]
      }
      get_coaching_assignee_options: {
        Args: never
        Returns: {
          display_name: string
          profile_id: string
          role_code: string
        }[]
      }
      get_coaching_form_detail: {
        Args: { p_form_id: string }
        Returns: {
          configuration: Json
          form_id: string
          form_status: string
          instructions: string
          is_required: boolean
          name: string
          question_description: string
          question_id: string
          question_title: string
          question_type: string
          sort_order: number
          title: string
          version_id: string
          version_number: number
          version_status: string
        }[]
      }
      get_coaching_form_responses: {
        Args: { p_coaching_record_id: string }
        Returns: {
          form_name: string
          response_id: string
          student_name: string
          submitted_at: string
          version_number: number
        }[]
      }
      get_coaching_forms: {
        Args: never
        Returns: {
          form_id: string
          form_status: string
          instructions: string
          name: string
          published_at: string
          response_count: number
          title: string
          version_id: string
          version_number: number
          version_status: string
        }[]
      }
      get_coaching_public_links: {
        Args: { p_coaching_record_id: string }
        Returns: {
          expires_at: string
          form_name: string
          form_version_id: string
          issued_at: string
          link_id: string
          revoke_reason: string
          revoked_at: string
          status: string
          version_number: number
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
      get_coaching_response_detail: {
        Args: { p_response_id: string }
        Returns: {
          answer: Json
          coaching_record_id: string
          form_id: string
          form_name: string
          form_version_id: string
          question_description: string
          question_id: string
          question_title: string
          question_type: string
          response_id: string
          sort_order: number
          student_id: string
          student_name: string
          submitted_at: string
          version_number: number
        }[]
      }
      get_coaching_responses: {
        Args: {
          p_form_id?: string
          p_form_version_id?: string
          p_from?: string
          p_student_id?: string
          p_to?: string
        }
        Returns: {
          coaching_record_id: string
          form_id: string
          form_name: string
          form_version_id: string
          response_id: string
          student_id: string
          student_name: string
          submitted_at: string
          version_number: number
        }[]
      }
      get_coaching_student_options: {
        Args: { p_limit?: number }
        Returns: {
          lifecycle_status: string
          student_full_name: string
          student_id: string
          student_public_code: string
        }[]
      }
      get_dashboard_executive_overview: {
        Args: { p_month?: string }
        Returns: Json
      }
      get_effective_sepay_receiving_account: {
        Args: { p_effective_on?: string; p_purpose: string }
        Returns: {
          account_display_name: string
          account_number: string
          account_version_id: string
          bank_code: string
          purpose: string
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
      get_finance_order_operating_cost: {
        Args: {
          p_order_type: string
          p_source_code: string
          p_source_group: string
          p_tuition_amount_vnd: number
        }
        Returns: {
          mechanism_code: string
          operating_cost_vnd: number
          status: string
        }[]
      }
      get_finance_order_settlement_period: {
        Args: { p_at: string }
        Returns: number
      }
      get_finance_orders_dashboard: {
        Args: {
          p_month: string
          p_order_type?: string
          p_period?: number
          p_source?: string
        }
        Returns: Json
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
      get_learning_results_directory: {
        Args: { p_limit?: number }
        Returns: {
          class_code: string
          class_grade: number
          class_id: string
          class_level: string
          class_name: string
          class_session_id: string
          current_grade: number
          graded_at: string
          locked_at: string
          notebook_score: number
          notebook_status: string
          result_comment: string
          result_id: string
          session_date: string
          session_status: string
          student_code: string
          student_id: string
          student_name: string
          test_score: number
        }[]
      }
      get_my_monthly_timekeeping_entries: {
        Args: { p_month: number; p_year: number }
        Returns: {
          adjusted_check_in_at: string
          adjusted_check_out_at: string
          adjustment_status: string
          auto_ended_at: string
          check_in_at: string
          check_in_mode: string
          check_out_at: string
          check_out_mode: string
          clock_out_reason: string
          entry_id: string
          entry_status: string
          has_check_in_gps_evidence: boolean
          has_check_in_wifi_evidence: boolean
          has_check_out_gps_evidence: boolean
          has_check_out_wifi_evidence: boolean
          is_unscheduled: boolean
          total_minutes: number
          work_date: string
          work_shift_code: string
          work_shift_name: string
        }[]
      }
      get_my_payroll_estimate: { Args: { p_month: string }; Returns: Json }
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
          clock_out_reason: string
          entry_id: string
          entry_status: string
          has_check_in_gps_evidence: boolean
          has_check_in_wifi_evidence: boolean
          has_check_out_gps_evidence: boolean
          has_check_out_wifi_evidence: boolean
          is_unscheduled: boolean
          last_location_at: string
          scheduled_end_time: string
          scheduled_start_time: string
          work_date: string
          work_shift_code: string
          work_shift_name: string
        }[]
      }
      get_my_timekeeping_status: { Args: never; Returns: Json }
      get_owner_payroll_dashboard: {
        Args: { p_position_code?: string; p_selected_month: string }
        Returns: Json
      }
      get_owner_payroll_estimate: {
        Args: { p_month: string; p_position_code?: string }
        Returns: Json
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
      get_payroll_explanations: { Args: never; Returns: Json }
      get_payroll_management_overview: { Args: never; Returns: Json }
      get_payroll_periods_with_details: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["payroll_periods_with_details_row"][]
        SetofOptions: {
          from: "*"
          to: "payroll_periods_with_details_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_coaching_form: {
        Args: { p_token: string }
        Returns: {
          configuration: Json
          form_title: string
          form_version_id: string
          instructions: string
          is_required: boolean
          question_description: string
          question_id: string
          question_title: string
          question_type: string
          sort_order: number
          state: string
          student_name: string
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
          recognized_on: string
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
      get_sepay_allocation_details: {
        Args: { p_sepay_transaction_id: string }
        Returns: {
          allocated_amount_vnd: number
          allocated_at: string
          allocated_by_name: string
          allocated_sessions: number
          bonus_sessions: number
          notes: string
          payment_request_code: string
          student_code: string
          student_name: string
          unit_price_vnd: number
        }[]
      }
      get_staff_monthly_timekeeping_entries: {
        Args: { p_month: number; p_staff_id: string; p_year: number }
        Returns: {
          adjusted_check_in_at: string
          adjusted_check_out_at: string
          adjustment_status: string
          auto_ended_at: string
          check_in_at: string
          check_in_mode: string
          check_out_at: string
          check_out_mode: string
          clock_out_reason: string
          entry_id: string
          entry_status: string
          has_check_in_gps_evidence: boolean
          has_check_in_wifi_evidence: boolean
          has_check_out_gps_evidence: boolean
          has_check_out_wifi_evidence: boolean
          is_unscheduled: boolean
          total_minutes: number
          work_date: string
          work_shift_code: string
          work_shift_name: string
        }[]
      }
      get_staff_payroll_estimate: {
        Args: { p_month: string; p_staff_id: string }
        Returns: Json
      }
      get_staff_payroll_profile: { Args: { p_staff_id: string }; Returns: Json }
      get_student_care_dashboard: { Args: { p_filter?: Json }; Returns: Json }
      get_student_care_detail: { Args: { p_task_id: string }; Returns: Json }
      get_student_care_students: {
        Args: { p_inactive?: boolean; p_page?: number; p_search?: string }
        Returns: Json
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
      get_weekly_shift_schedule: {
        Args: { p_week_start: string }
        Returns: Json
      }
      has_permission: {
        Args: { required_permission: string }
        Returns: boolean
      }
      ingest_sepay_api_v2_sync_page: {
        Args: {
          p_expected_page: number
          p_has_more: boolean
          p_sync_run_id: string
          p_total_available: number
          p_transactions: Json
        }
        Returns: Json
      }
      ingest_sepay_api_v2_transaction: {
        Args: {
          p_account_number: string
          p_amount_in: number
          p_amount_out: number
          p_body_raw?: Json
          p_code: string
          p_content: string
          p_gateway: string
          p_reference_number?: string
          p_sepay_v2_id: string
          p_transaction_date: string
          p_transfer_type: string
        }
        Returns: Json
      }
      ingest_sepay_api_v2_transactions_batch: {
        Args: { p_transactions: Json }
        Returns: Json
      }
      ingest_sepay_transaction_record: {
        Args: {
          p_account_number: string
          p_account_purpose: string
          p_amount_in: number
          p_amount_out: number
          p_code: string
          p_content: string
          p_external_transaction_id: string
          p_gateway: string
          p_ingestion_source: string
          p_reference_number: string
          p_sepay_v2_id: string
          p_sepay_webhook_id: string
          p_source_payload: Json
          p_transaction_date: string
          p_transfer_type: string
        }
        Returns: {
          current_match_status: string
          identity_status: string
          transaction_id: string
        }[]
      }
      is_active_owner: { Args: never; Returns: boolean }
      is_user_teaching_assistant: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      issue_coaching_public_link: {
        Args: {
          p_coaching_record_id: string
          p_expires_at: string
          p_form_version_id: string
          p_token_hash: string
        }
        Returns: {
          link_id: string
        }[]
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
      lock_tuition_collection_period: {
        Args: { p_period_id: string }
        Returns: Json
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
      mark_payroll_period_paid: {
        Args: {
          p_note?: string
          p_paid_on: string
          p_payment_reference?: string
          p_payroll_period_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
      match_sepay_historical_transaction_to_payment_request: {
        Args: {
          p_payment_request_id: string
          p_reason: string
          p_sepay_transaction_id: string
        }
        Returns: Json
      }
      materialize_class_sessions: {
        Args: {
          p_academic_year_id: string
          p_allow_backfill?: boolean
          p_end_date: string
          p_reason?: string
          p_start_date: string
        }
        Returns: Json
      }
      mutate_student_care: { Args: { p_command: Json }; Returns: Json }
      next_student_ledger_event_key: {
        Args: { p_base: string }
        Returns: string
      }
      next_student_public_code: { Args: never; Returns: string }
      normalize_payment_reference: {
        Args: { p_value: string }
        Returns: string
      }
      normalize_sepay_receiving_account_number: {
        Args: { p_account_number: string }
        Returns: string
      }
      normalize_student_name: { Args: { name_value: string }; Returns: string }
      normalize_vietnam_phone: {
        Args: { phone_value: string }
        Returns: string
      }
      post_session_balance_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          excluded_count: number | null
          id: string
          invalid_count: number | null
          metadata: Json
          no_change_count: number | null
          posted_at: string | null
          posted_by: string | null
          posted_count: number | null
          reason: string
          reconciled_at: string | null
          reconciled_by: string | null
          review_count: number | null
          row_count: number | null
          source_filename: string
          source_sha256: string
          status: string
          valid_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "session_balance_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      preview_tuition_collection_period: {
        Args: { p_period_id: string }
        Returns: {
          acquisition_source_id: string
          blocker_code: string
          class_id: string
          class_session_id: string
          enrollment_id: string
          opening_balance_sessions: number
          session_date: string
          session_kind: string
          student_id: string
          unit_price_vnd: number
        }[]
      }
      process_sepay_webhook_transaction: {
        Args: {
          p_account_number: string
          p_account_purpose: string
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
      publish_coaching_form_version: {
        Args: { p_form_version_id: string }
        Returns: {
          form_id: string
          form_version_id: string
          version_number: number
        }[]
      }
      publish_tuition_receipt_template_version: {
        Args: {
          p_code: string
          p_content: Json
          p_name: string
          p_reason: string
        }
        Returns: {
          content: Json
          id: string
          published_at: string
          published_by: string | null
          reason: string
          template_id: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "tuition_receipt_template_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      read_app_branding: { Args: never; Returns: Json }
      read_published_website: { Args: never; Returns: Json }
      read_website_configuration: { Args: never; Returns: Json }
      reconcile_session_balance_import_batch: {
        Args: { p_batch_id: string; p_reason: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          excluded_count: number | null
          id: string
          invalid_count: number | null
          metadata: Json
          no_change_count: number | null
          posted_at: string | null
          posted_by: string | null
          posted_count: number | null
          reason: string
          reconciled_at: string | null
          reconciled_by: string | null
          review_count: number | null
          row_count: number | null
          source_filename: string
          source_sha256: string
          status: string
          valid_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "session_balance_import_batches"
          isOneToOne: true
          isSetofReturn: false
        }
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
      reissue_tuition_collection_item: {
        Args: {
          p_original_item_id: string
          p_payable_amount_vnd: number
          p_reason: string
        }
        Returns: {
          acquisition_source_id: string | null
          class_id: string | null
          created_at: string
          created_by: string
          credit_offset_sessions: number
          debit_carry_sessions: number
          enrollment_id: string | null
          id: string
          opening_balance_sessions: number
          payable_amount_vnd: number
          payable_sessions: number
          payment_contract_snapshot: Json
          payment_request_id: string | null
          period_id: string
          receipt_template_snapshot: Json
          receipt_template_version_id: string | null
          reissued_from_item_id: string | null
          scheduled_chargeable_sessions: number
          source_snapshot: Json
          status: string
          student_id: string
          student_snapshot: Json
        }
        SetofOptions: {
          from: "*"
          to: "tuition_collection_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_payroll_period: {
        Args: { p_payroll_period_id: string; p_reason: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
      reopen_payroll_to_draft: {
        Args: { p_payroll_period_id: string; p_reason: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
          week_start: string | null
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
      request_attendance_exception: {
        Args: {
          p_operation: string
          p_reason: string
          p_request_id: string
          p_time_entry_id?: string
        }
        Returns: string
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
      reset_payroll_draft: {
        Args: {
          p_confirmation: string
          p_expected_revision: number
          p_payroll_period_id: string
          p_reason: string
        }
        Returns: {
          generated_at: string
          generated_by: string
          id: string
          payroll_period_id: string
          reason: string
          revision: number
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_calculation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_unlocked_class_session_before_start: {
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
      resolve_class_session_roster: {
        Args: { p_class_session_id: string }
        Returns: {
          enrollment_class_id: string
          registered_mode: string
          session_class_id: string
          student_enrollment_id: string
          student_id: string
        }[]
      }
      resolve_class_session_rosters: {
        Args: { p_class_session_ids: string[] }
        Returns: {
          class_session_id: string
          enrollment_class_id: string
          registered_mode: string
          session_class_id: string
          student_enrollment_id: string
          student_id: string
        }[]
      }
      resolve_class_session_rosters_for_tuition: {
        Args: { p_class_session_ids: string[] }
        Returns: {
          class_session_id: string
          enrollment_class_id: string
          registered_mode: string
          session_class_id: string
          student_enrollment_id: string
          student_id: string
        }[]
      }
      resolve_payroll_correction_request: {
        Args: {
          p_decision: string
          p_request_id: string
          p_response_message: string
        }
        Returns: {
          id: string
          payroll_period_id: string
          payroll_statement_id: string
          request_message: string
          requested_at: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          response_message: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_correction_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_payroll_import_conflict: {
        Args: { p_reason: string; p_resolution: string; p_row_id: string }
        Returns: {
          batch_id: string
          conflict_payload: Json | null
          created_at: string
          id: string
          normalized_payload: Json | null
          raw_payload: Json
          resolution: string | null
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          row_number: number
          source_key: string
          validation_errors: Json
          validation_status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_import_rows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_sepay_historical_transaction: {
        Args: {
          p_reason: string
          p_resolution: string
          p_sepay_transaction_id: string
        }
        Returns: Json
      }
      resolve_sepay_receiving_account: {
        Args: { p_signed_account_number: string; p_transaction_at: string }
        Returns: {
          account_display_name: string
          account_number: string
          account_version_id: string
          bank_code: string
          purpose: string
          signed_account_number: string
        }[]
      }
      resolve_staff_shift_for_checkin: {
        Args: { p_date: string; p_staff_id: string; p_time: string }
        Returns: string
      }
      resolve_staff_shift_on_date: {
        Args: { p_staff_id: string; p_work_date: string }
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
          week_start: string | null
          weekday: number
          work_shift_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "staff_shift_assignments"
          isOneToOne: false
          isSetofReturn: true
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
      retire_sepay_receiving_account_version: {
        Args: {
          p_account_version_id: string
          p_effective_to: string
          p_reason: string
        }
        Returns: {
          account_display_name: string
          account_number: string
          audit_metadata: Json
          bank_code: string
          changed_at: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          purpose: string
          sepay_bank_account_id: string | null
          signed_account_number: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "sepay_receiving_account_versions"
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
      reverse_sepay_allocation: {
        Args: { p_reason: string; p_sepay_transaction_id: string }
        Returns: Json
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
      revoke_account_invitation: {
        Args: { revocation_reason: string; target_invitation_id: string }
        Returns: boolean
      }
      revoke_coaching_public_link: {
        Args: { p_link_id: string; p_reason: string }
        Returns: undefined
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
      run_student_care_worker: { Args: never; Returns: Json }
      run_teaching_assistant_timekeeping_watchdog: {
        Args: never
        Returns: number
      }
      save_coaching_form_draft: {
        Args: {
          p_form_id: string
          p_instructions: string
          p_name: string
          p_questions: Json
          p_title: string
        }
        Returns: {
          form_id: string
          form_version_id: string
          version_number: number
        }[]
      }
      save_weekly_shift_assignment: {
        Args: {
          p_expected_assignment_id: string
          p_expected_updated_at: string
          p_reason: string
          p_staff_id: string
          p_week_start: string
          p_weekday: number
          p_work_shift_id: string
        }
        Returns: string
      }
      search_sepay_allocation_students: {
        Args: { p_search: string }
        Returns: {
          birth_year: number
          guardian_id: string
          guardian_name: string
          guardian_phone: string
          pending_requests: Json
          student_code: string
          student_id: string
          student_name: string
        }[]
      }
      search_sepay_reconciliation_candidates: {
        Args: {
          p_limit?: number
          p_search?: string
          p_sepay_transaction_id: string
        }
        Returns: {
          expected_amount_vnd: number
          public_code: string
          request_id: string
          student_full_name: string
          topup_type: string
        }[]
      }
      set_attendance_verification_config: {
        Args: {
          p_attendance_radius_m: number
          p_center_latitude: number
          p_center_longitude: number
          p_center_name: string
          p_gps_max_accuracy_m: number
          p_wifi_networks: Json
          p_wifi_required_for_offline: boolean
        }
        Returns: Json
      }
      set_finance_order_review: {
        Args: { p_is_checked: boolean; p_source_cashflow_record_id: string }
        Returns: Json
      }
      set_role_permissions: {
        Args: {
          change_reason: string
          target_permission_ids: string[]
          target_role_id: string
        }
        Returns: number
      }
      set_sepay_receiving_account_api_identity: {
        Args: {
          p_account_version_id: string
          p_reason: string
          p_sepay_bank_account_id: string
        }
        Returns: {
          account_display_name: string
          account_number: string
          audit_metadata: Json
          bank_code: string
          changed_at: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          purpose: string
          sepay_bank_account_id: string | null
          signed_account_number: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "sepay_receiving_account_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_tuition_period_student_rates: {
        Args: {
          p_period_id: string
          p_reason: string
          p_student_ids: string[]
          p_unit_price_vnd: number
        }
        Returns: Json
      }
      set_tuition_period_student_sources: {
        Args: {
          p_lead_source_id: string
          p_period_id: string
          p_reason: string
          p_student_ids: string[]
        }
        Returns: Json
      }
      set_user_roles: {
        Args: {
          change_reason: string
          target_role_ids: string[]
          target_user_id: string
        }
        Returns: number
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
      student_care_authorize: {
        Args: { p_permission: string }
        Returns: undefined
      }
      student_care_calculate: { Args: { p_student: string }; Returns: Json }
      student_care_eligible_user: {
        Args: { p_role?: string; p_user: string }
        Returns: boolean
      }
      student_care_enqueue: { Args: { p_student: string }; Returns: undefined }
      student_care_evaluate: { Args: { p_student: string }; Returns: undefined }
      student_care_notify: {
        Args: {
          p_audience?: string
          p_event: string
          p_key: string
          p_task: string
        }
        Returns: undefined
      }
      student_care_observations: {
        Args: { p_student: string }
        Returns: {
          attendance_status: string
          class_name: string
          session_date: string
          session_id: string
          start_time: string
          test_score: number
        }[]
      }
      student_care_reconcile: { Args: never; Returns: undefined }
      student_care_remind: { Args: never; Returns: undefined }
      student_payment_transfer_identity: {
        Args: { p_guardian_id: string; p_student_id: string }
        Returns: string
      }
      submit_attendance_heartbeat: {
        Args: {
          p_gps_accuracy_meters: number
          p_gps_latitude: number
          p_gps_longitude: number
        }
        Returns: Json
      }
      submit_payroll_correction_request: {
        Args: {
          p_items: Json
          p_payroll_statement_id: string
          p_request_message: string
        }
        Returns: {
          id: string
          payroll_period_id: string
          payroll_statement_id: string
          request_message: string
          requested_at: string
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          response_message: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payroll_correction_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_payroll_for_review: {
        Args: { p_payroll_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          current_calculation_run_id: string | null
          feedback_closed_at: string | null
          feedback_closed_by: string | null
          feedback_opened_at: string
          generated_at: string
          generated_by: string
          id: string
          paid_at: string | null
          paid_by: string | null
          paid_on: string | null
          pay_date: string
          payment_note: string | null
          payment_reference: string | null
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
      submit_public_coaching_form: {
        Args: { p_answers: Json; p_token: string }
        Returns: string
      }
      submit_staff_bank_account_change: {
        Args: {
          p_account_holder_name: string
          p_account_number: string
          p_bank_name: string
          p_effective_from: string
          p_reason: string
          p_staff_id: string
        }
        Returns: {
          account_holder_name: string
          account_number: string
          bank_name: string
          effective_from: string
          id: string
          reason: string
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
          to: "staff_bank_account_change_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_sepay_allocation_matches: {
        Args: { p_limit?: number }
        Returns: {
          account_purpose: string
          amount_vnd: number
          birth_year: number
          candidate_count: number
          candidate_rank: number
          confidence: string
          current_grade: number
          guardian_name: string
          guardian_phone: string
          match_reasons: string[]
          match_status: string
          pending_request_id: string
          student_code: string
          student_id: string
          student_name: string
          suggested_sessions: number
          transaction_at: string
          transaction_id: string
          transfer_content: string
          unit_price_vnd: number
        }[]
      }
      sync_payroll_order_facts: {
        Args: { p_period_month: string }
        Returns: number
      }
      time_entry_is_verified: { Args: { p_entry_id: string }; Returns: boolean }
      timekeeping_daily_cutoff: {
        Args: { p_staff_id: string }
        Returns: string
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
      tuition_period_overlaps_locked: {
        Args: { p_ends_on: string; p_period_id: string; p_starts_on: string }
        Returns: boolean
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
      update_system_settings: { Args: { p_values: Json }; Returns: Json }
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
      validate_offline_attendance_evidence: {
        Args: {
          p_gps_accuracy_meters: number
          p_gps_latitude: number
          p_gps_longitude: number
          p_wifi_bssid: string
          p_wifi_ssid: string
        }
        Returns: number
      }
      validate_student_import_rows: { Args: { p_rows: Json }; Returns: Json }
      write_website_configuration: {
        Args: { p_draft: Json; p_operation: string; p_version: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      payroll_periods_with_details_row: {
        payroll_period_id: string | null
        period_month: string | null
        pay_date: string | null
        period_status: string | null
        payroll_statement_id: string | null
        staff_id: string | null
        staff_display_name: string | null
        staff_employee_code: string | null
        work_units: number | null
        work_hours: number | null
        total_earnings_vnd: number | null
        total_deductions_vnd: number | null
        payable_amount_vnd: number | null
        payroll_line_item_id: string | null
        line_type: string | null
        line_direction: string | null
        line_amount_vnd: number | null
        unit_count: number | null
        unit_rate_vnd: number | null
        note: string | null
      }
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

