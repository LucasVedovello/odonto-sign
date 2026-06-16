import { createFileRoute, redirect } from "@tanstack/react-router";

// O cadastro/registro de novas contas foi desativado. A rota permanece apenas
// para redirecionar qualquer acesso direto pela URL de volta para o login.
export const Route = createFileRoute("/criar-empresa")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
