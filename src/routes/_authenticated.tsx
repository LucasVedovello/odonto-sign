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

      // Admins always pass — never blocked by company approval
      if (isAdmin) return;

      if (approvalStatus === 'pending') throw redirect({ to: "/aguardando-aprovacao" });
      if (approvalStatus === 'rejected' &&
          location.pathname !== '/acesso-negado' &&
          !location.pathname.startsWith('/suporte')) {
        throw redirect({ to: "/acesso-negado" });
      }
    } else {
      // Client-side: verify auth, then check company approval for non-admins only.
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw redirect({ to: "/login" });

      // Fetch profile WITHOUT a join so a missing/blocked company row
      // never accidentally makes is_admin appear falsy.
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, company_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      // Admins always pass — never blocked by company approval
      if (profile?.is_admin) return;

      // Non-admins: check the company's approval status separately
      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("approval_status")
          .eq("id", profile.company_id)
          .maybeSingle();

        const approvalStatus = company?.approval_status ?? 'approved';

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
