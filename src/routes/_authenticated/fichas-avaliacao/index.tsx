import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/rbac";
import { AuditFooter } from "@/components/AuditFooter";
import { fetchProfileNames } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Copy, Download, Loader2, Plus, Search, Send, Trash2 } from "lucide-react";
import { STATUS_META, fichaFromRow, publicSignUrl, type FichaStatus } from "@/lib/ficha-avaliacao";

export const Route = createFileRoute("/_authenticated/fichas-avaliacao/")({
  component: FichasListPage,
  head: () => ({ meta: [{ title: "Fichas de Avaliação — OdontoSign" }] }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = {
  id: string;
  paciente_nome: string | null;
  dentista_id: string | null;
  data_avaliacao: string | null;
  status: FichaStatus;
  link_assinatura_token: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

function FichasListPage() {
  const { profile } = useAuth();
  const { isDentist } = useUserRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    let q = db
      .from("avaliacoes")
      .select(
        "id,paciente_nome,dentista_id,data_avaliacao,status,link_assinatura_token,created_at,created_by,updated_at,updated_by",
      )
      .eq("company_id", profile.company_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    // Dentista vê apenas as fichas enviadas para ele; recepção/owner veem todas.
    if (isDentist) q = q.eq("dentista_id", profile.id);

    const { data, error } = await q;
    if (error) {
      toast.error("Erro ao carregar fichas de avaliação");
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(list);
    setLoading(false);
    setNames(
      await fetchProfileNames(list.flatMap((r) => [r.created_by, r.updated_by, r.dentista_id])),
    );
  }, [profile?.company_id, profile?.id, isDentist]);

  useEffect(() => {
    if (!profile) return;
    load();
    const ch = supabase
      .channel("avaliacoes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "avaliacoes" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, profile]);

  const filtered = useMemo(() => {
    const ql = query.trim().toLowerCase();
    if (!ql) return rows;
    return rows.filter((r) => (r.paciente_nome ?? "").toLowerCase().includes(ql));
  }, [rows, query]);

  const copyLink = async (r: Row) => {
    if (!r.link_assinatura_token) return;
    try {
      await navigator.clipboard.writeText(publicSignUrl(r.id, r.link_assinatura_token));
      toast.success("Link de assinatura copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const gerarPdf = async (id: string) => {
    try {
      const { data } = await db.from("avaliacoes").select("*").eq("id", id).single();
      if (!data) return;
      let cidade: string | null = null;
      if (data.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("cidade")
          .eq("id", data.company_id)
          .maybeSingle();
        cidade = comp?.cidade ?? null;
      }
      const { downloadFichaAvaliacaoPdf } = await import("@/lib/ficha-avaliacao-pdf");
      await downloadFichaAvaliacaoPdf({ ...fichaFromRow(data), ...data }, { cidade });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o PDF");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await db
      .from("avaliacoes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error("Falha ao excluir a ficha");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    toast.success("Ficha movida para a lixeira");
    setDeleteTarget(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fichas de Avaliação</h1>
          <p className="text-sm text-muted-foreground">
            Primeira etapa do atendimento — preencha, envie ao dentista e colete as assinaturas.
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => navigate({ to: "/fichas-avaliacao/nova" })}
        >
          <Plus className="h-4 w-4" /> Nova ficha
        </Button>
      </div>

      <div className="relative mb-4 w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por paciente..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {rows.length === 0 ? "Nenhuma ficha de avaliação ainda" : "Nenhum resultado"}
          </p>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? 'Clique em "Nova ficha" para começar.'
              : "Tente outro termo de busca."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 card-list">
          {filtered.map((r) => {
            const st = STATUS_META[r.status] ?? STATUS_META.rascunho;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => navigate({ to: "/fichas-avaliacao/$id", params: { id: r.id } })}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">
                        {r.paciente_nome || (
                          <span className="italic text-muted-foreground">Sem nome</span>
                        )}
                      </p>
                      <Badge variant="outline" className={st.cls}>
                        {st.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.data_avaliacao && new Date(r.data_avaliacao).toLocaleDateString("pt-BR")}
                      {r.dentista_id && ` · Dentista: ${names[r.dentista_id] ?? "—"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate({ to: "/fichas-avaliacao/$id", params: { id: r.id } })
                      }
                    >
                      Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Gerar PDF"
                      onClick={() => gerarPdf(r.id)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {r.status === "aguardando_assinatura_paciente" && r.link_assinatura_token && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-primary"
                        title="Copiar link de assinatura"
                        onClick={() => copyLink(r)}
                      >
                        <Send className="h-3.5 w-3.5" /> Link
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <AuditFooter
                  createdByName={r.created_by ? names[r.created_by] : null}
                  createdAt={r.created_at}
                  updatedByName={r.updated_by ? names[r.updated_by] : null}
                  updatedAt={r.updated_at}
                />
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ficha de avaliação?</DialogTitle>
            <DialogDescription>
              A ficha {deleteTarget?.paciente_nome ? `de ${deleteTarget.paciente_nome}` : ""} será
              movida para a lixeira e poderá ser restaurada em até 30 dias.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
