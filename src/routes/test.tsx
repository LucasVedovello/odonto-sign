import { createFileRoute } from "@tanstack/react-router";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Home, Users, FileText, Calendar, Settings,
  Search, Plus, Copy, ExternalLink, LayoutDashboard,
  ClipboardList, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/test")({
  component: TestPage,
  head: () => ({ meta: [{ title: "Teste de Componentes" }] }),
});

const mockTabs = [
  { title: "Contratos", icon: LayoutDashboard },
  { title: "Prontuário", icon: ClipboardList },
  { title: "Usuários", icon: Users },
  { type: "separator" as const },
  { title: "Admin", icon: ShieldCheck },
  { title: "Ajustes", icon: Settings },
];

const mockPatients = [
  { id: "1", prontuario: "10421", nome: "Ana Beatriz Souza", status: "assinado", procedimentos: ["Implante"], created_at: "2026-06-07", telefone: "(11) 98765-4321" },
  { id: "2", prontuario: "10398", nome: "Carlos Eduardo Lima", status: "aguardando", procedimentos: ["Ortodontia"], created_at: "2026-06-06", telefone: "(11) 91234-5678" },
  { id: "3", prontuario: "10375", nome: "Fernanda Oliveira", status: "pdf_gerado", procedimentos: ["Prótese", "Implante"], created_at: "2026-06-05", telefone: "(11) 99876-5432" },
  { id: "4", prontuario: "10354", nome: "Rafael Mendes Costa", status: "aguardando", procedimentos: [], created_at: "2026-06-04", telefone: "(11) 93456-7890" },
  { id: "5", prontuario: "10331", nome: "Juliana Martins", status: "assinado", procedimentos: ["Ortodontia"], created_at: "2026-06-03", telefone: "(11) 97654-3210" },
];

const statusMap: Record<string, { label: string; cls: string }> = {
  aguardando: { label: "Pendente",   cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  assinado:   { label: "Assinado",   cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  pdf_gerado: { label: "Finalizado", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
};

function DashboardMock() {
  return (
    <div className="flex h-full flex-col overflow-hidden text-[11px] bg-background">
      {/* mini header */}
      <header className="flex items-center justify-between border-b px-4 py-2 bg-card/80 shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png"
            alt="logo"
            className="h-6 w-6 rounded object-contain"
          />
          <span className="font-semibold leading-none">OdontoClinic</span>
        </div>
        <nav className="flex items-center gap-1">
          {["Contratos","Prontuário","Usuários"].map((label) => (
            <span key={label} className="rounded px-2 py-0.5 text-muted-foreground hover:bg-muted cursor-default">
              {label}
            </span>
          ))}
        </nav>
        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-bold">LV</div>
      </header>

      {/* main */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-base leading-tight">Contratos</p>
            <p className="text-muted-foreground text-[10px]">Gerencie cadastros e contratos digitais.</p>
          </div>
          <button className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground font-medium">
            <Plus className="h-3 w-3" /> Novo Cadastro
          </button>
        </div>

        {/* search + filters */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <div className="h-7 w-full rounded-md border bg-background pl-6 text-muted-foreground flex items-center text-[10px]">
              Buscar por nome, CPF…
            </div>
          </div>
          {["Todos (5)","Pendentes (2)","Finalizados (3)"].map((label, i) => (
            <span key={label} className={`rounded-md border px-2 py-0.5 cursor-default ${i === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              {label}
            </span>
          ))}
        </div>

        {/* patient rows */}
        <div className="grid gap-1.5">
          {mockPatients.map((p) => {
            const s = statusMap[p.status];
            return (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-semibold text-muted-foreground">
                      {p.nome.split(" ").map(w => w[0]).slice(0,2).join("")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate leading-tight">{p.nome}</p>
                    <p className="text-[9px] text-muted-foreground">{p.telefone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.prontuario && (
                    <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 font-mono">#{p.prontuario}</span>
                  )}
                  {p.procedimentos.map((proc) => (
                    <span key={proc} className="rounded bg-muted text-muted-foreground px-1.5 py-0.5">{proc}</span>
                  ))}
                  <span className={`rounded border px-1.5 py-0.5 font-medium ${s.cls}`}>{s.label}</span>
                  <div className="flex gap-1">
                    <button className="rounded p-0.5 text-muted-foreground hover:bg-muted"><Copy className="h-3 w-3" /></button>
                    <button className="rounded p-0.5 text-muted-foreground hover:bg-muted"><ExternalLink className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TestPage() {
  return (
    <div className="min-h-screen">
      <ContainerScroll
        titleComponent={
          <>
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-4">
              Gestão odontológica simplificada
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Organize sua clínica com
              <br />
              <span className="text-primary">OdontoClinic</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Prontuários digitais, contratos, agendamentos e muito mais — tudo num só lugar.
            </p>
          </>
        }
      >
        <DashboardMock />
      </ContainerScroll>

      <div className="flex justify-center pb-20">
        <ExpandableTabs tabs={mockTabs} activeColor="text-primary" />
      </div>
    </div>
  );
}
