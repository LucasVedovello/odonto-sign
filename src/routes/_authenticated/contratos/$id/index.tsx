import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, Loader2, Pencil } from "lucide-react";
import { ContractDocument } from "@/components/ContractDocument";
import {
  STATUS_META,
  TREATMENT_LABEL,
  type Contract,
  type ContractStatus,
  type TreatmentType,
} from "@/lib/contracts";

export const Route = createFileRoute("/_authenticated/contratos/$id/")({
  component: ContractView,
  head: () => ({ meta: [{ title: "Contrato — OdontoSign" }] }),
});

function ContractView() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!error && data) setContract(data as unknown as Contract);
      setLoading(false);
    })();
  }, [id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const downloadPdf = async () => {
    if (!contract) return;
    setDownloading(true);
    try {
      const { generateContractPdf } = await import("@/lib/contract-pdf");
      const doc = await generateContractPdf(contract);
      const nome = (contract.paciente_nome || contract.contratante_nome || "contrato").replace(
        /\s+/g,
        "_",
      );
      doc.save(`contrato-${String(contract.contract_number).padStart(4, "0")}-${nome}.pdf`);
    } catch {
      toast.error("Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (!contract)
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="text-lg font-semibold">Contrato não encontrado</h2>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/contratos">Voltar aos contratos</Link>
        </Button>
      </main>
    );

  const st = STATUS_META[contract.status as ContractStatus];
  const patientUrl = `${origin}/p/${contract.patient_token}`;
  const signingUrl = `${origin}/p/${contract.signing_token}/assinar`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-1.5">
        <Link to="/contratos">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">
              Contrato Nº {String(contract.contract_number).padStart(4, "0")}
            </h1>
            <Badge variant="outline" className={st?.cls}>
              {st?.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {TREATMENT_LABEL[contract.treatment_type as TreatmentType]} ·{" "}
            {new Date(contract.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {contract.status === "aguardando_recepcao" && (
            <Button asChild variant="outline" className="gap-2">
              <Link to="/contratos/$id/editar" params={{ id: contract.id }}>
                <Pencil className="h-4 w-4" /> Completar
              </Link>
            </Button>
          )}
          {contract.status === "concluido" && (
            <Button onClick={downloadPdf} disabled={downloading} className="gap-2">
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Baixar PDF
            </Button>
          )}
        </div>
      </div>

      {/* Links úteis conforme o estágio */}
      {contract.status === "aguardando_paciente" && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-medium">Link para o paciente preencher os dados</p>
          <p className="mt-2 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {patientUrl}
          </p>
          <Button size="sm" className="mt-3 gap-2" onClick={() => copy(patientUrl)}>
            <Copy className="h-3.5 w-3.5" /> Copiar link
          </Button>
        </Card>
      )}
      {contract.status === "aguardando_assinatura_paciente" && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-medium">Link de assinatura do paciente</p>
          <p className="mt-2 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            {signingUrl}
          </p>
          <Button size="sm" className="mt-3 gap-2" onClick={() => copy(signingUrl)}>
            <Copy className="h-3.5 w-3.5" /> Copiar link de assinatura
          </Button>
        </Card>
      )}

      <Card className="p-5 sm:p-8">
        <ContractDocument c={contract} />
      </Card>
    </main>
  );
}
