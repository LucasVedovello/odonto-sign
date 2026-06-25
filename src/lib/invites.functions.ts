import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().email().max(255),
  redirectTo: z.string().url(),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get inviter's company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id,first_name,last_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.company_id) throw new Error("Empresa não encontrada");

    // Enforce 20-user limit
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id);

    if ((count ?? 0) >= 20) {
      throw new Error("Limite de 20 contas atingido para esta empresa");
    }

    // Check duplicates
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing) throw new Error("Este email já possui uma conta");

    // NB: a expiração do link NÃO é configurável por chamada — `inviteUserByEmail`
    // só aceita `data` e `redirectTo`. O tempo de vida do link é controlado pela
    // config de Auth do projeto (Authentication → Settings → "Email OTP Expiration"
    // / `mailer_otp_exp`). Ajuste lá para aumentar a validade do convite.
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invite_company_id: profile.company_id, first_name: "", last_name: "" },
      redirectTo: data.redirectTo,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Você não pode excluir a si mesmo");

    // Verify target is same company
    const [{ data: me }, { data: target }] = await Promise.all([
      supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("company_id").eq("id", data.userId).maybeSingle(),
    ]);
    if (!me || !target || me.company_id !== target.company_id) {
      throw new Error("Usuário não encontrado");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email(), redirectTo: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!me?.company_id) throw new Error("Empresa não encontrada");

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invite_company_id: me.company_id },
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
