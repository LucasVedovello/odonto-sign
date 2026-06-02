import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useDeferredValue, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Copy, ExternalLink, Plus, Download, FileText, Loader2, Search, Trash2, User, MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: ReceptionDashboard,
  head: () => ({ meta: [{ title: "Contratos — OdontoClinic" }] }),
});

type Patient = {
  id: string;
  token: string;
  prontuario: string | null;
  nome: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  signature_data: string | null;
  signed_at: string | null;
  status: string;
  created_at: string;
  created_by_user: string | null;
  creator?: { first_name: string | null; last_name: string | null } | null;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  aguardando: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  assinado: { label: "Assinado", cls: "bg-success/15 text-success border-success/30" },
  pdf_gerado: { label: "Finalizado", cls: "bg-success/15 text-success border-success/30" },
};

type FilterKey = "todos" | "pendente" | "finalizado";

function ReceptionDashboard() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProntuario, setNewProntuario] = useState("");
  const [newLink, setNewLink] = useState<{ url: string; prontuario: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [toDelete, setToDelete] = useState<Patient | null>(null);
  const [confirmTwice, setConfirmTwice] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [whatsappAsk, setWhatsappAsk] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("patients")
      .select("id,token,prontuario,nome,cpf,rg,data_nascimento,endereco,telefone,email,signature_data,signed_at,status,created_at,created_by_user,creator:profiles!patients_created_by_user_fkey(first_name,last_name)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Erro ao carregar pacientes");
    else setPatients((data ?? []) as unknown as Patient[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    load();
    const ch = supabase
      .channel("patients-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, profile]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (filter === "pendente" && p.status !== "aguardando") return false;
      if (filter === "finalizado" && p.status === "aguardando") return false;
      if (!q) return true;
      return (
        (p.nome ?? "").toLowerCase().includes(q) ||
        (p.prontuario ?? "").toLowerCase().includes(q) ||
        (p.cpf ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [patients, deferredQuery, filter]);

  const counts = useMemo(() => ({
    todos: patients.length,
    pendente: patients.filter((p) => p.status === "aguardando").length,
    finalizado: patients.filter((p) => p.status !== "aguardando").length,
  }), [patients]);

  const handleCreate = async () => {
    if (!profile?.company_id) return;
    setCreating(true);
    const prontuario = newProntuario.trim() || null;
    const { data, error } = await supabase
      .from("patients")
      .insert({ prontuario, company_id: profile.company_id, created_by_user: profile.id })
      .select("id,token,prontuario")
      .single();
    setCreating(false);
    if (error || !data) { toast.error("Erro ao criar cadastro"); return; }
    const url = `${window.location.origin}/cadastro/${data.token}`;
    setNewLink({ url, prontuario: data.prontuario });
    setDialogOpen(false);
    setNewProntuario("");
    setWhatsappAsk(url);
    toast.success("Link gerado");
  };

  const handleWhatsappYes = () => {
    if (!whatsappAsk) return;
    const msg = `Olá! 😊 Segue o link para assinatura do seu contrato com a OdontoClinic. ⚠️ Este link expira em 5 minutos. Acesse: ${whatsappAsk}`;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    } else {
      // Desktop: open WhatsApp Desktop app via protocol; copy link as automatic fallback
      window.open(`whatsapp://send?text=${encodeURIComponent(msg)}`);
      navigator.clipboard.writeText(whatsappAsk).catch(() => {});
      toast.success("WhatsApp solicitado • Link copiado como backup");
    }
    setWhatsappAsk(null);
  };

  const handleWhatsappNo = async () => {
    if (!whatsappAsk) return;
    try { await navigator.clipboard.writeText(whatsappAsk); } catch { /* noop */ }
    toast.success("Link copiado com sucesso");
    setWhatsappAsk(null);
  };

  const copyLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }, []);

  const downloadPdf = useCallback(async (p: Patient) => {
    const { generatePatientPdf } = await import("@/lib/pdf");
    const creatorName = p.creator
      ? `${p.creator.first_name ?? ""} ${p.creator.last_name ?? ""}`.trim()
      : null;
    const doc = await generatePatientPdf({ ...p, creator_name: creatorName, created_at: p.created_at });
    const fname = `${p.prontuario || "cadastro"}-${(p.nome || "paciente").replace(/\s+/g, "_")}.pdf`;
    doc.save(fname);
    if (p.status !== "pdf_gerado") {
      await supabase.from("patients").update({ status: "pdf_gerado" }).eq("id", p.id);
    }
  }, []);

  const askDelete = useCallback((p: Patient) => {
    setToDelete(p);
    setConfirmTwice(false);
  }, []);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("patients").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Cadastro excluído");
    setPatients((ps) => ps.filter((x) => x.id !== toDelete.id));
    setToDelete(null);
  };

  const isFinalized = !!toDelete?.signature_data;
  const canConfirmDelete = !isFinalized || confirmTwice;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-sm text-muted-foreground">Gerencie cadastros e contratos digitais.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="lg" className="gap-2">
          <Plus className="h-4 w-4" /> Novo Cadastro
        </Button>
      </div>

      {newLink && (
        <Card className="mb-6 border-primary/30 p-5 shadow-[var(--shadow-lift)]">
          <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 flex-wrap">
                {newLink.prontuario && (
                  <Badge className="bg-primary text-primary-foreground hover:bg-primary">{newLink.prontuario}</Badge>
                )}
                <span className="text-sm font-medium">Link gerado — envie ao paciente</span>
              </div>
              <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                {newLink.url}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, CPF, email ou prontuário..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["todos", "Todos"],
            ["pendente", "Pendentes"],
            ["finalizado", "Finalizados"],
          ] as const).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              onClick={() => setFilter(k)}
              className="gap-2"
            >
              {label}
              <span className="rounded-full bg-background/30 px-1.5 text-xs">{counts[k]}</span>
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{patients.length === 0 ? "Nenhum cadastro ainda" : "Nenhum resultado"}</p>
          <p className="text-sm text-muted-foreground">
            {patients.length === 0 ? 'Clique em "Novo Cadastro" para começar.' : "Tente outro termo ou filtro."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 card-list">
          {filtered.map((p) => (
            <PatientRow key={p.id} p={p} onCopy={copyLink} onDownload={downloadPdf} onDelete={askDelete} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cadastro</DialogTitle>
            <DialogDescription>
              Informe o número de prontuário do sistema oficial (opcional). Um link único será gerado para o paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="pront">Prontuário (opcional)</Label>
            <Input
              id="pront"
              value={newProntuario}
              onChange={(e) => setNewProntuario(e.target.value)}
              placeholder="Ex: 12345"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFinalized ? "Excluir paciente?" : "Excluir contrato pendente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFinalized
                ? "Esta ação remove permanentemente o cadastro, o contrato assinado, o PDF e a assinatura digital. Não pode ser desfeita."
                : "Esta ação remove permanentemente o cadastro pendente e cancela o link enviado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isFinalized && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <input
                type="checkbox"
                checked={confirmTwice}
                onChange={(e) => setConfirmTwice(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <span>Confirmo que desejo excluir todos os dados deste paciente finalizado.</span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirmDelete || deleting}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!whatsappAsk} onOpenChange={(o) => !o && setWhatsappAsk(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-success" />
              Deseja enviar por WhatsApp?
            </DialogTitle>
            <DialogDescription>
              Envie o link diretamente pelo WhatsApp ou copie para usar em outro canal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleWhatsappNo} className="flex-1">
              Não, apenas copiar
            </Button>
            <Button onClick={handleWhatsappYes} className="flex-1 gap-2 bg-success text-primary-foreground hover:bg-success/90">
              <MessageCircle className="h-4 w-4" /> Sim, enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PatientRow({
  p, onCopy, onDownload, onDelete,
}: {
  p: Patient;
  onCopy: (url: string) => void;
  onDownload: (p: Patient) => void;
  onDelete: (p: Patient) => void;
}) {
  const st = statusMap[p.status] ?? statusMap.aguardando;
  const url = typeof window !== "undefined" ? `${window.location.origin}/cadastro/${p.token}` : "";
  const canDownload = !!p.signature_data;
  const creator = p.creator ? `${p.creator.first_name ?? ""} ${p.creator.last_name ?? ""}`.trim() : "";

  return (
    <Card className="p-4 lift-on-hover">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {p.prontuario && (
              <span className="font-mono text-xs font-semibold text-primary">{p.prontuario}</span>
            )}
            <Badge variant="outline" className={st.cls}>{st.label}</Badge>
          </div>
          <p className="mt-1 truncate font-medium">
            {p.nome || <span className="text-muted-foreground italic">Aguardando preenchimento</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {creator && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" /> Criado por {creator}
              </span>
            )}
            <span>{new Date(p.created_at).toLocaleString("pt-BR")}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onCopy(url)} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Link
          </Button>
          <Button size="sm" onClick={() => onDownload(p)} disabled={!canDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(p)}
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>
    </Card>
  );
}
