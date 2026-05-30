import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building2, Users, FileText, ShieldCheck, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Super Admin — OdontoClinic" }] }),
});

type Company = { id: string; company_name: string; company_email: string; created_at: string };
type Profile = { id: string; first_name: string | null; last_name: string | null; email: string; company_id: string; is_admin: boolean; status: string };
type Patient = { id: string; nome: string | null; prontuario: string | null; status: string; created_at: string; signed_at: string | null; company_id: string };

function AdminPage() {
  const { profile, loading: authLoading } = useAuth();
  const [data, setData] = useState<{ companies: Company[]; profiles: Profile[]; patients: Patient[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.is_admin) return;
    (async () => {
      const [c, p, pa] = await Promise.all([
        supabase.from("companies").select("id,company_name,company_email,created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,first_name,last_name,email,company_id,is_admin,status"),
        supabase.from("patients").select("id,nome,prontuario,status,created_at,signed_at,company_id").order("created_at", { ascending: false }).limit(500),
      ]);
      setData({
        companies: (c.data ?? []) as Company[],
        profiles: (p.data ?? []) as Profile[],
        patients: (pa.data ?? []) as Patient[],
      });
      setLoading(false);
    })();
  }, [authLoading, profile?.is_admin]);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    data?.companies.forEach((c) => m.set(c.id, c.company_name));
    return m;
  }, [data]);

  if (authLoading) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;
  if (!profile?.is_admin) {
    throw redirect({ to: "/" });
  }
  if (loading || !data) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;

  const ql = q.trim().toLowerCase();
  const filterStr = (s: string | null | undefined) => (s ?? "").toLowerCase().includes(ql);

  const filteredCompanies = ql ? data.companies.filter((c) => filterStr(c.company_name) || filterStr(c.company_email)) : data.companies;
  const filteredProfiles = ql ? data.profiles.filter((p) => filterStr(p.email) || filterStr(p.first_name) || filterStr(p.last_name)) : data.profiles;
  const filteredPatients = ql ? data.patients.filter((p) => filterStr(p.nome) || filterStr(p.prontuario) || filterStr(companyMap.get(p.company_id) ?? "")) : data.patients;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Visão global de todas as clínicas cadastradas.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Clínicas" value={data.companies.length} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Usuários" value={data.profiles.length} />
        <StatCard icon={<FileText className="h-5 w-5" />} label="Pacientes" value={data.patients.length} />
      </div>

      <div className="relative mb-4 w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="pl-9" />
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Clínicas ({filteredCompanies.length})</TabsTrigger>
          <TabsTrigger value="users">Usuários ({filteredProfiles.length})</TabsTrigger>
          <TabsTrigger value="patients">Pacientes ({filteredPatients.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-4 grid gap-2">
          {filteredCompanies.map((c) => {
            const usersInCompany = data.profiles.filter((p) => p.company_id === c.id).length;
            const patientsInCompany = data.patients.filter((p) => p.company_id === c.id).length;
            return (
              <Card key={c.id} className="p-4 lift-on-hover">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.company_email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{usersInCompany} usuários</Badge>
                    <Badge variant="outline">{patientsInCompany} pacientes</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
          {filteredCompanies.length === 0 && <Empty label="Nenhuma clínica" />}
        </TabsContent>

        <TabsContent value="users" className="mt-4 grid gap-2">
          {filteredProfiles.map((p) => (
            <Card key={p.id} className="p-4 lift-on-hover">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{companyMap.get(p.company_id) ?? "—"}</Badge>
                  {p.is_admin && <Badge className="bg-primary text-primary-foreground">Admin</Badge>}
                  <Badge variant="outline" className={p.status === "active" ? "border-success/40 text-success" : ""}>
                    {p.status}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
          {filteredProfiles.length === 0 && <Empty label="Nenhum usuário" />}
        </TabsContent>

        <TabsContent value="patients" className="mt-4 grid gap-2">
          {filteredPatients.map((p) => (
            <Card key={p.id} className="p-4 lift-on-hover">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {p.nome || <span className="italic text-muted-foreground">Aguardando preenchimento</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.prontuario && <span className="font-mono mr-2">{p.prontuario}</span>}
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{companyMap.get(p.company_id) ?? "—"}</Badge>
                  <Badge
                    variant="outline"
                    className={p.signed_at ? "border-success/40 text-success" : "border-warning/40 text-warning"}
                  >
                    {p.signed_at ? "Assinado" : "Pendente"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
          {filteredPatients.length === 0 && <Empty label="Nenhum paciente" />}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4 flex items-center gap-3 lift-on-hover">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <Card className="p-8 text-center text-sm text-muted-foreground">{label}</Card>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-center py-16">{children}</div>;
}
