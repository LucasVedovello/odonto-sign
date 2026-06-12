import { createFileRoute } from "@tanstack/react-router";
import { roleGuard } from "@/lib/rbac";
import { AuditLogTable } from "@/components/AuditLogTable";

export const Route = createFileRoute("/_authenticated/admin_/logs")({
  beforeLoad: roleGuard(["platform_admin"]),
  component: () => <AuditLogTable scope="platform" />,
  head: () => ({ meta: [{ title: "Logs da Plataforma — OdontoClinic" }] }),
});
