import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Users,
  CalendarClock,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  Stethoscope,
  Timer,
  UserPlus,
  Loader2,
  BarChart3,
  Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { roleGuard } from "@/lib/rbac";
import { exportDashboardPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: roleGuard(["clinic_owner"]),
  component: ClinicDashboard,
  head: () => ({ meta: [{ title: "Dashboard da Clínica — OdontoClinic" }] }),
});

type Period = "today" | "week" | "month" | "custom";

type Stats = {
  total_patients: number;
  new_patients_month: number;
  new_patients_period: number;
  total_appointments: number;
  appointments_period: number;
  appointments_month: number;
  appointments_today: number;
  total_records: number;
  records_period: number;
  active_dentists: number;
  active_users: number;
  avg_duration: number | null;
};

function periodRange(
  period: Period,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getTime() + 24 * 3600 * 1000);
  if (period === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (period === "week") return { from: new Date(now.getTime() - 7 * 24 * 3600 * 1000), to };
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }
  return {
    from: customFrom
      ? new Date(customFrom + "T00:00:00")
      : new Date(now.getFullYear(), now.getMonth(), 1),
    to: customTo ? new Date(customTo + "T23:59:59") : to,
  };
}

const PERIOD_LABEL: Record<Period, string> = {
  today: "Hoje",
  week: "7 dias",
  month: "Este mês",
  custom: "Personalizado",
};

const fmtMonth = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(
    new Date(iso + "T12:00:00"),
  );
const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
    new Date(iso + "T12:00:00"),
  );

function ClinicDashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");

  const { from, to } = useMemo(
    () => periodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["clinic-stats", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("clinic_dashboard_stats", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  const { data: series = [] } = useQuery({
    queryKey: ["clinic-series", granularity, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      // gráfico mostra uma janela maior que o filtro para dar contexto
      const seriesFrom =
        granularity === "month"
          ? new Date(Date.now() - 365 * 24 * 3600 * 1000)
          : granularity === "week"
            ? new Date(Date.now() - 90 * 24 * 3600 * 1000)
            : new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const { data, error } = await supabase.rpc("clinic_appointments_series", {
        p_granularity: granularity,
        p_from: seriesFrom.toISOString(),
        p_to: new Date().toISOString(),
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: patientsSeries = [] } = useQuery({
    queryKey: ["clinic-patients-series"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("clinic_patients_series", { p_months: 12 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dentists = [] } = useQuery({
    queryKey: ["clinic-dentists", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("clinic_dentist_performance", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, dentist_name: d.dentist_name ?? "Sem nome" }));
    },
  });

  const appointmentsChart = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        label: granularity === "month" ? fmtMonth(s.bucket) : fmtDay(s.bucket),
      })),
    [series, granularity],
  );
  const patientsChart = useMemo(
    () => patientsSeries.map((p) => ({ ...p, label: fmtMonth(p.month) })),
    [patientsSeries],
  );

  const handleExport = () => {
    if (!stats) return;
    exportDashboardPdf({
      title: "Dashboard da Clínica",
      period: `${from.toLocaleDateString("pt-BR")} a ${to.toLocaleDateString("pt-BR")}`,
      cards: [
        ["Total de pacientes", String(stats.total_patients)],
        ["Total de consultas", String(stats.total_appointments)],
        ["Consultas do mês", String(stats.appointments_month)],
        ["Consultas do dia", String(stats.appointments_today)],
        ["Prontuários criados", String(stats.total_records)],
        ["Dentistas ativos", String(stats.active_dentists)],
        [
          "Tempo médio de atendimento",
          stats.avg_duration != null ? `${stats.avg_duration} min` : "—",
        ],
        ["Novos pacientes do mês", String(stats.new_patients_month)],
      ],
      tables: [
        {
          title: "Desempenho por dentista",
          head: ["Dentista", "Consultas", "Finalizadas", "Tempo médio (min)"],
          body: dentists.map((d) => [
            d.dentist_name ?? "—",
            String(d.total_appointments),
            String(d.finished_appointments),
            d.avg_duration != null ? String(d.avg_duration) : "—",
          ]),
        },
      ],
      fileName: "dashboard-clinica",
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dashboard da Clínica</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral de pacientes, consultas e equipe.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
      </div>

      {/* Filtro de período */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABEL[p]}
          </Button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 w-auto"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 w-auto"
            />
          </div>
        )}
      </div>

      {loadingStats || !stats ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Cards */}
          <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Total de pacientes"
              value={stats.total_patients}
            />
            <StatCard
              icon={<CalendarClock className="h-5 w-5" />}
              label="Total de consultas"
              value={stats.total_appointments}
            />
            <StatCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Consultas do mês"
              value={stats.appointments_month}
            />
            <StatCard
              icon={<CalendarCheck className="h-5 w-5" />}
              label="Consultas hoje"
              value={stats.appointments_today}
            />
            <StatCard
              icon={<ClipboardList className="h-5 w-5" />}
              label="Prontuários criados"
              value={stats.total_records}
            />
            <StatCard
              icon={<Stethoscope className="h-5 w-5" />}
              label="Dentistas ativos"
              value={stats.active_dentists}
            />
            <StatCard
              icon={<Timer className="h-5 w-5" />}
              label="Tempo médio"
              value={stats.avg_duration != null ? `${stats.avg_duration} min` : "—"}
            />
            <StatCard
              icon={<UserPlus className="h-5 w-5" />}
              label="Novos pacientes (mês)"
              value={stats.new_patients_month}
            />
          </div>

          {/* Consultas por período */}
          <Card className="mb-4 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Consultas</h2>
              <div className="flex gap-1">
                {(["day", "week", "month"] as const).map((g) => (
                  <Button
                    key={g}
                    size="sm"
                    variant={granularity === g ? "default" : "ghost"}
                    onClick={() => setGranularity(g)}
                    className="h-7 px-2.5 text-xs"
                  >
                    {{ day: "Dia", week: "Semana", month: "Mês" }[g]}
                  </Button>
                ))}
              </div>
            </div>
            {appointmentsChart.length === 0 ? (
              <EmptyChart label="Nenhuma consulta registrada no período." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={appointmentsChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={32} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Agendadas"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                  />
                  <Area
                    type="monotone"
                    dataKey="finished"
                    name="Finalizadas"
                    stroke="hsl(var(--success, 142 71% 45%))"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            {/* Novos pacientes por mês */}
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Novos pacientes por mês</h2>
              {patientsChart.length === 0 ? (
                <EmptyChart label="Sem cadastros ainda." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={patientsChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={32} />
                    <Tooltip />
                    <Bar
                      dataKey="new_patients"
                      name="Novos pacientes"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Evolução acumulada */}
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Evolução de cadastros (acumulado)</h2>
              {patientsChart.length === 0 ? (
                <EmptyChart label="Sem cadastros ainda." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={patientsChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={32} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name="Pacientes"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Atendimentos por dentista */}
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Atendimentos por dentista</h2>
              {dentists.length === 0 ? (
                <EmptyChart label="Nenhum dentista cadastrado." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, dentists.length * 44)}>
                  <BarChart data={dentists} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" fontSize={12} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="dentist_name"
                      fontSize={11}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="finished_appointments"
                      name="Finalizadas"
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Tempo médio por dentista */}
            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Tempo médio por dentista (min)</h2>
              {dentists.filter((d) => d.avg_duration != null).length === 0 ? (
                <EmptyChart label="Nenhuma consulta finalizada ainda." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, dentists.length * 44)}>
                  <BarChart data={dentists.filter((d) => d.avg_duration != null)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" fontSize={12} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="dentist_name"
                      fontSize={11}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="avg_duration"
                      name="Minutos"
                      fill="hsl(var(--chart-2, 173 58% 39%))"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
