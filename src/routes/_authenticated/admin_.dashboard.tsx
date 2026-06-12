import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Building2,
  Users,
  Stethoscope,
  ClipboardList,
  CalendarClock,
  Loader2,
  BarChart3,
  AlertTriangle,
  Timer,
  Download,
  ScrollText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { roleGuard } from "@/lib/rbac";
import { exportDashboardPdf } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin_/dashboard")({
  beforeLoad: roleGuard(["platform_admin"]),
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Dashboard Admin — OdontoClinic" }] }),
});

type PlatformStats = {
  total_companies: number;
  approved_companies: number;
  pending_companies: number;
  active_companies: number;
  total_users: number;
  total_dentists: number;
  total_patients: number;
  total_appointments: number;
  total_records: number;
  avg_duration: number | null;
  avg_appointments_per_company: number | null;
  avg_patients_per_company: number | null;
  unread_alerts: number;
};

const fmtMonth = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(
    new Date(iso + "T12:00:00"),
  );
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_dashboard_stats");
      if (error) throw error;
      return data as unknown as PlatformStats;
    },
  });

  const { data: growth = [] } = useQuery({
    queryKey: ["platform-growth"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_growth_series", { p_months: 12 });
      if (error) throw error;
      return (data ?? []).map((g) => ({ ...g, label: fmtMonth(g.month) }));
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["platform-activity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_company_activity");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: topUsers = [] } = useQuery({
    queryKey: ["platform-top-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_top_users", { p_days: 30, p_limit: 10 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const inactive = useMemo(
    () => activity.filter((a) => a.inactive && a.approval_status === "approved"),
    [activity],
  );
  const ranking = useMemo(
    () => [...activity].sort((a, b) => Number(b.appointments) - Number(a.appointments)).slice(0, 8),
    [activity],
  );

  const handleExport = () => {
    if (!stats) return;
    exportDashboardPdf({
      title: "Dashboard Administrativo — Plataforma",
      cards: [
        ["Clínicas cadastradas", String(stats.total_companies)],
        ["Clínicas aprovadas", String(stats.approved_companies)],
        ["Clínicas ativas (30d)", String(stats.active_companies)],
        ["Usuários", String(stats.total_users)],
        ["Dentistas", String(stats.total_dentists)],
        ["Pacientes", String(stats.total_patients)],
        ["Consultas", String(stats.total_appointments)],
        ["Prontuários", String(stats.total_records)],
        [
          "Tempo médio de atendimento",
          stats.avg_duration != null ? `${stats.avg_duration} min` : "—",
        ],
        [
          "Média de consultas por clínica",
          stats.avg_appointments_per_company != null
            ? String(stats.avg_appointments_per_company)
            : "—",
        ],
        [
          "Média de pacientes por clínica",
          stats.avg_patients_per_company != null ? String(stats.avg_patients_per_company) : "—",
        ],
      ],
      tables: [
        {
          title: "Ranking de clínicas mais ativas",
          head: [
            "Clínica",
            "Usuários",
            "Pacientes",
            "Consultas",
            "Prontuários",
            "Última atividade",
          ],
          body: ranking.map((c) => [
            c.company_name,
            String(c.users),
            String(c.patients),
            String(c.appointments),
            String(c.records),
            fmtDate(c.last_activity),
          ]),
        },
        {
          title: "Clínicas sem atividade recente (>30 dias)",
          head: ["Clínica", "Última atividade"],
          body: inactive.map((c) => [c.company_name, fmtDate(c.last_activity)]),
        },
      ],
      fileName: "dashboard-admin",
    });
  };

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Métricas e crescimento de toda a plataforma.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/admin/logs">
              <ScrollText className="h-3.5 w-3.5" /> Logs
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Cards principais */}
      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Clínicas cadastradas"
          value={stats.total_companies}
          hint={`${stats.approved_companies} aprovadas · ${stats.pending_companies} pendentes`}
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Clínicas ativas (30d)"
          value={stats.active_companies}
          hint={`${stats.total_companies - stats.active_companies} sem atividade`}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Usuários"
          value={stats.total_users}
          hint={`${stats.total_dentists} dentistas`}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Pacientes"
          value={stats.total_patients}
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Consultas"
          value={stats.total_appointments}
          hint={
            stats.avg_appointments_per_company != null
              ? `média ${stats.avg_appointments_per_company}/clínica`
              : undefined
          }
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Prontuários"
          value={stats.total_records}
        />
        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label="Tempo médio"
          value={stats.avg_duration != null ? `${stats.avg_duration} min` : "—"}
        />
        <StatCard
          icon={<Stethoscope className="h-5 w-5" />}
          label="Pacientes / clínica"
          value={stats.avg_patients_per_company ?? "—"}
        />
      </div>

      {/* Crescimento */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Novas clínicas por mês</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="new_companies"
                name="Novas"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cumulative_companies"
                name="Acumulado"
                stroke="hsl(var(--chart-2, 173 58% 39%))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Novos usuários e pacientes por mês</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="new_users"
                name="Usuários"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="new_patients"
                name="Pacientes"
                stroke="hsl(var(--chart-2, 173 58% 39%))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Utilização */}
      <Card className="mb-4 p-4">
        <h2 className="mb-3 font-semibold">Utilização: consultas e prontuários por mês</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={growth}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" fontSize={11} tickLine={false} />
            <YAxis fontSize={12} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="appointments"
              name="Consultas"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="records"
              name="Prontuários"
              fill="hsl(var(--chart-2, 173 58% 39%))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Monitoramento de atividade */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Clínicas mais ativas</h2>
          <div className="space-y-2">
            {ranking.map((c, i) => (
              <div
                key={c.company_id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}º</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.company_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.patients} pacientes · {c.appointments} consultas · {c.records} prontuários
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(c.last_activity)}</span>
              </div>
            ))}
            {ranking.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Clínicas sem atividade recente
            </h2>
            <div className="space-y-2">
              {inactive.map((c) => (
                <div
                  key={c.company_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
                >
                  <p className="truncate text-sm font-medium">{c.company_name}</p>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-destructive/40 text-destructive"
                  >
                    desde {fmtDate(c.last_activity)}
                  </Badge>
                </div>
              ))}
              {inactive.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Todas as clínicas ativas nos últimos 30 dias. 🎉
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 font-semibold">Usuários mais ativos (30d)</h2>
            <div className="space-y-2">
              {topUsers.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.user_name || u.user_email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.company_name ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0",
                      u.user_role === "dentist" && "border-primary/40 text-primary",
                    )}
                  >
                    {u.actions} ações
                  </Badge>
                </div>
              ))}
              {topUsers.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sem atividade registrada ainda.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
