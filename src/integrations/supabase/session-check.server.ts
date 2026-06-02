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

export const getServerSession = createServerFn().handler(async () => {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

  const request = getRequest();
  const cookies = parseCookieHeader(request?.headers?.get('cookie') ?? '');

  const serverSupabase = createServerClient<Database>(url, key, {
    cookies: { getAll: () => cookies, setAll: () => {} },
  });

  const { data: userData } = await serverSupabase.auth.getUser();
  if (!userData?.user) {
    return { authenticated: false, isAdmin: false, approvalStatus: 'approved' as string };
  }

  // Fetch profile WITHOUT a join — a missing/blocked company row must never
  // make is_admin appear falsy, which would accidentally block the admin.
  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('is_admin, company_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  // Admins always pass: return early with isAdmin = true
  if (profile?.is_admin) {
    return { authenticated: true, isAdmin: true, approvalStatus: 'approved' as string };
  }

  // Non-admins: check company approval status separately
  let approvalStatus = 'approved';
  if (profile?.company_id) {
    const { data: company } = await serverSupabase
      .from('companies')
      .select('approval_status')
      .eq('id', profile.company_id)
      .maybeSingle();
    approvalStatus = company?.approval_status ?? 'approved';
  }

  return { authenticated: true, isAdmin: false, approvalStatus };
});
