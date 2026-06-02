import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const triggerNewCompanyNotification = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { ownerEmail: string; companyName: string; ownerName: string } }) => {
    try {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("company_email", data.ownerEmail)
        .maybeSingle();

      if (!company) return { ok: false };

      await supabaseAdmin.functions.invoke("notify-new-company", {
        body: {
          companyId: company.id,
          companyName: data.companyName,
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail,
          createdAt: new Date().toISOString(),
        },
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
