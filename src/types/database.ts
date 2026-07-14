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

type Gender = "male" | "female" | "other" | "prefer_not_to_say";
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
          city: string | null;
          birth_date: string | null;
          gender: Gender;
          available_for_chat: boolean;
          last_seen: string;
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
          city?: string | null;
          birth_date?: string | null;
          gender?: Gender;
          available_for_chat?: boolean;
          last_seen?: string;
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
    };
    Views: Record<string, never>;
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
    };
    Enums: {
      gender: Gender;
      topic_status: TopicStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
