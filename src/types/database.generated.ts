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
      get_my_permissions: {
        Args: never
        Returns: {
          permission_code: string
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
  public: {
    Enums: {},
  },
} as const
