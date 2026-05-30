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
  profile_image_url: string | null;
  status: string;
  is_admin: boolean;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  session: null, profile: null, loading: true,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,company_id,first_name,last_name,email,profile_image_url,status,is_admin")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
      qc.invalidateQueries();
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return (
    <Ctx.Provider value={{
      session, profile, loading,
      signOut: async () => { await supabase.auth.signOut(); },
      refreshProfile: async () => { if (session?.user) await loadProfile(session.user.id); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
