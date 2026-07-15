"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && key);

/**
 * Typed helpers live in @/types/database + @/lib/supabase/typed.
 * Client itself stays untyped: full Database generics with hand-written
 * schema often collapse to `never` across @supabase/ssr versions.
 * Prefer explicit casts / Row<> at call sites over a broken generic client.
 */
function stub() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          order: () => ({
            limit: () => Promise.resolve({ data: null, error: null }),
          }),
          then: (cb: (v: unknown) => unknown) => cb({ data: null, error: null }),
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
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
  } as any;
}

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!url || !key) return stub();
  if (client) return client;
  client = createBrowserClient(url, key);
  return client;
}
