import { createFileRoute } from "@tanstack/react-router";
import { roleGuard } from "@/lib/rbac";
import { AuditLogTable } from "@/components/AuditLogTable";

export const Route = createFileRoute("/_authenticated/dashboard_/logs")({
  // RLS já restringe os logs à clínica do owner; o guard bloqueia dentistas
  beforeLoad: roleGuard(["clinic_owner"]),
  component: () => <AuditLogTable scope="clinic" />,
  head: () => ({ meta: [{ title: "Logs da Clínica — OdontoClinic" }] }),
});
