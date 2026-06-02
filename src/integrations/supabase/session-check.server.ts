import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types';

function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(';')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => {
      const idx = c.indexOf('=');
      return idx === -1
        ? { name: c, value: '' }
        : { name: c.slice(0, idx).trim(), value: c.slice(idx + 1) };
    });
}

// Reads the Supabase session from cookies during SSR (Cloudflare Workers) and
// also returns the user's admin flag and company approval status so the
// authenticated route guard can redirect pending/rejected companies server-side.
export const getServerSession = createServerFn().handler(async () => {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

  const request = getRequest();
  const cookies = parseCookieHeader(request?.headers?.get('cookie') ?? '');

  const serverSupabase = createServerClient<Database>(url, key, {
    cookies: { getAll: () => cookies, setAll: () => {} },
  });

  const { data: userData } = await serverSupabase.auth.getUser();
  if (!userData?.user) return { authenticated: false, isAdmin: false, approvalStatus: 'approved' as string };

  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('is_admin, companies!inner(approval_status)')
    .eq('id', userData.user.id)
    .maybeSingle();

  const approvalStatus = (profile?.companies as { approval_status: string } | null)?.approval_status ?? 'approved';

  return {
    authenticated: true,
    isAdmin: profile?.is_admin ?? false,
    approvalStatus,
  };
});
