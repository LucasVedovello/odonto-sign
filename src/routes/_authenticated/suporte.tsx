import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Headset, ImagePlus, X, ArrowLeft, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte")({
  component: SupportPage,
  head: () => ({ meta: [{ title: "Suporte — OdontoSign" }] }),
});

// support_tickets and support_messages are not in the generated types yet —
// cast to any until types are regenerated after migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Ticket = {
  id: string; title: string; message: string; images: string[];
  status: string; created_at: string; user_id: string;
};
type SupportMessage = {
  id: string; ticket_id: string; sender_id: string;
  sender_role: "user" | "admin";
  content: string | null; attachment_url: string | null; attachment_name: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  open:        { label: "Aberto",       cls: "bg-warning/15 text-warning border-warning/30" },
  in_progress: { label: "Em andamento", cls: "bg-primary/15 text-primary border-primary/30" },
  resolved:    { label: "Resolvido",    cls: "bg-success/15 text-success border-success/30" },
};

const MAX_IMAGES = 5;
const MAX_FILE_MB = 5;

function sanitize(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}
const isImage = (url: string | null) => !!url && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function SupportPage() {
  const { profile } = useAuth();

  // Form state (new ticket)
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List / chat state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const msgsEndRef = useRef<HTMLDivElement>(null);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!profile) return;
    const { data } = await db
      .from("support_tickets")
      .select("id,title,message,images,status,created_at,user_id")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoadingTickets(false);
  }, [profile]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const loadMessages = useCallback(async (ticketId: string) => {
    setLoadingMsgs(true);
    const { data } = await db
      .from("support_messages")
      .select("id,ticket_id,sender_id,sender_role,content,attachment_url,attachment_name,created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as SupportMessage[]);
    setLoadingMsgs(false);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const openTicket = (t: Ticket) => {
    setActiveTicket(t);
    setReply("");
    setAttachFile(null);
    loadMessages(t.id);
  };

  // ── New ticket form ───────────────────────────────────────
  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter((f) => {
      if (!f.type.match(/image\/(jpeg|png|webp)/)) { toast.error(`${f.name}: formato não suportado`); return false; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`${f.name}: máx ${MAX_FILE_MB}MB`); return false; }
      return true;
    });
    const next = [...files, ...allowed].slice(0, MAX_IMAGES);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (message.trim().length < 20) { toast.error("Descrição deve ter pelo menos 20 caracteres"); return; }
    setSubmitting(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Sessão expirada.");
      const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      if (!prof?.company_id) throw new Error("Empresa não encontrada.");

      const imagePaths: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${Date.now()}_${sanitize(file.name)}`;
        const { error } = await supabase.storage.from("support-images").upload(path, file);
        if (error) throw error;
        imagePaths.push(path);
      }
      const { data: ticket, error: insertErr } = await db
        .from("support_tickets")
        .insert({ user_id: user.id, company_id: prof.company_id, title: title.trim(), message: message.trim(), images: imagePaths })
        .select("id").single();
      if (insertErr || !ticket) throw insertErr ?? new Error("Erro ao criar ticket");

      try {
        const { data: company } = await supabase.from("companies").select("company_name").eq("id", prof.company_id).maybeSingle();
        await supabase.functions.invoke("notify-support-ticket", {
          body: { ticketId: ticket.id, userId: user.id, userName: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(), userEmail: profile.email, companyName: company?.company_name ?? "", title: title.trim(), message: message.trim(), createdAt: new Date().toISOString() },
        });
      } catch { /* silent */ }

      toast.success("Solicitação enviada!");
      setTitle(""); setMessage(""); setFiles([]); setPreviews([]);
      await loadTickets();
      const fresh = (await db.from("support_tickets").select("id,title,message,images,status,created_at,user_id").eq("id", ticket.id).single()).data as Ticket | null;
      if (fresh) openTicket(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Chat reply ────────────────────────────────────────────
  const handleSendReply = async () => {
    if (!activeTicket || (!reply.trim() && !attachFile)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSendingReply(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (attachFile) {
        const path = `${activeTicket.id}/${Date.now()}_${sanitize(attachFile.name)}`;
        const { error: upErr } = await supabase.storage.from("support-attachments").upload(path, attachFile);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("support-attachments").getPublicUrl(path);
          attachmentUrl = publicUrl;
          attachmentName = attachFile.name;
        }
        setAttachFile(null);
      }
      const { error } = await db.from("support_messages").insert({
        ticket_id: activeTicket.id, sender_id: user.id, sender_role: "user",
        content: reply.trim() || null, attachment_url: attachmentUrl, attachment_name: attachmentName,
      });
      if (error) throw error;
      setReply("");
      await loadMessages(activeTicket.id);
    } catch (err) {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSendingReply(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (activeTicket) {
    const st = STATUS[activeTicket.status] ?? STATUS.open;
    const isResolved = activeTicket.status === "resolved";
    const syntheticFirst: SupportMessage = {
      id: "initial", ticket_id: activeTicket.id, sender_id: activeTicket.user_id,
      sender_role: "user", content: activeTicket.message,
      attachment_url: null, attachment_name: null, created_at: activeTicket.created_at,
    };
    const allMessages = [syntheticFirst, ...messages];

    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setActiveTicket(null)} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{activeTicket.title}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(activeTicket.created_at)}</p>
          </div>
          <Badge variant="outline" className={st.cls}>{st.label}</Badge>
        </div>

        {/* Chat area */}
        <Card className="flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : allMessages.map((msg) => {
              const isMe = msg.sender_role === "user";
              return (
                <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                    isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                  )}>
                    {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                    {msg.attachment_url && (
                      isImage(msg.attachment_url)
                        ? <img src={msg.attachment_url} alt={msg.attachment_name ?? ""} onClick={() => setLightboxUrl(msg.attachment_url)}
                            className="mt-2 max-w-full rounded-lg cursor-pointer max-h-48 object-cover" />
                        : <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                            className={cn("mt-1 flex items-center gap-1.5 underline text-xs", isMe ? "text-primary-foreground/80" : "text-primary")}>
                            <Paperclip className="h-3 w-3" />{msg.attachment_name || "Anexo"}
                          </a>
                    )}
                    <p className={cn("text-xs mt-1 opacity-60", isMe ? "text-right" : "text-left")}>{fmtDate(msg.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={msgsEndRef} />
          </div>

          {/* Reply area */}
          {isResolved ? (
            <div className="border-t px-4 py-3 text-center text-sm text-muted-foreground bg-muted/30">
              Este ticket foi resolvido. Abra um novo ticket se precisar de mais ajuda.
            </div>
          ) : (
            <div className="border-t px-4 py-3 space-y-2">
              {attachFile && (
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs">
                  <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{attachFile.name}</span>
                  <button onClick={() => setAttachFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  rows={2}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9"
                    onClick={() => attachRef.current?.click()} title="Anexar arquivo">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button size="icon" className="h-9 w-9" onClick={handleSendReply}
                    disabled={sendingReply || (!reply.trim() && !attachFile)}>
                    {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <input ref={attachRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)} />
            </div>
          )}
        </Card>

        <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
          <DialogContent className="max-w-3xl p-2">
            {lightboxUrl && <img src={lightboxUrl} alt="" className="w-full rounded-lg object-contain max-h-[80vh]" />}
          </DialogContent>
        </Dialog>
      </main>
    );
  }

  // ── Ticket list + new form ────────────────────────────────
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Headset className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Contato com Suporte</h1>
          <p className="text-sm text-muted-foreground">Envie sua dúvida ou relato e nossa equipe responderá.</p>
        </div>
      </div>

      {/* New ticket form */}
      <Card className="mb-8 p-5 sm:p-6">
        <p className="mb-4 font-semibold">Novo ticket</p>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sup-title">Título *</Label>
            <Input id="sup-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo do problema" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sup-msg">Descrição * <span className="text-muted-foreground font-normal">(mín. 20 caracteres)</span></Label>
            <textarea id="sup-msg" required minLength={20} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva o problema com detalhes..." rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
          </div>
          <div className="grid gap-2">
            <Label>Imagens <span className="text-muted-foreground font-normal">(opcional, máx. {MAX_IMAGES})</span></Label>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border border-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeFile(i)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 hover:bg-background">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {files.length < MAX_IMAGES && (
              <>
                <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-fit gap-2">
                  <ImagePlus className="h-4 w-4" /> Adicionar imagens
                </Button>
              </>
            )}
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar solicitação"}
          </Button>
        </form>
      </Card>

      {/* Ticket list */}
      <h2 className="mb-3 text-lg font-semibold">Minhas solicitações</h2>
      {loadingTickets ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tickets.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação enviada.</Card>
      ) : (
        <div className="grid gap-2 card-list">
          {tickets.map((t) => {
            const st = STATUS[t.status] ?? STATUS.open;
            return (
              <Card key={t.id} className="cursor-pointer p-4 lift-on-hover" onClick={() => openTicket(t)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtDate(t.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={cn(st.cls, "shrink-0")}>{st.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
