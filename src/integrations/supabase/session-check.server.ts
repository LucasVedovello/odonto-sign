import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const idx = c.indexOf("=");
      return idx === -1
        ? { name: c, value: "" }
        : { name: c.slice(0, idx).trim(), value: c.slice(idx + 1) };
    });
}

const DEV = import.meta.env.DEV;

export const getServerSession = createServerFn().handler(async () => {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

  const request = getRequest();
  const cookies = parseCookieHeader(request?.headers?.get("cookie") ?? "");

  const serverSupabase = createServerClient<Database>(url, key, {
    cookies: { getAll: () => cookies, setAll: () => {} },
  });

  const { data: userData } = await serverSupabase.auth.getUser();
  if (!userData?.user) {
    return {
      authenticated: false,
      isAdmin: false,
      role: null as string | null,
      approvalStatus: "pending" as string,
      subscriptionExpired: false,
    };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("is_admin, company_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (DEV)
    console.log(
      "[getServerSession] has_profile:",
      !!profile,
      "| is_admin:",
      profile?.is_admin,
      "| role:",
      profile?.role,
    );

  const role: string | null = profile?.role ?? (profile?.is_admin ? "platform_admin" : null);

  // Admins always pass
  if (profile?.is_admin || role === "platform_admin") {
    return {
      authenticated: true,
      isAdmin: true,
      role,
      approvalStatus: "approved" as string,
      subscriptionExpired: false,
    };
  }

  // No profile or no company_id → send back to login
  if (!profile || !profile.company_id) {
    return {
      authenticated: false,
      isAdmin: false,
      role: null as string | null,
      approvalStatus: "pending" as string,
      subscriptionExpired: false,
    };
  }

  // Check company approval + subscription
  const { data: company } = await serverSupabase
    .from("companies")
    .select("approval_status, subscription_expires_at")
    .eq("id", profile.company_id)
    .maybeSingle();

  // Safe default: if company row can't be read, treat as pending
  const approvalStatus = company?.approval_status ?? "pending";

  // Só bloqueia quando há uma data de expiração e ela já passou. Clínica
  // aprovada sem data (trial ainda não definido) continua com acesso.
  const exp = company?.subscription_expires_at;
  const subscriptionExpired = !!exp && new Date(exp).getTime() < Date.now();

  if (DEV)
    console.log(
      "[getServerSession] approval_status:",
      approvalStatus,
      "| subscriptionExpired:",
      subscriptionExpired,
    );

  return { authenticated: true, isAdmin: false, role, approvalStatus, subscriptionExpired };
});
