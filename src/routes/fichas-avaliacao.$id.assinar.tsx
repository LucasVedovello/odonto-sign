import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, PenLine } from "lucide-react";
import { OdontoLogo } from "@/components/OdontoLogo";
import { SignDialog } from "@/components/SignDialog";
import { FichaForm } from "@/components/ficha-avaliacao/FichaForm";
import { EMPTY_FICHA, fichaFromRow, type FichaData, type FichaRow } from "@/lib/ficha-avaliacao";

export const Route = createFileRoute("/fichas-avaliacao/$id/assinar")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: AssinarFichaPage,
  head: () => ({ meta: [{ title: "Assinar Ficha de Avaliação — OdontoSign" }] }),
});

function PublicHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
          <OdontoLogo size={40} />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight">OdontoSign</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

function AssinarFichaPage() {
  const { token } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<FichaRow | null>(null);
  const [form, setForm] = useState<FichaData>(EMPTY_FICHA());
  const [accepted, setAccepted] = useState(false);
  const [patientSig, setPatientSig] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      // Acesso público restrito ao token via RPC SECURITY DEFINER.
      // RPCs novas não estão nos tipos gerados — cast como nos demais módulos.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("public_get_avaliacao", {
        p_token: token,
      });
      if (error || !data) {
        setLoading(false);
        return;
      }
      const d = data as unknown as FichaRow;
      setRow(d);
      setForm(fichaFromRow(d as unknown as Record<string, unknown>));
      if (d.status === "assinado") setDone(true);
      setLoading(false);
    })();
  }, [token]);

  const finalize = async () => {
    if (!token) return;
    if (!accepted) {
      toast.error("Confirme a leitura e o aceite da ficha");
      return;
    }
    if (!patientSig) {
      toast.error("Assine no campo indicado antes de finalizar");
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("public_sign_avaliacao", {
        p_token: token,
        p_signature: patientSig,
      });
      if (error) throw error;
      if (!data) {
        toast.error("Esta ficha não está mais disponível para assinatura.");
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao finalizar a assinatura. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h2 className="text-xl font-semibold">Link inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link não existe, expirou ou a ficha ainda não está disponível para assinatura.
            Solicite um novo à clínica.
          </p>
        </main>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen">
        <PublicHeader subtitle="Ficha de Avaliação" />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" />
          <h2 className="text-xl font-semibold">Assinatura concluída!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Obrigado, {row.paciente_nome}. Sua ficha de avaliação foi assinada com sucesso. A
            clínica já tem acesso ao documento final.
          </p>
        </main>
      </div>
    );
  }

  if (row.status !== "aguardando_paciente") {
    return (
      <div className="min-h-screen">
        <PublicHeader subtitle="Ficha de Avaliação" />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Ficha em preparação</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A clínica ainda está finalizando a ficha. Tente novamente em instantes.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <PublicHeader subtitle={`Ficha de Avaliação — ${row.paciente_nome}`} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Leia e assine sua ficha de avaliação</h2>
          <p className="text-sm text-muted-foreground">
            Confira as informações abaixo. Depois, marque o aceite e assine.
          </p>
        </div>

        {row.assinatura_clinica && (
          <Card className="mb-4 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Representante da Contratada
            </p>
            <img
              src={row.assinatura_clinica}
              alt="Assinatura da clínica"
              className="h-16 rounded-lg border border-border bg-white object-contain p-1"
            />
          </Card>
        )}

        {/* Ficha em modo leitura */}
        <FichaForm value={form} onChange={() => {}} readOnly />

        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-start gap-2">
            <Checkbox
              id="accept"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="accept" className="text-sm leading-snug">
              Aceito e concordo com os itens acima descritos e estou ciente de que esta ficha se
              trata de um planejamento. Se for necessária alguma alteração, só será realizada com
              minha aprovação.
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-1.5" onClick={() => setSignOpen(true)}>
              <PenLine className="h-4 w-4" />
              {patientSig ? "Refazer assinatura" : "Assinar"}
            </Button>
            <Button className="flex-1 gap-1.5" onClick={finalize} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar e finalizar
            </Button>
          </div>
          {patientSig && (
            <p className="mt-2 text-xs text-success">Assinatura registrada. Confira e finalize.</p>
          )}
        </Card>
      </main>

      <SignDialog
        open={signOpen}
        title="Sua assinatura"
        description="Desenhe sua assinatura. Ela será registrada como Cliente responsável."
        onOpenChange={setSignOpen}
        onConfirm={(dataUrl) => {
          setPatientSig(dataUrl);
          setSignOpen(false);
        }}
      />
    </div>
  );
}
