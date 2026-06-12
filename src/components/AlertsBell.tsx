import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Building2, ShieldAlert, UserX, AlertTriangle, CreditCard } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminAlert = {
  id: string;
  alert_type:
    | "inactive_clinic"
    | "failed_logins"
    | "critical_error"
    | "subscription_expiring"
    | "blocked_user";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_ICON = {
  inactive_clinic: Building2,
  failed_logins: ShieldAlert,
  critical_error: AlertTriangle,
  subscription_expiring: CreditCard,
  blocked_user: UserX,
} as const;

const SEVERITY_COLOR: Record<AdminAlert["severity"], string> = {
  info: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function AlertsBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () => {
      // Regenera alertas (idempotente) e busca os mais recentes
      await supabase.rpc("refresh_admin_alerts").then(
        () => {},
        () => {},
      );
      const { data } = await supabase
        .from("admin_alerts")
        .select("id,alert_type,severity,title,description,is_read,created_at")
        .order("is_read", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(15);
      return (data ?? []) as AdminAlert[];
    },
    refetchInterval: 120_000,
  });

  // Realtime: novos alertas atualizam o sino na hora
  useEffect(() => {
    const channel = supabase
      .channel("admin-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-alerts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const unread = alerts.filter((a) => !a.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from("admin_alerts").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-alerts"] });
  };

  const markAllRead = async () => {
    await supabase.from("admin_alerts").update({ is_read: true }).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["admin-alerts"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 shrink-0">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Alertas</span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-normal text-primary hover:underline"
            >
              Marcar todos como lidos
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum alerta no momento.
          </p>
        )}
        {alerts.map((a) => {
          const Icon = TYPE_ICON[a.alert_type] ?? AlertTriangle;
          return (
            <DropdownMenuItem
              key={a.id}
              onClick={() => markRead(a.id)}
              className={cn("flex items-start gap-2.5 py-2.5", !a.is_read && "bg-primary/5")}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_COLOR[a.severity])} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", !a.is_read && "font-medium")}>{a.title}</p>
                {a.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {a.description}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDate(a.created_at)}</p>
              </div>
              {!a.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate({ to: "/admin/dashboard" })}
          className="justify-center text-xs text-primary"
        >
          Ver dashboard administrativo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
