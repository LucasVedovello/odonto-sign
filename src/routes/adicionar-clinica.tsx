import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldAlert, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getServerSession } from "@/integrations/supabase/session-check.server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const navigate = useNavigate();
  // Cadastrar nova clínica é exclusivo de clinic_owner (defesa contra URL direta).
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_user_companies");
      if (!active) return;
      // Em erro (ex.: banco legado), não bloqueia — a visibilidade dos botões
      // já é a barreira principal. Caso contrário, exige role clinic_owner.
      setAllowed(error ? true : (data ?? []).some((c) => c.role === "clinic_owner"));
    })();
    return () => {
      active = false;
    };
  }, []);

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
            <ShieldAlert className="h-7 w-7 text-warning" />
          </div>
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas proprietários de clínica podem cadastrar uma nova clínica.
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => navigate({ to: "/select-company" })}
          >
            Voltar para minhas clínicas
          </Button>
        </Card>
      </div>
    );
  }

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
