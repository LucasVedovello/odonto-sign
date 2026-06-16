import { createFileRoute } from "@tanstack/react-router";
import { DocsListPage } from "@/components/signed-docs/DocsListPage";

export const Route = createFileRoute("/_authenticated/contratos/")({
  component: () => <DocsListPage kind="contract" />,
  head: () => ({ meta: [{ title: "Contratos — OdontoSign" }] }),
});
