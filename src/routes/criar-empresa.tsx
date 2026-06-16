import { createFileRoute, Link } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { CompanyWizard } from "@/components/company-wizard";

export const Route = createFileRoute("/criar-empresa")({
  component: CreateCompanyPage,
  head: () => ({ meta: [{ title: "Criar empresa — OdontoSign" }] }),
});

function CreateCompanyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
            style={{ background: "var(--gradient-clinical)" }}
          >
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Criar empresa</h1>
          <p className="text-sm text-muted-foreground -mt-2">Cadastre sua clínica na OdontoSign</p>
        </div>

        <CompanyWizard mode="signup" />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
