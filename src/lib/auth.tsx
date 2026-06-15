import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export type Profile = {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  username: string;
  profile_image_url: string | null;
  status: string;
  is_admin: boolean;
  role: "platform_admin" | "clinic_owner" | "dentist" | "staff";
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Define a clínica ativa (valida vínculo via RPC) e recarrega o perfil. */
  switchCompany: (companyId: string) => Promise<void>;
};

const Ctx = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  switchCompany: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id,company_id,first_name,last_name,email,username,profile_image_url,status,is_admin,role",
      )
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
      qc.invalidateQueries();

      // On explicit sign-out or token expiry, wipe cache and redirect.
      // window.location.replace prevents going back to protected pages via browser history.
      if (event === "SIGNED_OUT") {
        qc.clear();
        window.location.replace("/login");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return (
    <Ctx.Provider
      value={{
        session,
        profile,
        loading,
        signOut: async () => {
          qc.clear(); // Clear all cached queries before signing out
          // Auditoria: registra o logout antes de derrubar a sessão
          await supabase
            .rpc("log_audit_event", { p_action: "logout", p_description: "Logout realizado" })
            .then(
              () => {},
              () => {},
            );
          await supabase.auth.signOut();
          // onAuthStateChange SIGNED_OUT will handle the redirect
        },
        refreshProfile: async () => {
          if (session?.user) await loadProfile(session.user.id);
        },
        switchCompany: async (companyId: string) => {
          const { error } = await supabase.rpc("set_active_company", {
            p_company_id: companyId,
          });
          if (error) throw error;
          // Recarrega o perfil (company_id/role da clínica ativa) e
          // invalida o cache para refazer as queries no novo escopo.
          if (session?.user) await loadProfile(session.user.id);
          qc.invalidateQueries();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
