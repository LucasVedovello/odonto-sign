import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

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

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      // Server-side (Cloudflare Workers): localStorage is unavailable.
      // Read the session from cookies sent with the request instead.
      const { getRequest } = await import('@tanstack/react-start/server');
      const { createServerClient } = await import('@supabase/ssr');

      const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

      const request = getRequest();
      const cookies = parseCookieHeader(request?.headers?.get('cookie') ?? '');

      const serverSupabase = createServerClient(url, key, {
        cookies: {
          getAll: () => cookies,
          setAll: () => {},
        },
      });

      const { data } = await serverSupabase.auth.getUser();
      if (!data.user) throw redirect({ to: "/login" });
    } else {
      // Client-side: browser client reads session from cookies.
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw redirect({ to: "/login" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen">
      <AppHeader />
      <div key={loc.pathname} className="page-enter">
        <Outlet />
      </div>
    </div>
  );
}
