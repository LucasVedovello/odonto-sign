import { createFileRoute, redirect } from "@tanstack/react-router";

// A home agora é o novo sistema de contratos.
// O antigo painel de cadastros foi preservado em /cadastros.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/contratos" });
  },
});
