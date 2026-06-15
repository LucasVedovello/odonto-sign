import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getServerSession } from "@/integrations/supabase/session-check.server";
import { CompanyWizard } from "@/components/company-wizard";

export const Route = createFileRoute("/adicionar-clinica")({
  // Exige apenas autenticação — funciona mesmo para usuários sem
  // nenhuma clínica aprovada ainda (ex.: primeira clínica rejeitada).
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      const { authenticated } = await getServerSession();
      if (!authenticated) throw redirect({ to: "/login" });
    } else {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw redirect({ to: "/login" });
    }
  },
  component: AddClinicPage,
  head: () => ({ meta: [{ title: "Adicionar clínica — OdontoSign" }] }),
});

function AddClinicPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
            style={{ background: "var(--gradient-clinical)" }}
          >
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Adicionar nova clínica</h1>
          <p className="text-sm text-muted-foreground -mt-2 text-center">
            Cadastre outra clínica vinculada à sua conta. Ela passará por aprovação do
            administrador.
          </p>
        </div>

        <CompanyWizard mode="add" />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            to="/select-company"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para minhas clínicas
          </Link>
        </p>
      </div>
    </div>
  );
}
