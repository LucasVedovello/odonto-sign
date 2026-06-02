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
    return { authenticated: false, isAdmin: false, approvalStatus: 'pending' as string };
  }

  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('is_admin, company_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  console.log('[getServerSession] userId:', userData.user.id, '| profile:', JSON.stringify(profile));

  // Admins always pass
  if (profile?.is_admin) {
    return { authenticated: true, isAdmin: true, approvalStatus: 'approved' as string };
  }

  // No profile or no company_id → send back to login
  if (!profile || !profile.company_id) {
    console.log('[getServerSession] no profile or company_id — treating as unauthenticated');
    return { authenticated: false, isAdmin: false, approvalStatus: 'pending' as string };
  }

  // Check company approval
  const { data: company } = await serverSupabase
    .from('companies')
    .select('approval_status')
    .eq('id', profile.company_id)
    .maybeSingle();

  // Safe default: if company row can't be read, treat as pending
  const approvalStatus = company?.approval_status ?? 'pending';

  console.log('[getServerSession] company_id:', profile.company_id, '| approval_status:', approvalStatus);

  return { authenticated: true, isAdmin: false, approvalStatus };
});
