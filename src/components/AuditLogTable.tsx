import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { exportTablePdf, exportTableExcel, type ExportColumn } from "@/lib/export";

const PAGE_SIZE = 25;

type AuditLog = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  company_id: string | null;
  action_type: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  password_reset: "Recuperação de senha",
  password_change: "Alteração de senha",
  patient_create: "Paciente criado",
  patient_update: "Paciente atualizado",
  patient_delete: "Paciente excluído",
  patient_restore: "Paciente restaurado",
  appointment_create: "Consulta criada",
  appointment_update: "Consulta atualizada",
  appointment_reschedule: "Consulta remarcada",
  appointment_cancel: "Consulta cancelada",
  appointment_finish: "Consulta finalizada",
  appointment_delete: "Consulta excluída",
  record_create: "Prontuário criado",
  record_update: "Prontuário atualizado",
  record_sign: "Prontuário assinado",
  record_delete: "Prontuário excluído",
  record_restore: "Prontuário restaurado",
  user_create: "Usuário criado",
  user_update: "Usuário atualizado",
  user_delete: "Usuário excluído",
  permission_change: "Permissão alterada",
  clinic_settings_update: "Config. da clínica",
  clinic_data_update: "Dados da clínica",
};

const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  { label: "Autenticação", actions: ["login", "logout", "password_reset", "password_change"] },
  {
    label: "Pacientes",
    actions: ["patient_create", "patient_update", "patient_delete", "patient_restore"],
  },
  {
    label: "Consultas",
    actions: [
      "appointment_create",
      "appointment_update",
      "appointment_reschedule",
      "appointment_cancel",
      "appointment_finish",
      "appointment_delete",
    ],
  },
  {
    label: "Prontuários",
    actions: ["record_create", "record_update", "record_sign", "record_delete", "record_restore"],
  },
  {
    label: "Usuários",
    actions: ["user_create", "user_update", "user_delete", "permission_change"],
  },
  { label: "Clínica", actions: ["clinic_settings_update", "clinic_data_update"] },
];

const badgeClass = (action: string) => {
  if (action.startsWith("login") || action.startsWith("logout") || action.includes("password"))
    return "bg-primary/15 text-primary border-primary/30";
  if (action.includes("delete") || action.includes("cancel"))
    return "bg-destructive/15 text-destructive border-destructive/30";
  if (action.includes("sign") || action.includes("finish") || action.includes("restore"))
    return "bg-success/15 text-success border-success/30";
  if (action === "permission_change") return "bg-warning/15 text-warning border-warning/30";
  return "bg-muted text-muted-foreground";
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));

type Company = { id: string; company_name: string };

export function AuditLogTable({ scope }: { scope: "platform" | "clinic" }) {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("all");
  const [companyId, setCompanyId] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Lista de clínicas para o filtro (apenas plataforma)
  const { data: companies = [] } = useQuery({
    queryKey: ["log-companies"],
    enabled: scope === "platform",
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id,company_name")
        .order("company_name");
      return (data ?? []) as Company[];
    },
  });

  const filterKey = [action, companyId, search, ipFilter, from, to] as const;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", scope, page, ...filterKey],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (action !== "all") query = query.eq("action_type", action as never);
      if (scope === "platform" && companyId !== "all") query = query.eq("company_id", companyId);
      if (search.trim())
        query = query.or(`description.ilike.%${search.trim()}%,user_name.ilike.%${search.trim()}%`);
      if (ipFilter.trim()) query = query.ilike("ip_address", `%${ipFilter.trim()}%`);
      if (from) query = query.gte("created_at", `${from}T00:00:00`);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);

      const { data: rows, count, error } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as AuditLog[], count: count ?? 0 };
    },
  });

  const logs = data?.rows ?? [];
  const total = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c.company_name])),
    [companies],
  );

  const applySearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const exportColumns: ExportColumn<AuditLog>[] = [
    { header: "Data/Hora", value: (l) => fmtDateTime(l.created_at) },
    { header: "Usuário", value: (l) => l.user_name ?? "Sistema" },
    { header: "Função", value: (l) => l.user_role ?? "" },
    ...(scope === "platform"
      ? [
          {
            header: "Clínica",
            value: (l: AuditLog) => (l.company_id ? (companyMap.get(l.company_id) ?? "") : ""),
          },
        ]
      : []),
    { header: "Ação", value: (l) => ACTION_LABEL[l.action_type] ?? l.action_type },
    { header: "Descrição", value: (l) => l.description ?? "" },
    { header: "IP", value: (l) => l.ip_address ?? "" },
    { header: "Dispositivo", value: (l) => l.device_info ?? "" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {scope === "platform" ? "Logs da Plataforma" : "Logs da Clínica"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Auditoria de ações — {total} registro{total === 1 ? "" : "s"} encontrados.
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
                title: scope === "platform" ? "Logs da Plataforma" : "Logs da Clínica",
                columns: exportColumns,
                rows: logs,
                fileName: "logs-auditoria",
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
                sheetName: "Logs",
                columns: exportColumns,
                rows: logs,
                fileName: "logs-auditoria",
              })
            }
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              onBlur={applySearch}
              placeholder="Buscar na descrição ou usuário..."
              className="pl-9"
            />
          </div>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {ACTION_GROUPS.flatMap((g) => g.actions).map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scope === "platform" && (
            <Select
              value={companyId}
              onValueChange={(v) => {
                setCompanyId(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Clínica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as clínicas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={ipFilter}
            onChange={(e) => {
              setIpFilter(e.target.value);
              setPage(0);
            }}
            placeholder="Filtrar por IP"
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhum log encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  {scope === "platform" && <TableHead>Clínica</TableHead>}
                  <TableHead>Ação</TableHead>
                  <TableHead className="min-w-[220px]">Descrição</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {fmtDateTime(l.created_at)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{l.user_name ?? "Sistema"}</p>
                      {l.user_role && (
                        <p className="text-[11px] text-muted-foreground">{l.user_role}</p>
                      )}
                    </TableCell>
                    {scope === "platform" && (
                      <TableCell className="text-xs">
                        {l.company_id ? (companyMap.get(l.company_id) ?? "—") : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline" className={badgeClass(l.action_type)}>
                        {ACTION_LABEL[l.action_type] ?? l.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-[320px] truncate text-sm"
                      title={l.description ?? undefined}
                    >
                      {l.description ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.ip_address ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.device_info ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Paginação server-side */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Página {page + 1} de {pageCount}{" "}
          {isFetching && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="gap-1"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
