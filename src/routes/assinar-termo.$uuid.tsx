import { createFileRoute } from "@tanstack/react-router";
import { PublicSignPage } from "@/components/signed-docs/PublicSignPage";

export const Route = createFileRoute("/assinar-termo/$uuid")({
  component: AssinarTermo,
  head: () => ({ meta: [{ title: "Assinar termo — OdontoSign" }] }),
});

function AssinarTermo() {
  const { uuid } = Route.useParams();
  return <PublicSignPage kind="term" token={uuid} />;
}
