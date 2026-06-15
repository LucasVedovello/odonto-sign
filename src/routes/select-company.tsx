import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getServerSession } from "@/integrations/supabase/session-check.server";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, type AppRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Loader2, MapPin, Plus, LogOut, Hourglass, XCircle } from "lucide-react";

export const Route = createFileRoute("/select-company")({
  // Exige apenas autenticação (não exige clínica aprovada).
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      const { authenticated } = await getServerSession();
      if (!authenticated) throw redirect({ to: "/login" });
    } else {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw redirect({ to: "/login" });
    }
  },
  component: SelectCompanyPage,
  head: () => ({ meta: [{ title: "Selecionar clínica — OdontoSign" }] }),
});

type UserCompany = {
  company_id: string;
  company_name: string;
  nome_fantasia: string | null;
  cidade: string | null;
  uf: string | null;
  role: AppRole;
  approval_status: string;
};

function SelectCompanyPage() {
  const navigate = useNavigate();
  const { switchCompany, signOut } = useAuth();
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_user_companies");
    if (error) {
      toast.error("Erro ao carregar suas clínicas");
      setLoading(false);
      return;
    }
    setCompanies((data ?? []) as UserCompany[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnter = async (companyId: string) => {
    setEntering(companyId);
    try {
      await switchCompany(companyId);
      // Recarga completa garante o dashboard no escopo da clínica ativa.
      window.location.assign("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível entrar nesta clínica");
      setEntering(null);
    }
  };

  const approved = companies.filter((c) => c.approval_status === "approved");
  const others = companies.filter((c) => c.approval_status !== "approved");

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border shadow-[var(--shadow-card)]">
            <img
              src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/icone.jpg"
              alt="OdontoSign"
              className="h-full w-full translate-x-[2%] -translate-y-[4%] object-cover"
            />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Selecione a clínica</h1>
            <p className="text-sm text-muted-foreground">
              Você tem acesso a mais de uma clínica. Escolha qual deseja acessar.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : companies.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Nenhuma clínica vinculada ao seu usuário</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre uma nova clínica para começar a usar a plataforma.
            </p>
            <Button className="mt-6 gap-2" onClick={() => navigate({ to: "/adicionar-clinica" })}>
              <Plus className="h-4 w-4" /> Cadastrar nova clínica
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {approved.map((c) => (
              <Card key={c.company_id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate">
                      {c.nome_fantasia || c.company_name}
                    </p>
                    {(c.cidade || c.uf) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[c.cidade, c.uf].filter(Boolean).join(" — ")}
                      </p>
                    )}
                    <Badge
                      variant="outline"
                      className="mt-2 bg-primary/10 text-primary border-primary/30"
                    >
                      {ROLE_LABEL[c.role] ?? c.role}
                    </Badge>
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={() => handleEnter(c.company_id)}
                  disabled={!!entering}
                >
                  {entering === c.company_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </Card>
            ))}

            {/* Clínicas ainda não liberadas (pendentes/rejeitadas) */}
            {others.map((c) => (
              <Card key={c.company_id} className="flex flex-col p-5 opacity-80">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight truncate">
                      {c.nome_fantasia || c.company_name}
                    </p>
                    {(c.cidade || c.uf) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[c.cidade, c.uf].filter(Boolean).join(" — ")}
                      </p>
                    )}
                    {c.approval_status === "rejected" ? (
                      <Badge
                        variant="outline"
                        className="mt-2 bg-destructive/10 text-destructive border-destructive/30"
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Rejeitada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="mt-2 bg-warning/10 text-warning border-warning/30"
                      >
                        <Hourglass className="mr-1 h-3 w-3" /> Em análise
                      </Badge>
                    )}
                  </div>
                </div>
                <Button className="mt-4 w-full" variant="outline" disabled>
                  {c.approval_status === "rejected" ? "Indisponível" : "Aguardando aprovação"}
                </Button>
              </Card>
            ))}
          </div>
        )}

        {companies.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate({ to: "/adicionar-clinica" })}
            >
              <Plus className="h-4 w-4" /> Cadastrar nova clínica
            </Button>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
