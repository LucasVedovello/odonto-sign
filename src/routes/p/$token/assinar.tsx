import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Eraser, Loader2, PenLine } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { ContractDocument } from "@/components/ContractDocument";
import { PdfImageViewer } from "@/components/PdfImageViewer";
import { PublicHeader } from "@/routes/p/$token/index";
import {
  documentsFor,
  termUrl,
  TREATMENT_LABEL,
  type Contract,
  type TreatmentType,
} from "@/lib/contracts";

export const Route = createFileRoute("/p/$token/assinar")({
  component: SignFlow,
  head: () => ({ meta: [{ title: "Assinatura do contrato — OdontoSign" }] }),
});

function SignFlow() {
  const { token } = Route.useParams();
  const sigRef = useRef<SignaturePadHandle>(null);
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("signing_token", token)
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      const c = data as unknown as Contract;
      setContract(c);
      if (c.status === "concluido") setDone(true);
      setLoading(false);
    })();
  }, [token]);

  const sign = async () => {
    if (!accepted) {
      toast.error("Confirme a leitura e o aceite do contrato");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Por favor, assine antes de concluir");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("contracts")
      .update({
        patient_signature: sigRef.current.toDataURL(),
        signed_at: new Date().toISOString(),
        status: "concluido" as const,
      })
      .eq("signing_token", token);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar assinatura");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (!contract)
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold">Link inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de assinatura não existe ou expirou.
          </p>
        </Card>
      </div>
    );

  const docs = documentsFor(contract);

  return (
    <div className="min-h-screen">
      <PublicHeader subtitle={TREATMENT_LABEL[contract.treatment_type as TreatmentType]} />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {done ? (
          <Card className="mt-2 p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Contrato assinado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Obrigado. Seu contrato foi assinado e enviado à clínica. Você já pode fechar esta
              página.
            </p>
          </Card>
        ) : (
          <>
            {/* Contrato com dados preenchidos (HTML) */}
            <Card className="p-5 sm:p-8">
              <ContractDocument c={contract} />
            </Card>

            {/* Termo específico + anexos (PDFs) */}
            <Card className="mt-4 p-5 sm:p-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
                Documentos do contrato
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Leia atentamente os documentos abaixo antes de assinar.
              </p>
              <PdfImageViewer docs={docs.map((d) => ({ title: d.title, url: termUrl(d.file) }))} />
            </Card>

            {/* Aceite + assinatura */}
            <Card className="mt-4 p-5 sm:p-6">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(!!v)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Li e concordo com o contrato e todos os documentos apresentados acima.
                </span>
              </label>

              <div className="mt-5">
                <div className="mb-1 flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Assinatura do paciente</p>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Assine abaixo com o dedo ou o mouse.
                </p>
                <div className="overflow-hidden rounded-xl border-2 border-dashed border-border bg-white dark:bg-background">
                  <SignaturePad ref={sigRef} className="block h-44 w-full" />
                </div>
                <div className="mt-1.5 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => sigRef.current?.clear()}
                    className="h-7 gap-1.5 text-xs text-muted-foreground"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Limpar
                  </Button>
                </div>
              </div>

              <Button
                onClick={sign}
                disabled={saving || !accepted}
                size="lg"
                className="mt-6 w-full"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar e Concluir"}
              </Button>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
