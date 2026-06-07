import { createFileRoute } from "@tanstack/react-router";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { Home, Users, FileText, Calendar, Settings } from "lucide-react";

export const Route = createFileRoute("/test")({
  component: TestPage,
  head: () => ({ meta: [{ title: "Teste de Componentes" }] }),
});

const mockTabs = [
  { title: "Início", icon: Home },
  { title: "Pacientes", icon: Users },
  { title: "Relatórios", icon: FileText },
  { type: "separator" as const },
  { title: "Agenda", icon: Calendar },
  { title: "Ajustes", icon: Settings },
];

function TestPage() {
  return (
    <div className="min-h-screen">
      <ContainerScroll
        titleComponent={
          <>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
              Demonstração de componentes
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              ContainerScroll + ExpandableTabs
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Página temporária para visualizar os componentes isolados, com dados mockados.
            </p>
          </>
        }
      >
        <img
          src="https://images.unsplash.com/photo-1588776814546-1ffbb172d4a3?w=1400&q=80"
          alt="Preview mockado"
          className="w-full h-full object-cover object-top rounded-xl"
        />
      </ContainerScroll>

      <div className="flex justify-center pb-20">
        <ExpandableTabs tabs={mockTabs} activeColor="text-primary" />
      </div>
    </div>
  );
}
