import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuditFooter } from "@/components/AuditFooter";
import { fetchProfileNames } from "@/lib/audit";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  Download,
  Link2,
  Loader2,
  PenLine,
  Save,
  Send,
} from "lucide-react";
import { FichaForm } from "@/components/ficha-avaliacao/FichaForm";
import { EnviarDentistaDialog } from "@/components/ficha-avaliacao/EnviarDentistaDialog";
import { SignDialog } from "@/components/SignDialog";
import {
  EMPTY_FICHA,
  STATUS_META,
  fichaFromRow,
  publicSignUrl,
  type FichaData,
  type FichaRow,
} from "@/lib/ficha-avaliacao";

export const Route = createFileRoute("/_authenticated/fichas-avaliacao/$id")({
  component: FichaDetailPage,
  head: () => ({ meta: [{ title: "Ficha de Avaliação — OdontoSign" }] }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Validade do link de assinatura do paciente: 72 horas.
const LINK_HORAS = 72;

function FichaDetailPage() {
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const { isDentist } = useUserRole();
  const navigate = useNavigate();

  const [row, setRow] = useState<FichaRow | null>(null);
  const [form, setForm] = useState<FichaData>(EMPTY_FICHA());
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dentistOpen, setDentistOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await db.from("avaliacoes").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    setRow(data as FichaRow);
    setForm(fichaFromRow(data));
    setLoading(false);
    setNames(await fetchProfileNames([data.created_by, data.updated_by, data.dentista_id]));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (p: Partial<FichaData>) => setForm((f) => ({ ...f, ...p }));

  // Salva o formulário + campos extras (status/assinatura/dentista). Retorna ok.
  const persist = async (extra: Record<string, unknown> = {}): Promise<boolean> => {
    if (!form.paciente_nome.trim()) {
      toast.error("Informe o nome do paciente");
      return false;
    }
    const payload = {
      ...form,
      data_avaliacao: form.data_avaliacao || null,
      paciente_data_nascimento: form.paciente_data_nascimento || null,
      ...extra,
    };
    const { error } = await db.from("avaliacoes").update(payload).eq("id", id);
    if (error) {
      console.error("[ficha] update error:", error.message);
      toast.error("Falha ao salvar a ficha");
      return false;
    }
    return true;
  };

  const salvar = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) {
      toast.success("Ficha salva");
      load();
    }
  };

  const enviarParaDentista = async (dentistaId: string) => {
    setSaving(true);
    const ok = await persist({ dentista_id: dentistaId });
    setSaving(false);
    setDentistOpen(false);
    if (ok) {
      toast.success("Ficha enviada ao dentista");
      load();
    }
  };

  // Avaliação concluída (pelo dentista ou recepção): volta para a recepção para
  // coletar a assinatura da clínica.
  const concluirAvaliacao = async () => {
    setSaving(true);
    const ok = await persist({ status: "aguardando_assinatura_clinica" });
    setSaving(false);
    if (ok) {
      toast.success("Avaliação concluída — pronta para a assinatura da clínica");
      load();
    }
  };

  // 1ª assinatura: a clínica/representante assina no pad. Vai no campo
  // "Representante da Contratada" do PDF e libera a etapa do paciente.
  const coletarAssinaturaClinica = async (dataUrl: string) => {
    setSaving(true);
    const ok = await persist({
      assinatura_clinica: dataUrl,
      clinica_assinada_em: new Date().toISOString(),
      status: "aguardando_assinatura_paciente",
    });
    setSaving(false);
    setSignOpen(false);
    if (ok) {
      toast.success("Assinatura da clínica registrada");
      load();
    }
  };

  // 2ª etapa: gera o link único do paciente (token novo + validade 72h).
  const gerarLink = async () => {
    setSaving(true);
    const token = crypto.randomUUID();
    const expira = new Date(Date.now() + LINK_HORAS * 60 * 60 * 1000).toISOString();
    const ok = await persist({
      link_assinatura_token: token,
      link_assinatura_expira_em: expira,
      status: "aguardando_assinatura_paciente",
    });
    setSaving(false);
    if (ok) {
      toast.success("Link gerado para o paciente assinar");
      load();
    }
  };

  const gerarPdf = async () => {
    if (!row) return;
    try {
      let cidade: string | null = null;
      if (row.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("cidade")
          .eq("id", row.company_id)
          .maybeSingle();
        cidade = comp?.cidade ?? null;
      }
      const { downloadFichaAvaliacaoPdf } = await import("@/lib/ficha-avaliacao-pdf");
      // row fornece campos de sistema (assinaturas); form sobrepõe os dados (edições atuais).
      await downloadFichaAvaliacaoPdf({ ...row, ...form }, { cidade });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!row) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-medium">Ficha não encontrada</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate({ to: "/fichas-avaliacao" })}
        >
          Voltar
        </Button>
      </main>
    );
  }

  const st = STATUS_META[row.status] ?? STATUS_META.rascunho;
  const editable = row.status === "rascunho";
  const link = row.link_assinatura_token ? publicSignUrl(row.id, row.link_assinatura_token) : "";
  const linkGerado = !!row.link_assinatura_expira_em;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 gap-1.5"
            onClick={() => navigate({ to: "/fichas-avaliacao" })}
          >
            <ChevronLeft className="h-4 w-4" /> Fichas de Avaliação
          </Button>
          <h1 className="text-2xl font-bold">{row.paciente_nome || "Sem nome"}</h1>
          {row.dentista_id && (
            <p className="text-sm text-muted-foreground">
              Dentista responsável: {names[row.dentista_id] ?? "—"}
            </p>
          )}
        </div>
        <Badge variant="outline" className={st.cls}>
          {st.label}
        </Badge>
      </div>

      {/* ── 1ª assinatura: clínica/representante (Representante da Contratada) ── */}
      {row.status === "aguardando_assinatura_clinica" && (
        <Card className="mb-5 p-4">
          {isDentist ? (
            <div>
              <h2 className="font-semibold">Avaliação concluída</h2>
              <p className="text-sm text-muted-foreground">
                A ficha voltou para a recepção coletar a assinatura da clínica.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Assinatura da clínica</h2>
                <p className="text-sm text-muted-foreground">
                  Revise a ficha e assine pela clínica/representante. Em seguida você poderá gerar o
                  link para o paciente assinar.
                </p>
              </div>
              <Button className="gap-1.5" onClick={() => setSignOpen(true)} disabled={saving}>
                <PenLine className="h-4 w-4" /> Assinar pela clínica
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── 2ª assinatura: link do paciente (Cliente responsável) ── */}
      {row.status === "aguardando_assinatura_paciente" && (
        <Card className="mb-5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {row.assinatura_clinica && (
                <img
                  src={row.assinatura_clinica}
                  alt="Assinatura da clínica"
                  className="h-14 w-40 rounded-lg border border-border bg-white object-contain p-1"
                />
              )}
              <div>
                <h2 className="font-semibold">Clínica assinou</h2>
                <p className="text-sm text-muted-foreground">
                  {linkGerado
                    ? `Envie o link ao paciente — ele lê a ficha e assina (válido por ${LINK_HORAS}h).`
                    : "Gere o link único para o paciente ler e assinar."}
                </p>
              </div>
            </div>
            {!isDentist && (
              <Button className="gap-1.5" onClick={gerarLink} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {linkGerado ? "Gerar novo link" : "Gerar Link para o Paciente"}
              </Button>
            )}
          </div>
          {linkGerado && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="outline" className="gap-1.5" onClick={copyLink}>
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
            </div>
          )}
        </Card>
      )}

      {row.status === "assinado" && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <h2 className="font-semibold">Ficha assinada</h2>
              <p className="text-sm text-muted-foreground">
                Paciente assinou em{" "}
                {row.paciente_assinado_em
                  ? new Date(row.paciente_assinado_em).toLocaleString("pt-BR")
                  : "—"}
                .
              </p>
            </div>
          </div>
          <Button className="gap-1.5" onClick={gerarPdf}>
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
        </Card>
      )}

      {/* ── Assinaturas (quando houver) ── */}
      {(row.assinatura_clinica || row.assinatura_paciente) && row.status !== "rascunho" && (
        <Card className="mb-5 grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Representante da Contratada
            </p>
            {row.assinatura_clinica ? (
              <img
                src={row.assinatura_clinica}
                alt="Assinatura da clínica"
                className="h-20 w-full rounded-lg border border-border bg-white object-contain p-1"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Pendente</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Cliente responsável
            </p>
            {row.assinatura_paciente ? (
              <img
                src={row.assinatura_paciente}
                alt="Assinatura do paciente"
                className="h-20 w-full rounded-lg border border-border bg-white object-contain p-1"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando paciente</p>
            )}
          </div>
        </Card>
      )}

      <FichaForm value={form} onChange={patch} readOnly={!editable} />

      <AuditFooter
        createdByName={row.created_by ? names[row.created_by] : null}
        createdAt={row.created_at}
        updatedByName={row.updated_by ? names[row.updated_by] : null}
        updatedAt={row.updated_at}
      />

      {/* ── Barra de ações ── */}
      <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
        <Button variant="outline" className="gap-2" onClick={gerarPdf}>
          <Download className="h-4 w-4" /> Gerar PDF
        </Button>
        {editable && (
          <>
            <Button variant="outline" className="gap-2" onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            {!isDentist && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setDentistOpen(true)}
                disabled={saving}
              >
                <Send className="h-4 w-4" />
                {row.dentista_id ? "Trocar dentista" : "Enviar para dentista"}
              </Button>
            )}
            <Button className="gap-2" onClick={concluirAvaliacao} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Concluir avaliação
            </Button>
          </>
        )}
      </div>

      <EnviarDentistaDialog
        open={dentistOpen}
        onOpenChange={setDentistOpen}
        companyId={profile?.company_id}
        onConfirm={enviarParaDentista}
        saving={saving}
      />
      <SignDialog
        open={signOpen}
        title="Assinatura da clínica"
        description="Desenhe a assinatura do representante da clínica."
        onOpenChange={setSignOpen}
        onConfirm={coletarAssinaturaClinica}
      />
    </main>
  );
}
