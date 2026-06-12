import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, Loader2, User, ClipboardList, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { roleGuard, useUserRole } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/lixeira")({
  beforeLoad: roleGuard(["clinic_owner", "platform_admin"]),
  component: TrashPage,
  head: () => ({ meta: [{ title: "Lixeira — OdontoClinic" }] }),
});

type TrashTable = "patients" | "prontuarios" | "appointments";

type TrashItem = {
  id: string;
  label: string;
  sublabel: string;
  deleted_at: string;
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function TrashPage() {
  const { isPlatformAdmin } = useUserRole();
  const qc = useQueryClient();
  const [hardDelete, setHardDelete] = useState<{ table: TrashTable; item: TrashItem } | null>(null);

  const useTrashQuery = (table: TrashTable) =>
    useQuery({
      queryKey: ["trash", table],
      queryFn: async (): Promise<TrashItem[]> => {
        if (table === "patients") {
          const { data } = await supabase
            .from("patients")
            .select("id,nome,prontuario,deleted_at")
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false });
          return (data ?? []).map((p) => ({
            id: p.id,
            label: p.nome ?? "Sem nome",
            sublabel: p.prontuario ?? "—",
            deleted_at: p.deleted_at!,
          }));
        }
        if (table === "prontuarios") {
          const { data } = await supabase
            .from("prontuarios")
            .select("id,nome,num_prontuario,deleted_at")
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false });
          return (data ?? []).map((p) => ({
            id: p.id,
            label: p.nome ?? "Sem nome",
            sublabel: p.num_prontuario ?? "—",
            deleted_at: p.deleted_at!,
          }));
        }
        const { data } = await supabase
          .from("appointments")
          .select("id,scheduled_at,deleted_at,patients(nome)")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false });
        return (data ?? []).map((a) => ({
          id: a.id,
          label: (a.patients as { nome: string | null } | null)?.nome ?? "Paciente removido",
          sublabel: `Agendada para ${fmtDate(a.scheduled_at)}`,
          deleted_at: a.deleted_at!,
        }));
      },
    });

  const patients = useTrashQuery("patients");
  const prontuarios = useTrashQuery("prontuarios");
  const appointments = useTrashQuery("appointments");

  const refresh = (table: TrashTable) => qc.invalidateQueries({ queryKey: ["trash", table] });

  const restore = async (table: TrashTable, item: TrashItem) => {
    const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", item.id);
    if (error) toast.error("Erro ao restaurar");
    else {
      toast.success(`"${item.label}" restaurado`);
      refresh(table);
    }
  };

  const confirmHardDelete = async () => {
    if (!hardDelete) return;
    const { table, item } = hardDelete;
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) toast.error("Erro ao excluir permanentemente");
    else {
      toast.success("Excluído permanentemente");
      refresh(table);
    }
    setHardDelete(null);
  };

  const renderList = (
    table: TrashTable,
    query: ReturnType<typeof useTrashQuery>,
    icon: React.ReactNode,
  ) => {
    if (query.isLoading)
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      );
    const items = query.data ?? [];
    if (items.length === 0)
      return <Card className="p-10 text-center text-sm text-muted-foreground">Lixeira vazia.</Card>;
    return (
      <div className="grid gap-2">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {icon}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.sublabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                excluído em {fmtDate(item.deleted_at)}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => restore(table, item)}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar
              </Button>
              {isPlatformAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHardDelete({ table, item })}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Trash2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Lixeira</h1>
          <p className="text-sm text-muted-foreground">
            Registros excluídos podem ser restaurados a qualquer momento
            {isPlatformAdmin ? " ou removidos permanentemente" : ""}.
          </p>
        </div>
      </div>

      <Tabs defaultValue="patients">
        <TabsList>
          <TabsTrigger value="patients">Pacientes ({patients.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="prontuarios">
            Prontuários ({prontuarios.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="appointments">
            Consultas ({appointments.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="mt-4">
          {renderList("patients", patients, <User className="h-4 w-4" />)}
        </TabsContent>
        <TabsContent value="prontuarios" className="mt-4">
          {renderList("prontuarios", prontuarios, <ClipboardList className="h-4 w-4" />)}
        </TabsContent>
        <TabsContent value="appointments" className="mt-4">
          {renderList("appointments", appointments, <CalendarClock className="h-4 w-4" />)}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!hardDelete} onOpenChange={(o) => !o && setHardDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              "{hardDelete?.item.label}" será removido definitivamente. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmHardDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
