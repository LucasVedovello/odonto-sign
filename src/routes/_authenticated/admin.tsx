import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Building2, Users, FileText, ShieldCheck, Search, CheckCircle2,
  XCircle, RotateCcw, Headset, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Super Admin — OdontoClinic" }] }),
});

type Company = {
  id: string; company_name: string; company_email: string; created_at: string;
  approval_status: string; rejection_reason: string | null; approved_at: string | null;
};
type Profile = { id: string; first_name: string | null; last_name: string | null; email: string; company_id: string; is_admin: boolean; status: string };
type Patient = { id: string; nome: string | null; prontuario: string | null; status: string; created_at: string; signed_at: string | null; company_id: string };
type TicketUser = { first_name: string | null; last_name: string | null; email: string };
type Ticket = {
  id: string; title: string; message: string; images: string[];
  status: string; created_at: string; user_id: string; company_id: string;
  profiles: TicketUser | null;
};

const APPROVAL_BADGE: Record<string, string> = {
  pending:  "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};
const APPROVAL_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada" };

const TICKET_BADGE: Record<string, string> = {
  open:        "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  resolved:    "bg-success/15 text-success border-success/30",
  closed:      "bg-muted text-muted-foreground",
};
const TICKET_LABEL: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido", closed: "Fechado" };

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function AdminPage() {
  const { profile: me, loading: authLoading } = useAuth();
  const [data, setData] = useState<{ companies: Company[]; profiles: Profile[]; patients: Patient[]; tickets: Ticket[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Approval state
  const [approvalFilter, setApprovalFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [approvalAction, setApprovalAction] = useState<{ company: Company; type: "approve" | "reject" | "review" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actioning, setActioning] = useState(false);

  // Ticket state
  const [ticketFilter, setTicketFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketStatus, setTicketStatus] = useState("");
  const [savingTicket, setSavingTicket] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = async () => {
    const [c, p, pa, tk] = await Promise.all([
      supabase.from("companies").select("id,company_name,company_email,created_at,approval_status,rejection_reason,approved_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,first_name,last_name,email,company_id,is_admin,status"),
      supabase.from("patients").select("id,nome,prontuario,status,created_at,signed_at,company_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("support_tickets").select("id,title,message,images,status,created_at,user_id,company_id,profiles!inner(first_name,last_name,email)").order("created_at", { ascending: false }).limit(200),
    ]);
    setData({
      companies: (c.data ?? []) as Company[],
      profiles: (p.data ?? []) as Profile[],
      patients: (pa.data ?? []) as Patient[],
      tickets: (tk.data ?? []) as unknown as Ticket[],
    });
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !me?.is_admin) return;
    load();
  }, [authLoading, me?.is_admin]);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    data?.companies.forEach((c) => m.set(c.id, c.company_name));
    return m;
  }, [data]);

  const pendingCount = useMemo(() => data?.companies.filter((c) => c.approval_status === "pending").length ?? 0, [data]);
  const openTicketCount = useMemo(() => data?.tickets.filter((t) => t.status === "open").length ?? 0, [data]);

  if (authLoading || (!me && !authLoading)) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;
  if (!me?.is_admin) return <Center><p className="text-muted-foreground">Acesso negado.</p></Center>;
  if (loading || !data) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;

  const ql = q.trim().toLowerCase();
  const fs = (s: string | null | undefined) => (s ?? "").toLowerCase().includes(ql);

  const filteredCompanies = ql ? data.companies.filter((c) => fs(c.company_name) || fs(c.company_email)) : data.companies;
  const filteredProfiles = ql ? data.profiles.filter((p) => fs(p.email) || fs(p.first_name) || fs(p.last_name)) : data.profiles;
  const filteredPatients = ql ? data.patients.filter((p) => fs(p.nome) || fs(p.prontuario) || fs(companyMap.get(p.company_id) ?? "")) : data.patients;

  const filteredApprovals = data.companies
    .filter((c) => approvalFilter === "all" || c.approval_status === approvalFilter)
    .sort((a, b) => (a.approval_status === "pending" ? -1 : 1) - (b.approval_status === "pending" ? -1 : 1));

  const filteredTickets = data.tickets.filter((t) => {
    if (ticketFilter !== "all" && t.status !== ticketFilter) return false;
    if (ql) {
      const name = `${t.profiles?.first_name ?? ""} ${t.profiles?.last_name ?? ""}`.toLowerCase();
      const company = (companyMap.get(t.company_id) ?? "").toLowerCase();
      return name.includes(ql) || company.includes(ql) || t.title.toLowerCase().includes(ql);
    }
    return true;
  });

  // ── Approval actions ──────────────────────────────────────
  const handleApprovalAction = async () => {
    if (!approvalAction || !me) return;
    setActioning(true);
    const { company, type } = approvalAction;
    try {
      if (type === "approve") {
        const { error } = await supabase.from("companies").update({
          approval_status: "approved", approved_at: new Date().toISOString(), approved_by: me.id, rejection_reason: null,
        }).eq("id", company.id);
        if (error) throw error;
        // Notify owner
        const owner = data.profiles.find((p) => p.company_id === company.id);
        if (owner) {
          await supabase.functions.invoke("notify-company-approved", {
            body: { ownerEmail: owner.email, ownerName: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(), companyName: company.company_name, approved: true },
          }).catch(() => {});
        }
        toast.success("Clínica aprovada");
      } else if (type === "reject") {
        if (!rejectionReason.trim()) { toast.error("Informe o motivo da rejeição"); setActioning(false); return; }
        const { error } = await supabase.from("companies").update({
          approval_status: "rejected", rejection_reason: rejectionReason.trim(),
        }).eq("id", company.id);
        if (error) throw error;
        const owner = data.profiles.find((p) => p.company_id === company.id);
        if (owner) {
          await supabase.functions.invoke("notify-company-approved", {
            body: { ownerEmail: owner.email, ownerName: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(), companyName: company.company_name, approved: false, rejectionReason: rejectionReason.trim() },
          }).catch(() => {});
        }
        toast.success("Clínica rejeitada");
      } else {
        // review → reset to pending
        const { error } = await supabase.from("companies").update({ approval_status: "pending", rejection_reason: null, approved_at: null, approved_by: null }).eq("id", company.id);
        if (error) throw error;
        toast.success("Status redefinido para pendente");
      }
      setApprovalAction(null); setRejectionReason("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setActioning(false);
    }
  };

  // ── Ticket save ───────────────────────────────────────────
  const handleSaveTicket = async () => {
    if (!selectedTicket) return;
    setSavingTicket(true);
    const { error } = await supabase.from("support_tickets").update({ status: ticketStatus, updated_at: new Date().toISOString() }).eq("id", selectedTicket.id);
    setSavingTicket(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Status atualizado");
    setSelectedTicket(null);
    load();
  };

  const openTicketImage = async (path: string) => {
    const { data: signedData } = await supabase.storage.from("support-images").createSignedUrl(path, 3600);
    if (signedData?.signedUrl) setLightboxUrl(signedData.signedUrl);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Visão global de todas as clínicas cadastradas.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Clínicas" value={data.companies.length} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Usuários" value={data.profiles.length} />
        <StatCard icon={<FileText className="h-5 w-5" />} label="Pacientes" value={data.patients.length} />
        <StatCard icon={<Headset className="h-5 w-5" />} label="Tickets" value={data.tickets.length} />
      </div>

      <div className="relative mb-4 w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="pl-9" />
      </div>

      <Tabs defaultValue="companies">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="companies">Clínicas ({filteredCompanies.length})</TabsTrigger>
          <TabsTrigger value="users">Usuários ({filteredProfiles.length})</TabsTrigger>
          <TabsTrigger value="patients">Pacientes ({filteredPatients.length})</TabsTrigger>
          <TabsTrigger value="approvals">
            Aprovações {pendingCount > 0 && <span className="ml-1 rounded-full bg-warning text-warning-foreground px-1.5 text-xs">{pendingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="tickets">
            Suporte {openTicketCount > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-xs">{openTicketCount}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ── Clínicas ── */}
        <TabsContent value="companies" className="mt-4 grid gap-2">
          {filteredCompanies.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.company_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.company_email}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className={APPROVAL_BADGE[c.approval_status]}>{APPROVAL_LABEL[c.approval_status]}</Badge>
                  <Badge variant="outline">{data.profiles.filter((p) => p.company_id === c.id).length} usuários</Badge>
                  <Badge variant="outline">{data.patients.filter((p) => p.company_id === c.id).length} pacientes</Badge>
                </div>
              </div>
            </Card>
          ))}
          {filteredCompanies.length === 0 && <Empty label="Nenhuma clínica" />}
        </TabsContent>

        {/* ── Usuários ── */}
        <TabsContent value="users" className="mt-4 grid gap-2">
          {filteredProfiles.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{companyMap.get(p.company_id) ?? "—"}</Badge>
                  {p.is_admin && <Badge className="bg-primary text-primary-foreground">Admin</Badge>}
                  <Badge variant="outline" className={p.status === "active" ? "border-success/40 text-success" : ""}>{p.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
          {filteredProfiles.length === 0 && <Empty label="Nenhum usuário" />}
        </TabsContent>

        {/* ── Pacientes ── */}
        <TabsContent value="patients" className="mt-4 grid gap-2">
          {filteredPatients.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {p.nome || <span className="italic text-muted-foreground">Aguardando preenchimento</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.prontuario && <span className="font-mono mr-2">{p.prontuario}</span>}
                    {fmtDate(p.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{companyMap.get(p.company_id) ?? "—"}</Badge>
                  <Badge variant="outline" className={p.signed_at ? "border-success/40 text-success" : "border-warning/40 text-warning"}>
                    {p.signed_at ? "Assinado" : "Pendente"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
          {filteredPatients.length === 0 && <Empty label="Nenhum paciente" />}
        </TabsContent>

        {/* ── Aprovações ── */}
        <TabsContent value="approvals" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((k) => (
              <Button key={k} size="sm" variant={approvalFilter === k ? "default" : "outline"}
                onClick={() => setApprovalFilter(k)}>
                {{ all: "Todos", pending: "Pendentes", approved: "Aprovadas", rejected: "Rejeitadas" }[k]}
              </Button>
            ))}
          </div>
          <div className="grid gap-2">
            {filteredApprovals.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold truncate">{c.company_name}</p>
                      <Badge variant="outline" className={APPROVAL_BADGE[c.approval_status]}>
                        {APPROVAL_LABEL[c.approval_status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.company_email}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</p>
                    {c.rejection_reason && (
                      <p className="mt-1 text-xs text-destructive">Motivo: {c.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {c.approval_status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => setApprovalAction({ company: c, type: "approve" })}
                          className="gap-1.5 bg-success text-white hover:bg-success/90">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setApprovalAction({ company: c, type: "reject" }); setRejectionReason(""); }}
                          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </>
                    )}
                    {c.approval_status !== "pending" && (
                      <Button size="sm" variant="outline" onClick={() => setApprovalAction({ company: c, type: "review" })}
                        className="gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" /> Rever
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {filteredApprovals.length === 0 && <Empty label="Nenhuma empresa" />}
          </div>
        </TabsContent>

        {/* ── Suporte ── */}
        <TabsContent value="tickets" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["all", "open", "in_progress", "resolved", "closed"] as const).map((k) => (
              <Button key={k} size="sm" variant={ticketFilter === k ? "default" : "outline"}
                onClick={() => setTicketFilter(k)}>
                {{ all: "Todos", open: "Abertos", in_progress: "Em andamento", resolved: "Resolvidos", closed: "Fechados" }[k]}
              </Button>
            ))}
          </div>
          <div className="grid gap-2">
            {filteredTickets.map((t) => {
              const userName = `${t.profiles?.first_name ?? ""} ${t.profiles?.last_name ?? ""}`.trim() || t.profiles?.email || "—";
              return (
                <Card key={t.id} className="p-4 cursor-pointer lift-on-hover"
                  onClick={() => { setSelectedTicket(t); setTicketStatus(t.status); }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{t.title}</p>
                        <Badge variant="outline" className={TICKET_BADGE[t.status]}>{TICKET_LABEL[t.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {userName} · {companyMap.get(t.company_id) ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
            {filteredTickets.length === 0 && <Empty label="Nenhum ticket" />}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal: Aprovar / Rejeitar ── */}
      <Dialog open={!!approvalAction} onOpenChange={(o) => !o && setApprovalAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction?.type === "approve" ? "Aprovar clínica" :
               approvalAction?.type === "reject" ? "Rejeitar clínica" : "Redefinir para pendente"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction?.company.company_name}
            </DialogDescription>
          </DialogHeader>
          {approvalAction?.type === "reject" && (
            <div className="grid gap-1.5">
              <Label>Motivo da rejeição *</Label>
              <textarea
                value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                rows={3} placeholder="Descreva o motivo..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>
          )}
          {approvalAction?.type === "approve" && (
            <p className="text-sm text-muted-foreground">A clínica será aprovada e notificada por email.</p>
          )}
          {approvalAction?.type === "review" && (
            <p className="text-sm text-muted-foreground">O status será redefinido para "Pendente" para nova análise.</p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApprovalAction(null)}>Cancelar</Button>
            <Button onClick={handleApprovalAction} disabled={actioning}
              className={approvalAction?.type === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" :
                         approvalAction?.type === "approve" ? "bg-success text-white hover:bg-success/90" : ""}>
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> :
               approvalAction?.type === "approve" ? "Aprovar" :
               approvalAction?.type === "reject" ? "Rejeitar" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Ticket detail ── */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headset className="h-4 w-4 text-primary" /> {selectedTicket?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket && `${`${selectedTicket.profiles?.first_name ?? ""} ${selectedTicket.profiles?.last_name ?? ""}`.trim() || selectedTicket.profiles?.email} · ${companyMap.get(selectedTicket.company_id) ?? "—"} · ${fmtDate(selectedTicket.created_at)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="rounded-md bg-muted px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {selectedTicket?.message}
            </div>

            {(selectedTicket?.images?.length ?? 0) > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Imagens</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket!.images.map((path, i) => (
                    <button key={i} type="button" onClick={() => openTicketImage(path)}
                      className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-primary hover:bg-accent">
                      <ExternalLink className="h-3 w-3" /> Imagem {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Status</Label>
              <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>Fechar</Button>
            <Button onClick={handleSaveTicket} disabled={savingTicket}>
              {savingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxUrl && <img src={lightboxUrl} alt="" className="w-full rounded-lg object-contain max-h-[80vh]" />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <Card className="p-8 text-center text-sm text-muted-foreground">{label}</Card>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center py-16">{children}</div>;
}
