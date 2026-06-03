import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  XCircle, RotateCcw, Headset, Trash2, Send, Paperclip, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Super Admin — OdontoClinic" }] }),
});

// Cast to any for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
type SupportMessage = {
  id: string; ticket_id: string; sender_id: string;
  sender_role: "user" | "admin";
  content: string | null; attachment_url: string | null; attachment_name: string | null;
  created_at: string;
};

const APPROVAL_BADGE: Record<string, string> = {
  pending:  "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};
const APPROVAL_LABEL: Record<string, string> = { pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada" };

const TICKET_BADGE: Record<string, string> = {
  open:        "bg-warning/15 text-warning border-warning/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  resolved:    "bg-success/15 text-success border-success/30",
};
const TICKET_LABEL: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido" };

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const isImage = (url: string | null) => !!url && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);

function sanitize(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

  // Ticket / chat state
  const [ticketFilter, setTicketFilter] = useState("all");
  const [chatTicket, setChatTicket] = useState<Ticket | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [loadingChatMsgs, setLoadingChatMsgs] = useState(false);
  const [adminReply, setAdminReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [adminAttach, setAdminAttach] = useState<File | null>(null);
  const [ticketStatus, setTicketStatus] = useState("open");
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);
  const adminAttachRef = useRef<HTMLInputElement>(null);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = async () => {
    const [c, p, pa, tk] = await Promise.all([
      db.from("companies").select("id,company_name,company_email,created_at,approval_status,rejection_reason,approved_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,first_name,last_name,email,company_id,is_admin,status"),
      supabase.from("patients").select("id,nome,prontuario,status,created_at,signed_at,company_id").order("created_at", { ascending: false }).limit(500),
      db.from("support_tickets").select("id,title,message,images,status,created_at,user_id,company_id,profiles!inner(first_name,last_name,email)").order("created_at", { ascending: false }).limit(200),
    ]);
    setData({
      companies: (c.data ?? []) as Company[],
      profiles: (p.data ?? []) as Profile[],
      patients: (pa.data ?? []) as Patient[],
      tickets: (tk.data ?? []) as Ticket[],
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
        const { error } = await db.from("companies").update({
          approval_status: "approved", approved_at: new Date().toISOString(), approved_by: me.id, rejection_reason: null,
        }).eq("id", company.id);
        if (error) throw error;
        const owner = data.profiles.find((p) => p.company_id === company.id);
        if (owner) supabase.functions.invoke("notify-company-approved", {
          body: { ownerEmail: owner.email, ownerName: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(), companyName: company.company_name, approved: true },
        }).catch(() => {});
        toast.success("Clínica aprovada");
      } else if (type === "reject") {
        if (!rejectionReason.trim()) { toast.error("Informe o motivo da rejeição"); setActioning(false); return; }
        const { error } = await db.from("companies").update({ approval_status: "rejected", rejection_reason: rejectionReason.trim() }).eq("id", company.id);
        if (error) throw error;
        const owner = data.profiles.find((p) => p.company_id === company.id);
        if (owner) supabase.functions.invoke("notify-company-approved", {
          body: { ownerEmail: owner.email, ownerName: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(), companyName: company.company_name, approved: false, rejectionReason: rejectionReason.trim() },
        }).catch(() => {});
        toast.success("Clínica rejeitada");
      } else {
        const { error } = await db.from("companies").update({ approval_status: "pending", rejection_reason: null, approved_at: null, approved_by: null }).eq("id", company.id);
        if (error) throw error;
        toast.success("Status redefinido para pendente");
      }
      setApprovalAction(null); setRejectionReason("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally { setActioning(false); }
  };

  // ── Chat ──────────────────────────────────────────────────
  const openChat = async (t: Ticket) => {
    setChatTicket(t);
    setTicketStatus(t.status);
    setAdminReply("");
    setAdminAttach(null);
    setLoadingChatMsgs(true);
    const { data: msgs } = await db
      .from("support_messages")
      .select("id,ticket_id,sender_id,sender_role,content,attachment_url,attachment_name,created_at")
      .eq("ticket_id", t.id)
      .order("created_at", { ascending: true });
    setChatMessages((msgs ?? []) as SupportMessage[]);
    setLoadingChatMsgs(false);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const reloadChatMessages = async (ticketId: string) => {
    const { data: msgs } = await db
      .from("support_messages")
      .select("id,ticket_id,sender_id,sender_role,content,attachment_url,attachment_name,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setChatMessages((msgs ?? []) as SupportMessage[]);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const handleAdminSend = async () => {
    if (!chatTicket || (!adminReply.trim() && !adminAttach)) return;
    setSendingReply(true);
    try {
      // Always get sender_id directly from auth so it matches auth.uid() in RLS
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Sessão expirada. Recarregue a página.");

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (adminAttach) {
        const path = `${chatTicket.id}/${Date.now()}_${sanitize(adminAttach.name)}`;
        const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, adminAttach);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("support-attachments").getPublicUrl(path);
          attachmentUrl = publicUrl;
          attachmentName = adminAttach.name;
        }
        setAdminAttach(null);
      }

      const payload = {
        ticket_id: chatTicket.id,
        sender_id: user.id,
        sender_role: "admin",
        content: adminReply.trim() || null,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      };

      const { error } = await db.from("support_messages").insert(payload);

      if (error) {
        if (import.meta.env.DEV) console.error("[admin-chat] support_messages INSERT error:", JSON.stringify(error, null, 2));
        throw error;
      }

      setAdminReply("");
      await reloadChatMessages(chatTicket.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar mensagem");
    } finally { setSendingReply(false); }
  };

  const handleSaveStatus = async () => {
    if (!chatTicket) return;
    setSavingStatus(true);
    const { error } = await (supabase as any).from("support_tickets").update({ status: ticketStatus, updated_at: new Date().toISOString() }).eq("id", chatTicket.id);
    setSavingStatus(false);
    if (error) { toast.error("Erro ao salvar status"); return; }
    toast.success("Status atualizado");
    setChatTicket((prev) => prev ? { ...prev, status: ticketStatus } : null);
    load();
  };

  const handleDeleteTicket = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("support_tickets").delete().eq("id", deleteConfirm.id);
    setDeleting(false);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Ticket excluído");
    setDeleteConfirm(null);
    if (chatTicket?.id === deleteConfirm.id) setChatTicket(null);
    load();
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
              <Button key={k} size="sm" variant={approvalFilter === k ? "default" : "outline"} onClick={() => setApprovalFilter(k)}>
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
                      <Badge variant="outline" className={APPROVAL_BADGE[c.approval_status]}>{APPROVAL_LABEL[c.approval_status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.company_email}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</p>
                    {c.rejection_reason && <p className="mt-1 text-xs text-destructive">Motivo: {c.rejection_reason}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {c.approval_status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => setApprovalAction({ company: c, type: "approve" })} className="gap-1.5 bg-success text-white hover:bg-success/90">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setApprovalAction({ company: c, type: "reject" }); setRejectionReason(""); }} className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </>
                    )}
                    {c.approval_status !== "pending" && (
                      <Button size="sm" variant="outline" onClick={() => setApprovalAction({ company: c, type: "review" })} className="gap-1.5">
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
            {(["all", "open", "in_progress", "resolved"] as const).map((k) => (
              <Button key={k} size="sm" variant={ticketFilter === k ? "default" : "outline"} onClick={() => setTicketFilter(k)}>
                {{ all: "Todos", open: "Abertos", in_progress: "Em andamento", resolved: "Resolvidos" }[k]}
              </Button>
            ))}
          </div>
          <div className="grid gap-2">
            {filteredTickets.map((t) => {
              const userName = `${t.profiles?.first_name ?? ""} ${t.profiles?.last_name ?? ""}`.trim() || t.profiles?.email || "—";
              const tb = TICKET_BADGE[t.status] ?? TICKET_BADGE.open;
              const tl = TICKET_LABEL[t.status] ?? "Aberto";
              return (
                <Card key={t.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openChat(t)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium truncate">{t.title}</p>
                        <Badge variant="outline" className={tb}>{tl}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{userName} · {companyMap.get(t.company_id) ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openChat(t)} className="gap-1.5">
                        <Headset className="h-3.5 w-3.5" /> Chat
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(t)}
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
            {filteredTickets.length === 0 && <Empty label="Nenhum ticket" />}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal: Aprovação ── */}
      <Dialog open={!!approvalAction} onOpenChange={(o) => !o && setApprovalAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction?.type === "approve" ? "Aprovar clínica" : approvalAction?.type === "reject" ? "Rejeitar clínica" : "Redefinir para pendente"}
            </DialogTitle>
            <DialogDescription>{approvalAction?.company.company_name}</DialogDescription>
          </DialogHeader>
          {approvalAction?.type === "reject" && (
            <div className="grid gap-1.5">
              <Label>Motivo da rejeição *</Label>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3}
                placeholder="Descreva o motivo..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            </div>
          )}
          {approvalAction?.type === "approve" && <p className="text-sm text-muted-foreground">A clínica será aprovada e notificada por email.</p>}
          {approvalAction?.type === "review" && <p className="text-sm text-muted-foreground">O status será redefinido para "Pendente".</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApprovalAction(null)}>Cancelar</Button>
            <Button onClick={handleApprovalAction} disabled={actioning}
              className={approvalAction?.type === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : approvalAction?.type === "approve" ? "bg-success text-white hover:bg-success/90" : ""}>
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : approvalAction?.type === "approve" ? "Aprovar" : approvalAction?.type === "reject" ? "Rejeitar" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Chat do ticket ── */}
      <Dialog open={!!chatTicket} onOpenChange={(o) => { if (!o) setChatTicket(null); }}>
        <DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{chatTicket?.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {chatTicket && `${(`${chatTicket.profiles?.first_name ?? ""} ${chatTicket.profiles?.last_name ?? ""}`).trim() || chatTicket.profiles?.email} · ${companyMap.get(chatTicket.company_id) ?? "—"}`}
              </p>
            </div>
            {/* Status selector */}
            <div className="flex items-center gap-2 shrink-0">
              <select value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="resolved">Resolvido</option>
              </select>
              <Button size="sm" onClick={handleSaveStatus} disabled={savingStatus} className="h-8 px-3 text-xs">
                {savingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {loadingChatMsgs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (() => {
              const syntheticFirst: SupportMessage = chatTicket ? {
                id: "initial", ticket_id: chatTicket.id, sender_id: chatTicket.user_id,
                sender_role: "user", content: chatTicket.message,
                attachment_url: null, attachment_name: null, created_at: chatTicket.created_at,
              } : null as unknown as SupportMessage;
              const allMsgs = chatTicket ? [syntheticFirst, ...chatMessages] : chatMessages;
              return allMsgs.map((msg) => {
                const isAdmin = msg.sender_role === "admin";
                return (
                  <div key={msg.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                      isAdmin ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                    )}>
                      {!isAdmin && <p className="text-[10px] font-semibold opacity-60 mb-1">Usuário</p>}
                      {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                      {msg.attachment_url && (
                        isImage(msg.attachment_url)
                          ? <img src={msg.attachment_url} alt={msg.attachment_name ?? ""} onClick={() => setLightboxUrl(msg.attachment_url)}
                              className="mt-2 max-w-full rounded-lg cursor-pointer max-h-48 object-cover" />
                          : <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                              className={cn("mt-1 flex items-center gap-1.5 underline text-xs", isAdmin ? "text-primary-foreground/80" : "text-primary")}>
                              <Paperclip className="h-3 w-3" />{msg.attachment_name || "Anexo"}
                            </a>
                      )}
                      <p className={cn("text-xs mt-1 opacity-60", isAdmin ? "text-right" : "text-left")}>{fmtDate(msg.created_at)}</p>
                    </div>
                  </div>
                );
              });
            })()}
            <div ref={msgsEndRef} />
          </div>

          {/* Reply area */}
          <div className="border-t px-4 py-3 space-y-2">
            {adminAttach && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs">
                <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{adminAttach.name}</span>
                <button onClick={() => setAdminAttach(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea value={adminReply} onChange={(e) => setAdminReply(e.target.value)}
                placeholder="Escreva uma resposta..."
                rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdminSend(); } }}
                className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              <div className="flex flex-col gap-1.5">
                <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                  onClick={() => adminAttachRef.current?.click()} title="Anexar arquivo">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button size="icon" className="h-9 w-9" onClick={handleAdminSend}
                  disabled={sendingReply || (!adminReply.trim() && !adminAttach)}>
                  {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <input ref={adminAttachRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => setAdminAttach(e.target.files?.[0] ?? null)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Confirmar exclusão ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ticket?</DialogTitle>
            <DialogDescription>
              Esta ação remove o ticket "<strong>{deleteConfirm?.title}</strong>" e todo o histórico de mensagens. Não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button onClick={handleDeleteTicket} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
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
