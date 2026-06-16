import { createFileRoute } from "@tanstack/react-router";
import { DocDetailPage } from "@/components/signed-docs/DocDetailPage";

export const Route = createFileRoute("/_authenticated/termos/$id")({
  component: TermoDetail,
  head: () => ({ meta: [{ title: "Termo — OdontoSign" }] }),
});

function TermoDetail() {
  const { id } = Route.useParams();
  return <DocDetailPage kind="term" id={id} />;
}
