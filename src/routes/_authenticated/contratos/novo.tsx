import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PAYMENT_ANNEX_OPTIONS,
  TREATMENT_OPTIONS,
  type PaymentAnnex,
  type TreatmentType,
} from "@/lib/contracts";

export const Route = createFileRoute("/_authenticated/contratos/novo")({
  component: NewContract,
  head: () => ({ meta: [{ title: "Novo contrato — OdontoSign" }] }),
});

function NewContract() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [treatment, setTreatment] = useState<TreatmentType | null>(null);
  const [annexes, setAnnexes] = useState<Record<PaymentAnnex, boolean>>({
    parcela_facil: false,
    compra_programada: false,
    pagamento_recorrente: false,
  });
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const toggleAnnex = (v: PaymentAnnex) => setAnnexes((prev) => ({ ...prev, [v]: !prev[v] }));

  const handleCreate = async () => {
    if (!profile?.company_id) {
      toast.error("Empresa não identificada");
      return;
    }
    if (!treatment) {
      toast.error("Selecione o tipo de tratamento");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("contracts")
      .insert({
        company_id: profile.company_id,
        treatment_type: treatment,
        has_parcela_facil: annexes.parcela_facil,
        has_compra_programada: annexes.compra_programada,
        has_pagamento_recorrente: annexes.pagamento_recorrente,
        status: "aguardando_paciente",
      })
      .select("patient_token")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Erro ao criar contrato");
      return;
    }
    const url = `${window.location.origin}/p/${data.patient_token}`;
    setLink(url);
    toast.success("Contrato criado");
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
        <Link to="/contratos">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">Novo contrato</h1>
      <p className="text-sm text-muted-foreground">
        Selecione o tratamento e os anexos. Um link será gerado para o paciente preencher os dados.
      </p>

      {link ? (
        <Card className="mt-6 border-primary/30 p-6">
          <div className="mb-3 flex items-center gap-2 text-success">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15">
              <Check className="h-4 w-4" />
            </div>
            <p className="font-semibold">Contrato criado!</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Envie o link abaixo ao paciente para que ele preencha os dados cadastrais.
          </p>
          <p className="mt-3 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {link}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={copyLink} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar link
            </Button>
            <Button variant="outline" onClick={() => window.open(link, "_blank")} className="gap-2">
              <ExternalLink className="h-4 w-4" /> Abrir
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/contratos" })}>
              Ir para a lista
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Seção 1 — Tipo de tratamento */}
          <Card className="mt-6 p-5 sm:p-6">
            <h2 className="text-base font-semibold">1. Tipo de tratamento</h2>
            <p className="mt-1 text-sm text-muted-foreground">Selecione uma opção (obrigatório).</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {TREATMENT_OPTIONS.map((t) => {
                const active = treatment === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTreatment(t.value)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition",
                      active
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    {t.label}
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Seção 2 — Anexos de pagamento */}
          <Card className="mt-4 p-5 sm:p-6">
            <h2 className="text-base font-semibold">2. Anexos de pagamento</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opcional — marque os que se aplicam.
            </p>
            <div className="mt-4 grid gap-3">
              {PAYMENT_ANNEX_OPTIONS.map((a) => (
                <label
                  key={a.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={annexes[a.value]}
                    onCheckedChange={() => toggleAnnex(a.value)}
                  />
                  <span className="text-sm font-medium">{a.label}</span>
                </label>
              ))}
            </div>
          </Card>

          <Button
            onClick={handleCreate}
            disabled={creating || !treatment}
            size="lg"
            className="mt-6 w-full gap-2"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Criar contrato e gerar link"
            )}
          </Button>
        </>
      )}
    </main>
  );
}
