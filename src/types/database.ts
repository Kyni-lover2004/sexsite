// =============================================================
//  Supabase `Database` type — mirrors supabase/schema.sql
//  Normally produced by:
//    supabase gen types typescript --local > src/types/database.ts
//  Hand-written here so the typed client works out of the box.
// =============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Gender = "male" | "female" | "couple_mf" | "other" | "prefer_not_to_say";
type TopicStatus = "active" | "archived";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          status: string | null;
          bio: string | null;
          interests: string[];
          dating_goal: string | null;
          dating_goals: string[];
          country: string | null;
          region: string | null;
          city: string | null;
          birth_date: string | null;
          gender: Gender;
          available_for_chat: boolean;
          role: "user" | "admin";
          is_banned: boolean;
          banned_until: string | null;
          ban_reason: string | null;
          banned_by: string | null;
          banned_at: string | null;
          premium_until: string | null;
          is_invisible: boolean;
          last_seen: string;
          looking_for: string[];
          age_preference: string | null;
          meeting_place: string[];
          mobility: string | null;
          height: number | null;
          weight: number | null;
          breast_size: string | null;
          penis_size: string | null;
          smoking_attitude: string | null;
          drinking_attitude: string | null;
          orientation_roles: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          status?: string | null;
          bio?: string | null;
          interests?: string[];
          dating_goal?: string | null;
          dating_goals?: string[];
          country?: string | null;
          region?: string | null;
          city?: string | null;
          birth_date?: string | null;
          gender?: Gender;
          available_for_chat?: boolean;
          role?: "user" | "admin";
          is_banned?: boolean;
          banned_until?: string | null;
          ban_reason?: string | null;
          banned_by?: string | null;
          banned_at?: string | null;
          premium_until?: string | null;
          is_invisible?: boolean;
          last_seen?: string;
          looking_for?: string[];
          age_preference?: string | null;
          meeting_place?: string[];
          mobility?: string | null;
          height?: number | null;
          weight?: number | null;
          breast_size?: string | null;
          penis_size?: string | null;
          smoking_attitude?: string | null;
          drinking_attitude?: string | null;
          orientation_roles?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      profile_photos: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          storage_path: string;
          caption: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          storage_path: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["profile_photos"]["Insert"]
        >;
        Relationships: [];
      };
      encryption_keys: {
        Row: {
          user_id: string;
          public_key: Json;
          algorithm: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          public_key: Json;
          algorithm?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["encryption_keys"]["Insert"]
        >;
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          body: string;
          tags: string[];
          media: Json;
          status: TopicStatus;
          view_count: number;
          like_count: number;
          comment_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          body?: string;
          tags?: string[];
          media?: Json;
          status?: TopicStatus;
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["topics"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          topic_id: string;
          author_id: string;
          parent_id: string | null;
          body: string;
          like_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          author_id: string;
          parent_id?: string | null;
          body: string;
          like_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string | null;
          comment_id: string | null;
          emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id?: string | null;
          comment_id?: string | null;
          emoji?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["conversations"]["Insert"]
        >;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          ciphertext: string;
          iv: string;
          ephemeral_key: Json | null;
          metadata: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          ciphertext: string;
          iv: string;
          ephemeral_key?: Json | null;
          metadata?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          status: "open" | "answered" | "closed";
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          status?: "open" | "answered" | "closed";
          created_at?: string;
          updated_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["support_tickets"]["Insert"]
        >;
        Relationships: [];
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string;
          is_admin: boolean;
          body: string;
          attachments: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_id: string;
          is_admin?: boolean;
          body: string;
          attachments?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["support_messages"]["Insert"]
        >;
        Relationships: [];
      };
      gallery_photo_views: {
        Row: {
          viewer_id: string;
          photo_id: string;
          profile_id: string;
          viewed_at: string;
        };
        Insert: {
          viewer_id: string;
          photo_id: string;
          profile_id: string;
          viewed_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["gallery_photo_views"]["Insert"]
        >;
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          window_start: string;
          hit_count: number;
        };
        Insert: {
          key: string;
          window_start?: string;
          hit_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event: string;
          props: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event: string;
          props?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["analytics_events"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_view_count: {
        Args: { topic_id: string };
        Returns: undefined;
      };
      profile_age: {
        Args: { bd: string };
        Returns: number;
      };
      topic_popularity: {
        Args: {
          likes: number;
          comments: number;
          views: number;
          created: string;
        };
        Returns: number;
      };
      record_gallery_photo_view: {
        Args: { p_photo_id: string; p_profile_id: string };
        Returns: Json;
      };
      count_gallery_photo_views: {
        Args: { p_profile_id: string };
        Returns: Json;
      };
      check_rate_limit: {
        Args: {
          p_bucket: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      heartbeat: {
        Args: Record<string, never>;
        Returns: string;
      };
      track_event: {
        Args: { p_event: string; p_props?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      gender: Gender;
      topic_status: TopicStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
