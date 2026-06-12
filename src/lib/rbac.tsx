import type { ReactNode } from "react";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getServerSession } from "@/integrations/supabase/session-check.server";
import { useAuth } from "@/lib/auth";

export type AppRole = "platform_admin" | "clinic_owner" | "dentist" | "staff";

export const ROLE_LABEL: Record<AppRole, string> = {
  platform_admin: "Admin da Plataforma",
  clinic_owner: "Proprietário",
  dentist: "Dentista",
  staff: "Recepção",
};

/** Role + clinic do usuário logado (a partir do AuthProvider). */
export function useUserRole() {
  const { profile, loading } = useAuth();
  const role = (profile?.role ?? null) as AppRole | null;
  return {
    role,
    companyId: profile?.company_id ?? null,
    loading,
    isPlatformAdmin: role === "platform_admin",
    isClinicOwner: role === "clinic_owner",
    isDentist: role === "dentist",
  };
}

/** Esconde/substitui children quando o usuário não tem um dos roles. */
export function RequireRole({
  roles,
  children,
  fallback = null,
}: {
  roles: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role, loading } = useUserRole();
  if (loading) return null;
  if (!role || !roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Guard de rota (beforeLoad) por role — funciona no server (Workers)
 * e no client. Redireciona para /login se deslogado e para a home
 * apropriada se o role não estiver na lista.
 */
export function roleGuard(roles: AppRole[]) {
  return async () => {
    let role: AppRole | null = null;

    if (typeof window === "undefined") {
      const session = await getServerSession();
      if (!session.authenticated) throw redirect({ to: "/login" });
      role = ((session as { role?: string }).role ??
        (session.isAdmin ? "platform_admin" : null)) as AppRole | null;
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw redirect({ to: "/login" });
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();
      role = (profile?.role ?? (profile?.is_admin ? "platform_admin" : null)) as AppRole | null;
    }

    if (!role || !roles.includes(role)) {
      throw redirect({ to: role === "platform_admin" ? "/admin" : "/" });
    }
  };
}
