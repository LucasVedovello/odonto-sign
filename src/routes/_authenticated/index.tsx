import { createFileRoute, redirect } from "@tanstack/react-router";

// A home agora é o novo sistema de contratos.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/contratos" });
  },
});
