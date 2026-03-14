export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      [key: string]: GenericTable;
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          actor_id: string;
          action: string;
          resource_type: string;
          resource_id: string;
          metadata: Json;
          event_hash: string;
          previous_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          actor_id: string;
          action: string;
          resource_type: string;
          resource_id: string;
          metadata?: Json;
          event_hash: string;
          previous_hash?: string | null;
          created_at?: string;
        };
        Update: {
          metadata?: Json;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          email?: string;
        };
        Relationships: [];
      };
      tenant_memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          role?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      user_role_assignments: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          role?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      auth_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          session_token_hash: string;
          ip_address: string | null;
          user_agent: string | null;
          last_seen_at: string;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          session_token_hash: string;
          ip_address?: string | null;
          user_agent?: string | null;
          last_seen_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          revoked_at?: string | null;
          last_seen_at?: string;
          updated_at?: string;
          user_agent?: string | null;
          ip_address?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
