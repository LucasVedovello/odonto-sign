import { createFileRoute } from "@tanstack/react-router";
import { PublicSignPage } from "@/components/signed-docs/PublicSignPage";

export const Route = createFileRoute("/assinar-contrato/$uuid")({
  component: AssinarContrato,
  head: () => ({ meta: [{ title: "Assinar contrato — OdontoSign" }] }),
});

function AssinarContrato() {
  const { uuid } = Route.useParams();
  return <PublicSignPage kind="contract" token={uuid} />;
}
