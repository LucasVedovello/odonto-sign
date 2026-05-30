import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function createSupabaseClient() {
  const SUPABASE_URL = isBrowser
    ? import.meta.env.VITE_SUPABASE_URL
    : (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);

  const SUPABASE_PUBLISHABLE_KEY = isBrowser
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    : (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY);

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: isBrowser ? window.localStorage : undefined,
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
      flowType: 'pkce',
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
