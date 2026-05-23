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
      attendance: {
        Row: {
          billing_cycle_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          team_member_id: string
        }
        Insert: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          team_member_id: string
        }
        Update: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          billing_cycle_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          total_leads: number
        }
        Insert: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          total_leads?: number
        }
        Update: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          total_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "batches_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: []
      }
      kpi_metrics: {
        Row: {
          billing_cycle_id: string | null
          call_attempts: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          talk_time_minutes: number
          team_member_id: string
        }
        Insert: {
          billing_cycle_id?: string | null
          call_attempts?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          talk_time_minutes?: number
          team_member_id: string
        }
        Update: {
          billing_cycle_id?: string | null
          call_attempts?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          talk_time_minutes?: number
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_metrics_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_metrics_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_date: string
          batch_id: string | null
          billing_cycle_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_email: string | null
          lead_name: string
          lead_phone: string | null
          leads_count: number
          notes: string | null
          revenue_generated: number
          status: Database["public"]["Enums"]["lead_status"]
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_date?: string
          batch_id?: string | null
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_email?: string | null
          lead_name: string
          lead_phone?: string | null
          leads_count?: number
          notes?: string | null
          revenue_generated?: number
          status?: Database["public"]["Enums"]["lead_status"]
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_date?: string
          batch_id?: string | null
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string
          lead_phone?: string | null
          leads_count?: number
          notes?: string | null
          revenue_generated?: number
          status?: Database["public"]["Enums"]["lead_status"]
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_targets: {
        Row: {
          billing_cycle_id: string | null
          created_at: string
          created_by: string | null
          id: string
          leads_target: number
          notes: string | null
          revenue_target: number
          team_member_id: string
          updated_at: string
        }
        Insert: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          leads_target?: number
          notes?: string | null
          revenue_target?: number
          team_member_id: string
          updated_at?: string
        }
        Update: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          leads_target?: number
          notes?: string | null
          revenue_target?: number
          team_member_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      revenue_entries: {
        Row: {
          amount: number
          batch_id: string | null
          billing_cycle_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          team_member_id: string | null
        }
        Insert: {
          amount?: number
          batch_id?: string | null
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          team_member_id?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string | null
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          team_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_entries_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          joined_date: string
          name: string
          phone: string | null
          profile_id: string | null
          role: string | null
          team_group: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          joined_date?: string
          name: string
          phone?: string | null
          profile_id?: string | null
          role?: string | null
          team_group?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          joined_date?: string
          name?: string
          phone?: string | null
          profile_id?: string | null
          role?: string | null
          team_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_targets: {
        Row: {
          billing_cycle_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          notes: string | null
          target_leads: number
          target_revenue: number
          team_member_id: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          target_leads?: number
          target_revenue?: number
          team_member_id?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          billing_cycle_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          target_leads?: number
          target_revenue?: number
          team_member_id?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_targets_billing_cycle_id_fkey"
            columns: ["billing_cycle_id"]
            isOneToOne: false
            referencedRelation: "billing_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_targets_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "team_member"
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "leave"
        | "week_off"
      lead_status: "new" | "in_progress" | "converted" | "lost" | "follow_up"
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
    Enums: {
      app_role: ["admin", "manager", "team_member"],
      attendance_status: ["present", "absent", "half_day", "leave", "week_off"],
      lead_status: ["new", "in_progress", "converted", "lost", "follow_up"],
    },
  },
} as const
