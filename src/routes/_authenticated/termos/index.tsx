import { createFileRoute } from "@tanstack/react-router";
import { DocsListPage } from "@/components/signed-docs/DocsListPage";

export const Route = createFileRoute("/_authenticated/termos/")({
  component: () => <DocsListPage kind="term" />,
  head: () => ({ meta: [{ title: "Termos — OdontoSign" }] }),
});
