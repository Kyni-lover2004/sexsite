import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && key);

/**
 * Server Supabase client. Returns a stub when env vars are missing
 * so the app never crashes — data functions return empty results.
 * Untyped by design (see client.ts); use Row<> helpers for safety.
 */
export function createClient() {
  if (!url || !key) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
            order: () => ({
              limit: () => Promise.resolve({ data: null, error: null }),
            }),
            then: (cb: (v: unknown) => unknown) =>
              cb({ data: null, error: null }),
          }),
          limit: () => Promise.resolve({ data: null, error: null }),
          order: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
              limit: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
        delete: () => ({
          match: () => Promise.resolve({ data: null, error: null }),
        }),
        neq: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        or: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => ({ error: null }),
        signUp: async () => ({ error: null }),
        signInWithOAuth: async () => ({}),
        exchangeCodeForSession: async () => ({ error: null }),
        signOut: async () => ({ error: null }),
      },
      rpc: () => ({ then: (cb: (v: unknown) => unknown) => cb(null) }),
      channel: () => ({
        on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      }),
      removeChannel: () => {},
    } as any;
  }

  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component where cookies are read-only.
        }
      },
    },
  });
}
