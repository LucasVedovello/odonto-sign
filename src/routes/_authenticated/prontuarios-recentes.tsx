import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Download, Loader2 } from "lucide-react";
import { formatBrasilia, fetchProfileNames } from "@/lib/audit";
import {
  downloadProntuarioPdf,
  isProteseProcedimentos,
  prontuarioTipos,
} from "@/lib/prontuario-download";

export const Route = createFileRoute("/_authenticated/prontuarios-recentes")({
  component: ProntuariosRecentesPage,
  head: () => ({ meta: [{ title: "Prontuários Recentes — OdontoSign" }] }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type RangeFilter = "today" | "7days";

type RecentRow = {
  id: string;
  nome: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  patient_id: string | null;
  hasEventos: boolean;
  isProtese: boolean;
};

// Início do dia atual no fuso de Brasília (UTC-03:00, estável no Brasil sem
// horário de verão), como instante UTC para comparar com `updated_at`.
function brasiliaStartOfToday(): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-");
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
}

function rangeStartIso(filter: RangeFilter): string {
  const start = brasiliaStartOfToday();
  if (filter === "7days") start.setDate(start.getDate() - 6); // 7 dias corridos, incluindo hoje
  return start.toISOString();
}

function ProntuariosRecentesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<RangeFilter>("today");
  const [rows, setRows] = useState<RecentRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const startIso = rangeStartIso(filter);
    // Multi-tenant (company_id) + RLS já garantem o escopo da clínica.
    // updated_at >= início do intervalo cobre tanto criação quanto edição
    // (updated_at é atualizado em todo salvamento, incluindo novos eventos).
    const { data, error } = await db
      .from("prontuarios")
      .select(
        "id,nome,status,created_at,updated_at,updated_by,patient_id,prontuario_eventos(count),patients(procedimentos)",
      )
      .eq("company_id", profile.company_id)
      .is("deleted_at", null)
      .gte("updated_at", startIso)
      .order("updated_at", { ascending: false })
      .limit(300);

    if (error) {
      toast.error("Erro ao carregar prontuários recentes");
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: RecentRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      updated_by: r.updated_by,
      patient_id: r.patient_id,
      hasEventos: (r.prontuario_eventos?.[0]?.count ?? 0) > 0,
      isProtese: isProteseProcedimentos(r.patients?.procedimentos),
    }));

    setRows(mapped);
    setNames(await fetchProfileNames(mapped.map((r) => r.updated_by)));
    setLoading(false);
  }, [profile?.company_id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      await downloadProntuarioPdf(id);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar o PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const filterButtons = useMemo(
    () =>
      [
        { key: "today" as const, label: "Hoje" },
        { key: "7days" as const, label: "Últimos 7 dias" },
      ].map(({ key, label }) => (
        <Button
          key={key}
          size="sm"
          variant={filter === key ? "default" : "outline"}
          onClick={() => setFilter(key)}
        >
          {label}
        </Button>
      )),
    [filter],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prontuários Recentes</h1>
        <p className="text-sm text-muted-foreground">
          Prontuários criados ou editados no período selecionado
        </p>
      </div>

      <div className="mb-5 flex gap-2">{filterButtons}</div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Nenhuma atividade no período</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "today"
              ? "Nenhum prontuário criado ou editado hoje."
              : "Nenhum prontuário criado ou editado nos últimos 7 dias."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 card-list">
          {rows.map((r) => {
            const tipos = prontuarioTipos({ hasEventos: r.hasEventos, isProtese: r.isProtese });
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => navigate({ to: "/prontuario", search: { abrir: r.id } })}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium truncate">
                        {r.nome || <span className="italic text-muted-foreground">Sem nome</span>}
                      </p>
                      {tipos.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px]"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Última modificação: {formatBrasilia(r.updated_at)}
                      {" · por "}
                      <span className="font-medium text-foreground/80">
                        {(r.updated_by && names[r.updated_by]) || "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate({ to: "/prontuario", search: { abrir: r.id } })}
                    >
                      Ver detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Baixar PDF"
                      disabled={downloadingId === r.id}
                      onClick={() => handleDownload(r.id)}
                    >
                      {downloadingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
