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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
        }
        Relationships: []
      }
      balances: {
        Row: {
          balance: number
          bonus: number
          locked: number
          profit: number
          referral_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bonus?: number
          locked?: number
          profit?: number
          referral_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bonus?: number
          locked?: number
          profit?: number
          referral_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          credited_at: string | null
          id: string
          message_id: number | null
          status: string
          tx_hash: string | null
          unique_amount: number
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          credited_at?: string | null
          id?: string
          message_id?: number | null
          status?: string
          tx_hash?: string | null
          unique_amount: number
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          credited_at?: string | null
          id?: string
          message_id?: number | null
          status?: string
          tx_hash?: string | null
          unique_amount?: number
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: number
          name: string
          payload: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          payload?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          payload?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          active: boolean
          active_referrals: number
          id: string
          reward_amount: number
        }
        Insert: {
          active?: boolean
          active_referrals: number
          id?: string
          reward_amount: number
        }
        Update: {
          active?: boolean
          active_referrals?: number
          id?: string
          reward_amount?: number
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          referral_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind?: string
          referral_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          referral_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          qualified_at: string | null
          referred_id: string
          referrer_id: string
          reward_amount: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_id: string
          referrer_id: string
          reward_amount?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      trades: {
        Row: {
          amount: number
          confidence: number
          current_price: number
          direction: string
          duration_minutes: number
          entry_price: number
          expires_at: string
          id: string
          last_update_at: string
          leverage: number
          message_id: number | null
          opened_at: string
          pnl: number | null
          potential_loss: number
          potential_profit: number
          result: string | null
          risk_profile: string
          settled_at: string | null
          status: string
          stop_loss: number
          symbol: string
          take_profit: number
          target_outcome: string | null
          user_id: string
        }
        Insert: {
          amount: number
          confidence?: number
          current_price: number
          direction: string
          duration_minutes: number
          entry_price: number
          expires_at: string
          id?: string
          last_update_at?: string
          leverage?: number
          message_id?: number | null
          opened_at?: string
          pnl?: number | null
          potential_loss: number
          potential_profit: number
          result?: string | null
          risk_profile?: string
          settled_at?: string | null
          status?: string
          stop_loss: number
          symbol: string
          take_profit: number
          target_outcome?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          confidence?: number
          current_price?: number
          direction?: string
          duration_minutes?: number
          entry_price?: number
          expires_at?: string
          id?: string
          last_update_at?: string
          leverage?: number
          message_id?: number | null
          opened_at?: string
          pnl?: number | null
          potential_loss?: number
          potential_profit?: number
          result?: string | null
          risk_profile?: string
          settled_at?: string | null
          status?: string
          stop_loss?: number
          symbol?: string
          take_profit?: number
          target_outcome?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_pairs: {
        Row: {
          active: boolean
          base_price: number
          id: string
          symbol: string
          volatility: number
        }
        Insert: {
          active?: boolean
          base_price: number
          id?: string
          symbol: string
          volatility?: number
        }
        Update: {
          active?: boolean
          base_price?: number
          id?: string
          symbol?: string
          volatility?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: string
          note: string | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          id: string
          milestone_id: string
          reached_at: string
          user_id: string
        }
        Insert: {
          id?: string
          milestone_id: string
          reached_at?: string
          user_id: string
        }
        Update: {
          id?: string
          milestone_id?: string
          reached_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      users: {
        Row: {
          bonus_amount: number
          bonus_claimed: boolean
          bonus_claimed_at: string | null
          bonus_used: boolean
          bonus_used_at: string | null
          created_at: string
          first_name: string | null
          flagged_reason: string | null
          id: string
          last_seen_at: string
          referral_code: string
          referral_source: string | null
          referred_by: string | null
          screen_message_id: number | null
          share_platforms: Json
          status: string
          telegram_id: number
          trade_unlock_until: string | null
          ui_state: Json
          username: string | null
        }
        Insert: {
          bonus_amount?: number
          bonus_claimed?: boolean
          bonus_claimed_at?: string | null
          bonus_used?: boolean
          bonus_used_at?: string | null
          created_at?: string
          first_name?: string | null
          flagged_reason?: string | null
          id?: string
          last_seen_at?: string
          referral_code: string
          referral_source?: string | null
          referred_by?: string | null
          screen_message_id?: number | null
          share_platforms?: Json
          status?: string
          telegram_id: number
          trade_unlock_until?: string | null
          ui_state?: Json
          username?: string | null
        }
        Update: {
          bonus_amount?: number
          bonus_claimed?: boolean
          bonus_claimed_at?: string | null
          bonus_used?: boolean
          bonus_used_at?: string | null
          created_at?: string
          first_name?: string | null
          flagged_reason?: string | null
          id?: string
          last_seen_at?: string
          referral_code?: string
          referral_source?: string | null
          referred_by?: string | null
          screen_message_id?: number | null
          share_platforms?: Json
          status?: string
          telegram_id?: number
          trade_unlock_until?: string | null
          ui_state?: Json
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          fee_requested_at: string | null
          id: string
          message_id: number | null
          network: string
          service_fee_amount: number
          service_fee_status: string
          service_fee_tx: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          fee_requested_at?: string | null
          id?: string
          message_id?: number | null
          network?: string
          service_fee_amount?: number
          service_fee_status?: string
          service_fee_tx?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          fee_requested_at?: string | null
          id?: string
          message_id?: number | null
          network?: string
          service_fee_amount?: number
          service_fee_status?: string
          service_fee_tx?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
