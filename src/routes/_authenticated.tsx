import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { getServerSession } from "@/integrations/supabase/session-check.server";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      // Server-side (Cloudflare Workers): read session from cookies.
      // getServerSession runs directly on the server (no RPC roundtrip during SSR).
      const { authenticated } = await getServerSession();
      if (!authenticated) throw redirect({ to: "/login" });
    } else {
      // Client-side: browser client reads session from cookies (set by createBrowserClient).
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
