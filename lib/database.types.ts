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
          allow_friend_requests: boolean;
          city: string | null;
          created_at: string;
          discoverable_by_email: boolean;
          discoverable_by_phone: boolean;
          discoverable_by_username: boolean;
          first_name: string | null;
          id: string;
          phone_e164: string | null;
          search_email: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          allow_friend_requests?: boolean;
          city?: string | null;
          created_at?: string;
          discoverable_by_email?: boolean;
          discoverable_by_phone?: boolean;
          discoverable_by_username?: boolean;
          first_name?: string | null;
          id: string;
          phone_e164?: string | null;
          search_email?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          allow_friend_requests?: boolean;
          city?: string | null;
          created_at?: string;
          discoverable_by_email?: boolean;
          discoverable_by_phone?: boolean;
          discoverable_by_username?: boolean;
          first_name?: string | null;
          id?: string;
          phone_e164?: string | null;
          search_email?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          declined_by: string | null;
          id: string;
          requester_id: string;
          responded_at: string | null;
          status: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          declined_by?: string | null;
          id?: string;
          requester_id: string;
          responded_at?: string | null;
          status: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          declined_by?: string | null;
          id?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_declined_by_fkey';
            columns: ['declined_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
      date_sessions: {
        Row: {
          companion_ai_summary: string | null;
          companion_display_name: string;
          ended_at: string | null;
          id: string;
          last_known_lat: number | null;
          last_known_lng: number | null;
          notes: string | null;
          roster_person_id: string;
          started_at: string;
          status: string;
          timer_minutes: number | null;
          user_id: string;
        };
        Insert: {
          companion_ai_summary?: string | null;
          companion_display_name: string;
          ended_at?: string | null;
          id?: string;
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          notes?: string | null;
          roster_person_id: string;
          started_at?: string;
          status: string;
          timer_minutes?: number | null;
          user_id: string;
        };
        Update: {
          companion_ai_summary?: string | null;
          companion_display_name?: string;
          ended_at?: string | null;
          id?: string;
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          notes?: string | null;
          roster_person_id?: string;
          started_at?: string;
          status?: string;
          timer_minutes?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'date_sessions_roster_person_id_fkey';
            columns: ['roster_person_id'];
            isOneToOne: false;
            referencedRelation: 'roster_people';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'date_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      live_locations: {
        Row: {
          accuracy: number | null;
          active_date_session_id: string | null;
          lat: number;
          lng: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accuracy?: number | null;
          active_date_session_id?: string | null;
          lat: number;
          lng: number;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accuracy?: number | null;
          active_date_session_id?: string | null;
          lat?: number;
          lng?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_locations_active_date_session_id_fkey';
            columns: ['active_date_session_id'];
            isOneToOne: false;
            referencedRelation: 'date_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_locations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
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
      end_date_session: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      list_circle_relationships: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city: string;
          direction: string;
          first_name: string;
          friendship_id: string;
          profile_id: string;
          search_email: string;
          status: string;
          username: string;
        }[];
      };
      list_friends_map_snapshots: {
        Args: Record<PropertyKey, never>;
        Returns: {
          accuracy: number | null;
          active_date_session_id: string | null;
          companion_ai_summary: string | null;
          companion_display_name: string | null;
          first_name: string | null;
          lat: number | null;
          lng: number | null;
          profile_id: string;
          session_started_at: string | null;
          status: string;
          timer_minutes: number | null;
          updated_at: string | null;
          username: string | null;
        }[];
      };
      request_friendship: {
        Args: { target_profile_id: string };
        Returns: string;
      };
      remove_friendship: {
        Args: { p_friendship_id: string };
        Returns: undefined;
      };
      respond_to_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string };
        Returns: undefined;
      };
      search_friend_profiles: {
        Args: { p_query: string };
        Returns: {
          city: string;
          first_name: string;
          matched_on: string;
          profile_id: string;
          relationship_direction: string;
          relationship_status: string;
          search_email: string;
          username: string;
        }[];
      };
      start_date_session: {
        Args: {
          p_accuracy?: number | null;
          p_lat: number;
          p_lng: number;
          p_roster_person_id: string;
          p_timer_minutes?: number | null;
        };
        Returns: string;
      };
      update_my_live_location: {
        Args: {
          p_accuracy?: number | null;
          p_lat: number;
          p_lng: number;
        };
        Returns: undefined;
      };
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
