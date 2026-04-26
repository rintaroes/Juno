export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          city: string | null;
          created_at: string;
          first_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          first_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          first_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_uploads: {
        Row: {
          ai_summary: string | null;
          created_at: string;
          green_flags: string[];
          id: string;
          ocr_text: string | null;
          opening_line: string | null;
          owner_id: string;
          red_flags: string[];
          roster_person_id: string;
          screenshot_url: string;
        };
        Insert: {
          ai_summary?: string | null;
          created_at?: string;
          green_flags?: string[];
          id?: string;
          ocr_text?: string | null;
          opening_line?: string | null;
          owner_id: string;
          red_flags?: string[];
          roster_person_id: string;
          screenshot_url: string;
        };
        Update: {
          ai_summary?: string | null;
          created_at?: string;
          green_flags?: string[];
          id?: string;
          ocr_text?: string | null;
          opening_line?: string | null;
          owner_id?: string;
          red_flags?: string[];
          roster_person_id?: string;
          screenshot_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_uploads_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_uploads_roster_person_id_fkey';
            columns: ['roster_person_id'];
            isOneToOne: false;
            referencedRelation: 'roster_people';
            referencedColumns: ['id'];
          },
        ];
      };
      registry_checks: {
        Row: {
          created_at: string;
          id: string;
          matched_dob: string | null;
          matched_name: string | null;
          matched_state: string | null;
          matched_zip: string | null;
          mugshot_url: string | null;
          owner_id: string;
          query_age: number | null;
          query_name: string;
          query_state: string | null;
          query_zip: string | null;
          raw_result: Json | null;
          roster_person_id: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          matched_dob?: string | null;
          matched_name?: string | null;
          matched_state?: string | null;
          matched_zip?: string | null;
          mugshot_url?: string | null;
          owner_id: string;
          query_age?: number | null;
          query_name: string;
          query_state?: string | null;
          query_zip?: string | null;
          raw_result?: Json | null;
          roster_person_id?: string | null;
          status: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          matched_dob?: string | null;
          matched_name?: string | null;
          matched_state?: string | null;
          matched_zip?: string | null;
          mugshot_url?: string | null;
          owner_id?: string;
          query_age?: number | null;
          query_name?: string;
          query_state?: string | null;
          query_zip?: string | null;
          raw_result?: Json | null;
          roster_person_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'registry_checks_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'registry_checks_roster_person_id_fkey';
            columns: ['roster_person_id'];
            isOneToOne: false;
            referencedRelation: 'roster_people';
            referencedColumns: ['id'];
          },
        ];
      };
      roster_people: {
        Row: {
          ai_summary: string | null;
          archived_at: string | null;
          created_at: string;
          display_name: string;
          dob: string | null;
          estimated_age: number | null;
          id: string;
          notes: string | null;
          owner_id: string;
          source: string;
          state: string | null;
          updated_at: string;
          zip: string | null;
        };
        Insert: {
          ai_summary?: string | null;
          archived_at?: string | null;
          created_at?: string;
          display_name: string;
          dob?: string | null;
          estimated_age?: number | null;
          id?: string;
          notes?: string | null;
          owner_id: string;
          source?: string;
          state?: string | null;
          updated_at?: string;
          zip?: string | null;
        };
        Update: {
          ai_summary?: string | null;
          archived_at?: string | null;
          created_at?: string;
          display_name?: string;
          dob?: string | null;
          estimated_age?: number | null;
          id?: string;
          notes?: string | null;
          owner_id?: string;
          source?: string;
          state?: string | null;
          updated_at?: string;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_people_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
