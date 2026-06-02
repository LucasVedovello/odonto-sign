import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { getServerSession } from "@/integrations/supabase/session-check.server";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === 'undefined') {
      // Server-side (Cloudflare Workers): read session + approval from cookies.
      const { authenticated, isAdmin, approvalStatus } = await getServerSession();
      if (!authenticated) throw redirect({ to: "/login" });
      if (!isAdmin) {
        if (approvalStatus === 'pending') throw redirect({ to: "/aguardando-aprovacao" });
        if (approvalStatus === 'rejected' &&
            location.pathname !== '/acesso-negado' &&
            !location.pathname.startsWith('/suporte')) {
          throw redirect({ to: "/acesso-negado" });
        }
      }
    } else {
      // Client-side: verify auth and company approval status.
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw redirect({ to: "/login" });

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, companies!inner(approval_status)")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        const approvalStatus =
          (profile?.companies as { approval_status: string } | null)?.approval_status ?? 'approved';
        if (approvalStatus === 'pending') throw redirect({ to: "/aguardando-aprovacao" });
        if (approvalStatus === 'rejected' &&
            location.pathname !== '/acesso-negado' &&
            !location.pathname.startsWith('/suporte')) {
          throw redirect({ to: "/acesso-negado" });
        }
      }
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="page-enter">
        <Outlet />
      </div>
    </div>
  );
}
