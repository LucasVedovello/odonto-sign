import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Plus,
  Loader2,
  Play,
  CheckCheck,
  XCircle,
  CalendarSync,
  Timer,
  Search,
  Download,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/rbac";
import { exportTablePdf, exportTableExcel, type ExportColumn } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/consultas")({
  component: AppointmentsPage,
  head: () => ({ meta: [{ title: "Consultas — OdontoClinic" }] }),
});

type Appointment = {
  id: string;
  patient_id: string;
  dentist_id: string;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_minutes: number | null;
  status: "scheduled" | "in_progress" | "finished" | "cancelled" | "rescheduled";
  notes: string | null;
  patients: { nome: string | null; prontuario: string | null } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

const STATUS_LABEL: Record<Appointment["status"], string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  finished: "Finalizada",
  cancelled: "Cancelada",
  rescheduled: "Remarcada",
};
const STATUS_BADGE: Record<Appointment["status"], string> = {
  scheduled: "bg-primary/15 text-primary border-primary/30",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  finished: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  rescheduled: "bg-muted text-muted-foreground",
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const dentistName = (a: Appointment) =>
  `${a.profiles?.first_name ?? ""} ${a.profiles?.last_name ?? ""}`.trim() || "—";

function AppointmentsPage() {
  const { profile } = useAuth();
  const { isClinicOwner, isPlatformAdmin } = useUserRole();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | Appointment["status"]>("all");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patient_id: "", dentist_id: "", scheduled_at: "", notes: "" });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id,patient_id,dentist_id,scheduled_at,started_at,finished_at,duration_minutes,status,notes,patients(nome,prontuario),profiles!appointments_dentist_id_fkey(first_name,last_name)",
        )
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Appointment[];
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-select", profile?.company_id],
    enabled: !!profile?.company_id && createOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,nome,prontuario")
        .is("deleted_at", null)
        .not("nome", "is", null)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: dentists = [] } = useQuery({
    queryKey: ["dentists-select", profile?.company_id],
    enabled: !!profile?.company_id && createOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,role")
        .eq("company_id", profile!.company_id)
        .is("deleted_at", null)
        .eq("status", "active")
        .in("role", ["dentist", "clinic_owner"]);
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["appointments"] });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!ql) return true;
      return (
        (a.patients?.nome ?? "").toLowerCase().includes(ql) ||
        dentistName(a).toLowerCase().includes(ql) ||
        (a.notes ?? "").toLowerCase().includes(ql)
      );
    });
  }, [appointments, statusFilter, q]);

  const handleCreate = async () => {
    if (!form.patient_id || !form.dentist_id || !form.scheduled_at) {
      toast.error("Preencha paciente, dentista e data/hora");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      company_id: profile!.company_id,
      patient_id: form.patient_id,
      dentist_id: form.dentist_id,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      notes: form.notes || null,
      created_by: profile!.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar consulta");
      return;
    }
    toast.success("Consulta agendada");
    setCreateOpen(false);
    setForm({ patient_id: "", dentist_id: "", scheduled_at: "", notes: "" });
    refresh();
  };

  const updateStatus = async (a: Appointment, patch: TablesUpdate<"appointments">, msg: string) => {
    const { error } = await supabase.from("appointments").update(patch).eq("id", a.id);
    if (error) toast.error("Erro ao atualizar consulta");
    else {
      toast.success(msg);
      refresh();
    }
  };

  const handleStart = (a: Appointment) =>
    updateStatus(
      a,
      { started_at: new Date().toISOString(), status: "in_progress" },
      "Consulta iniciada",
    );

  // finished_at dispara o trigger que calcula duration_minutes
  const handleFinish = (a: Appointment) =>
    updateStatus(a, { finished_at: new Date().toISOString() }, "Consulta finalizada");

  const handleCancel = (a: Appointment) =>
    updateStatus(a, { status: "cancelled" }, "Consulta cancelada");

  const handleReschedule = async () => {
    if (!reschedule || !rescheduleAt) return;
    setSaving(true);
    await updateStatus(
      reschedule,
      {
        scheduled_at: new Date(rescheduleAt).toISOString(),
        status: "scheduled",
        started_at: null,
        finished_at: null,
        duration_minutes: null,
      },
      "Consulta remarcada",
    );
    setSaving(false);
    setReschedule(null);
    setRescheduleAt("");
  };

  const handleSoftDelete = (a: Appointment) =>
    updateStatus(a, { deleted_at: new Date().toISOString() }, "Consulta movida para a lixeira");

  const exportColumns: ExportColumn<Appointment>[] = [
    { header: "Paciente", value: (a) => a.patients?.nome ?? "—" },
    { header: "Dentista", value: (a) => dentistName(a) },
    { header: "Agendada para", value: (a) => fmtDateTime(a.scheduled_at) },
    { header: "Status", value: (a) => STATUS_LABEL[a.status] },
    { header: "Início", value: (a) => (a.started_at ? fmtDateTime(a.started_at) : "") },
    { header: "Fim", value: (a) => (a.finished_at ? fmtDateTime(a.finished_at) : "") },
    { header: "Duração (min)", value: (a) => a.duration_minutes ?? "" },
    { header: "Observações", value: (a) => a.notes ?? "" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Consultas</h1>
            <p className="text-sm text-muted-foreground">
              Agenda e tempo de atendimento da clínica.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              exportTablePdf({
                title: "Consultas",
                columns: exportColumns,
                rows: filtered,
                fileName: "consultas",
              })
            }
          >
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              exportTableExcel({
                sheetName: "Consultas",
                columns: exportColumns,
                rows: filtered,
                fileName: "consultas",
              })
            }
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova consulta
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar paciente ou dentista..."
            className="pl-9"
          />
        </div>
        {(["all", "scheduled", "in_progress", "finished", "cancelled"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "Todas" : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma consulta encontrada. Clique em “Nova consulta” para agendar.
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">
                      {a.patients?.nome ?? "Paciente removido"}
                    </p>
                    <Badge variant="outline" className={STATUS_BADGE[a.status]}>
                      {STATUS_LABEL[a.status]}
                    </Badge>
                    {a.duration_minutes != null && (
                      <Badge variant="outline" className="gap-1">
                        <Timer className="h-3 w-3" />
                        {a.duration_minutes} min
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDateTime(a.scheduled_at)} · Dr(a). {dentistName(a)}
                    {a.patients?.prontuario && (
                      <span className="ml-2 font-mono">{a.patients.prontuario}</span>
                    )}
                  </p>
                  {a.notes && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">{a.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.status === "scheduled" && (
                    <Button size="sm" onClick={() => handleStart(a)} className="gap-1.5">
                      <Play className="h-3.5 w-3.5" /> Iniciar
                    </Button>
                  )}
                  {a.status === "in_progress" && (
                    <Button
                      size="sm"
                      onClick={() => handleFinish(a)}
                      className="gap-1.5 bg-success text-white hover:bg-success/90"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Finalizar
                    </Button>
                  )}
                  {(a.status === "scheduled" || a.status === "in_progress") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          ⋯
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setReschedule(a);
                            setRescheduleAt("");
                          }}
                        >
                          <CalendarSync className="mr-2 h-4 w-4" /> Remarcar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleCancel(a)}
                          className="text-destructive focus:text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" /> Cancelar
                        </DropdownMenuItem>
                        {(isClinicOwner || isPlatformAdmin) && (
                          <DropdownMenuItem
                            onClick={() => handleSoftDelete(a)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {(a.status === "cancelled" || a.status === "finished") &&
                    (isClinicOwner || isPlatformAdmin) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSoftDelete(a)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: nova consulta */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova consulta</DialogTitle>
            <DialogDescription>Agende um atendimento para um paciente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Paciente *</Label>
              <Select
                value={form.patient_id}
                onValueChange={(v) => setForm((f) => ({ ...f, patient_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.prontuario ? ` — ${p.prontuario}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Dentista *</Label>
              <Select
                value={form.dentist_id}
                onValueChange={(v) => setForm((f) => ({ ...f, dentist_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dentista" />
                </SelectTrigger>
                <SelectContent>
                  {dentists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {`${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Data e hora *</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Procedimento, retorno, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: remarcar */}
      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remarcar consulta</DialogTitle>
            <DialogDescription>
              {reschedule?.patients?.nome} — atualmente{" "}
              {reschedule && fmtDateTime(reschedule.scheduled_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label>Nova data e hora *</Label>
            <Input
              type="datetime-local"
              value={rescheduleAt}
              onChange={(e) => setRescheduleAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReschedule} disabled={saving || !rescheduleAt}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remarcar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
