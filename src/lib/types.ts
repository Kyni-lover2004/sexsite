// =============================================================
//  Database types — mirrors supabase/schema.sql
//  In a real project generate this with:
//    supabase gen types typescript --local > src/lib/database.types.ts
//  Kept hand-written here so the app is typed out of the box.
// =============================================================

export type Gender = "male" | "female" | "couple_mf" | "other" | "prefer_not_to_say";
export type TopicStatus = "active" | "archived";
export type UserRole = "user" | "admin";

export interface Profile {
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
  role: UserRole;
  is_banned: boolean;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface EncryptionKeyRow {
  user_id: string;
  public_key: JsonWebKey;
  algorithm: string;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  author_id: string;
  title: string;
  body: string;
  tags: string[];
  media: TopicMedia[];
  status: TopicStatus;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface TopicMedia {
  type: "image" | "video";
  url: string;
}

export interface ProfilePhoto {
  id: string;
  user_id: string;
  url: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

// Topic joined with its author profile (used in the feed)
export interface TopicWithAuthor extends Topic {
  author: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "last_seen"
  > | null;
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  topic_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
}

export interface Reaction {
  id: string;
  user_id: string;
  topic_id: string | null;
  comment_id: string | null;
  emoji: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  iv: string;
  ephemeral_key: JsonWebKey | null;
  metadata: MessageMetadata | null;
  read_at: string | null;
  created_at: string;
}

export interface ImageMessageMetadata {
  type: "image";
  storage_path: string;
  file_iv: string;
  mime_type?: string;
}

export type MessageMetadata = ImageMessageMetadata;

// A message after it has been decrypted on the client.
export interface DecryptedMessage extends Message {
  plaintext: string;
  decryptError?: boolean;
}

export type FeedTab = "new" | "popular";
