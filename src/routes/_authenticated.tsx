import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { getServerSession } from "@/integrations/supabase/session-check.server";

const DEV = import.meta.env.DEV;

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") {
      // Server-side (Cloudflare Workers): read session + approval from cookies.
      const { authenticated, isAdmin, approvalStatus, subscriptionExpired } =
        await getServerSession();

      if (DEV)
        console.log(
          "[auth-guard:server] authenticated:",
          authenticated,
          "| isAdmin:",
          isAdmin,
          "| approval_status:",
          approvalStatus,
          "| subscriptionExpired:",
          subscriptionExpired,
        );

      if (!authenticated) throw redirect({ to: "/login" });
      if (isAdmin) return; // admins always pass

      if (approvalStatus === "pending") throw redirect({ to: "/aguardando-aprovacao" });
      if (
        approvalStatus === "rejected" &&
        location.pathname !== "/acesso-negado" &&
        !location.pathname.startsWith("/suporte")
      ) {
        throw redirect({ to: "/acesso-negado" });
      }
      // Assinatura vencida → bloqueia (exceto a própria página de aviso e suporte).
      if (
        subscriptionExpired &&
        location.pathname !== "/assinatura-expirada" &&
        !location.pathname.startsWith("/suporte")
      ) {
        throw redirect({ to: "/assinatura-expirada" });
      }
    } else {
      // Client-side: verify auth, then check company approval for non-admins only.
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw redirect({ to: "/login" });

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, company_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (DEV)
        console.log(
          "[auth-guard:client] is_admin:",
          profile?.is_admin,
          "| has_company:",
          !!profile?.company_id,
          "| profileError:",
          !!profileError,
        );

      // Admins always pass
      if (profile?.is_admin) return;

      // No profile or no company_id → something is wrong, re-send to login
      if (!profile || !profile.company_id) {
        if (DEV) console.log("[auth-guard:client] no profile or company_id — redirecting to login");
        throw redirect({ to: "/login" });
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("approval_status, subscription_expires_at")
        .eq("id", profile.company_id)
        .maybeSingle();

      // Safe default: if company can't be read, treat as pending
      const approvalStatus = company?.approval_status ?? "pending";

      if (DEV)
        console.log(
          "[auth-guard:client] approval_status:",
          approvalStatus,
          "| companyError:",
          !!companyError,
        );

      if (approvalStatus === "pending") throw redirect({ to: "/aguardando-aprovacao" });
      if (
        approvalStatus === "rejected" &&
        location.pathname !== "/acesso-negado" &&
        !location.pathname.startsWith("/suporte")
      ) {
        throw redirect({ to: "/acesso-negado" });
      }

      // Assinatura vencida (ou nula) → bloqueia o acesso operacional.
      const exp = company?.subscription_expires_at;
      const subscriptionExpired = !exp || new Date(exp).getTime() < Date.now();
      if (
        subscriptionExpired &&
        location.pathname !== "/assinatura-expirada" &&
        !location.pathname.startsWith("/suporte")
      ) {
        throw redirect({ to: "/assinatura-expirada" });
      }
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="page-enter pb-20 sm:pb-0">
        <Outlet />
      </div>
    </div>
  );
}
