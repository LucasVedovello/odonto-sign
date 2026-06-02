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
import { Loader2, Headset, ImagePlus, X, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/suporte")({
  component: SupportPage,
  head: () => ({ meta: [{ title: "Suporte — OdontoClinic" }] }),
});

type Ticket = {
  id: string; title: string; message: string; images: string[];
  status: string; created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  open:        { label: "Aberto",       cls: "bg-primary/15 text-primary border-primary/30" },
  in_progress: { label: "Em andamento", cls: "bg-warning/15 text-warning border-warning/30" },
  resolved:    { label: "Resolvido",    cls: "bg-success/15 text-success border-success/30" },
  closed:      { label: "Fechado",      cls: "bg-muted text-muted-foreground" },
};

const MAX_IMAGES = 5;
const MAX_FILE_MB = 5;

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function SupportPage() {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTickets = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("id,title,message,images,status,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoadingTickets(false);
  }, [profile]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter((f) => {
      if (!f.type.match(/image\/(jpeg|png|webp)/)) { toast.error(`${f.name}: formato não suportado`); return false; }
      if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(`${f.name}: máximo ${MAX_FILE_MB}MB`); return false; }
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
      // Upload images — sanitize filename before sending to Storage
      const imagePaths: string[] = [];
      for (const file of files) {
        const safeName = sanitizeFilename(file.name);
        const path = `${profile.id}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from("support-images").upload(path, file);
        if (error) throw error;
        imagePaths.push(path);
      }

      // Insert ticket
      const { data: ticket, error: insertError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: profile.id,
          company_id: profile.company_id,
          title: title.trim(),
          message: message.trim(),
          images: imagePaths,
        })
        .select("id")
        .single();

      if (insertError || !ticket) throw insertError ?? new Error("Erro ao criar ticket");

      // Notify (silent failure)
      try {
        const { data: company } = await supabase
          .from("companies")
          .select("company_name")
          .eq("id", profile.company_id)
          .maybeSingle();

        await supabase.functions.invoke("notify-support-ticket", {
          body: {
            ticketId: ticket.id,
            userId: profile.id,
            userName: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
            userEmail: profile.email,
            companyName: company?.company_name ?? "",
            title: title.trim(),
            message: message.trim(),
            createdAt: new Date().toISOString(),
          },
        });
      } catch { /* silent */ }

      toast.success("Solicitação enviada com sucesso!");
      setTitle(""); setMessage(""); setFiles([]); setPreviews([]);
      loadTickets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const openImage = async (path: string) => {
    const { data } = await supabase.storage.from("support-images").createSignedUrl(path, 3600);
    if (data?.signedUrl) setLightboxUrl(data.signedUrl);
  };

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

      {/* Form */}
      <Card className="mb-8 p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sup-title">Título *</Label>
            <Input id="sup-title" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo do problema" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sup-msg">Descrição * <span className="text-muted-foreground font-normal">(mín. 20 caracteres)</span></Label>
            <textarea
              id="sup-msg" required minLength={20} value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva o problema com detalhes..."
              rows={5}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            />
          </div>

          {/* Image upload */}
          <div className="grid gap-2">
            <Label>Imagens <span className="text-muted-foreground font-normal">(opcional, máx. {MAX_IMAGES})</span></Label>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border border-border">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removeFile(i)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-background">
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
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}
                  className="w-fit gap-2">
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

      {/* Ticket history */}
      <h2 className="mb-3 text-lg font-semibold">Minhas solicitações</h2>
      {loadingTickets ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : tickets.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação enviada.</Card>
      ) : (
        <div className="grid gap-3 card-list">
          {tickets.map((t) => {
            const st = STATUS_LABELS[t.status] ?? STATUS_LABELS.open;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("pt-BR")}
                    </p>
                    {t.images?.length > 0 && (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {t.images.map((path, i) => (
                          <button key={i} type="button" onClick={() => openImage(path)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> Imagem {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxUrl && <img src={lightboxUrl} alt="Imagem do ticket" className="w-full rounded-lg object-contain max-h-[80vh]" />}
        </DialogContent>
      </Dialog>
    </main>
  );
}
