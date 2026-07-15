/**
 * Typed Supabase helpers.
 * Database schema lives in @/types/database — expand it as tables grow.
 * Use createClient() return type loosely: full generic wiring differs by @supabase/ssr version.
 */
import type { Database } from "@/types/database";

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

/** Escape hatch when a call site still needs a loosely typed client. */
export type LooseSupabase = ReturnType<
  typeof import("@supabase/ssr").createBrowserClient
>;
