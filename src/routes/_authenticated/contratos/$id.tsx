import { createFileRoute } from "@tanstack/react-router";
import { DocDetailPage } from "@/components/signed-docs/DocDetailPage";

export const Route = createFileRoute("/_authenticated/contratos/$id")({
  component: ContratoDetail,
  head: () => ({ meta: [{ title: "Contrato — OdontoSign" }] }),
});

function ContratoDetail() {
  const { id } = Route.useParams();
  return <DocDetailPage kind="contract" id={id} />;
}
