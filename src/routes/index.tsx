import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Download, FileText, Stethoscope, Loader2 } from "lucide-react";
import { generatePatientPdf } from "@/lib/pdf";

export const Route = createFileRoute("/")({
  component: ReceptionDashboard,
  head: () => ({
    meta: [{ title: "Recepção — OdontoClinic" }],
  }),
});

type Patient = {
  id: string;
  token: string;
  prontuario: string;
  nome: string | null;
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  telefone: string | null;
  convenio: string | null;
  signature_data: string | null;
  signed_at: string | null;
  status: string;
  created_at: string;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  aguardando: { label: "Aguardando assinatura", cls: "bg-warning/15 text-warning border-warning/30" },
  assinado: { label: "Contrato assinado", cls: "bg-success/15 text-success border-success/30" },
  pdf_gerado: { label: "PDF gerado", cls: "bg-success/15 text-success border-success/30" },
};

function ReceptionDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<{ url: string; prontuario: string } | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar pacientes");
    else setPatients((data ?? []) as Patient[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("patients-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleNew = async () => {
    setCreating(true);
    const { data: prontData, error: pErr } = await supabase.rpc("next_prontuario");
    if (pErr || !prontData) { toast.error("Erro ao gerar prontuário"); setCreating(false); return; }
    const { data, error } = await supabase
      .from("patients")
      .insert({ prontuario: prontData as string })
      .select()
      .single();
    setCreating(false);
    if (error || !data) { toast.error("Erro ao criar cadastro"); return; }
    const url = `${window.location.origin}/cadastro/${data.token}`;
    setNewLink({ url, prontuario: data.prontuario });
    toast.success("Novo cadastro criado");
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const downloadPdf = async (p: Patient) => {
    const doc = generatePatientPdf(p);
    doc.save(`${p.prontuario}-${(p.nome || "paciente").replace(/\s+/g, "_")}.pdf`);
    if (p.status !== "pdf_gerado") {
      await supabase.from("patients").update({ status: "pdf_gerado" }).eq("id", p.id);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
              style={{ background: "var(--gradient-clinical)" }}
            >
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">OdontoClinic</h1>
              <p className="text-xs text-muted-foreground">Recepção • Cadastro Digital</p>
            </div>
          </div>
          <Button onClick={handleNew} disabled={creating} size="lg" className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Novo Cadastro
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {newLink && (
          <Card className="mb-6 border-primary/30 p-5 shadow-[var(--shadow-lift)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground hover:bg-primary">{newLink.prontuario}</Badge>
                  <span className="text-sm font-medium">Link gerado com sucesso</span>
                </div>
                <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  {newLink.url}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Envie este link ao paciente pelo WhatsApp.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => copyLink(newLink.url)} className="gap-2">
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
                <Button onClick={() => window.open(newLink.url, "_blank")} className="gap-2">
                  <ExternalLink className="h-4 w-4" /> Abrir
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Pacientes</h2>
            <p className="text-sm text-muted-foreground">Acompanhe o status de cada cadastro em tempo real.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : patients.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum cadastro ainda</p>
            <p className="text-sm text-muted-foreground">Clique em "Novo Cadastro" para começar.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {patients.map((p) => {
              const st = statusMap[p.status] ?? statusMap.aguardando;
              const url = typeof window !== "undefined" ? `${window.location.origin}/cadastro/${p.token}` : "";
              const canDownload = !!p.signature_data;
              return (
                <Card key={p.id} className="p-4 transition hover:shadow-[var(--shadow-card)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{p.prontuario}</span>
                        <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                      </div>
                      <p className="mt-1 truncate font-medium">
                        {p.nome || <span className="text-muted-foreground italic">Aguardando preenchimento</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {new Date(p.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyLink(url)} className="gap-1.5">
                        <Copy className="h-3.5 w-3.5" /> Link
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => downloadPdf(p)}
                        disabled={!canDownload}
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" /> Baixar PDF
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
