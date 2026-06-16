import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FileSignature, Loader2, Plus, Search } from "lucide-react";
import {
  STATUS_META,
  TREATMENT_LABEL,
  type Contract,
  type ContractStatus,
  type TreatmentType,
} from "@/lib/contracts";

export const Route = createFileRoute("/_authenticated/contratos/")({
  component: ContractsList,
  head: () => ({ meta: [{ title: "Contratos — OdontoSign" }] }),
});

type Row = Pick<
  Contract,
  | "id"
  | "contract_number"
  | "treatment_type"
  | "status"
  | "created_at"
  | "paciente_nome"
  | "contratante_nome"
>;

function ContractsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("contracts")
      .select("id,contract_number,treatment_type,status,created_at,paciente_nome,contratante_nome")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error("Erro ao carregar contratos");
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    load();
    const ch = supabase
      .channel("contracts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, profile]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const nome = (r.paciente_nome || r.contratante_nome || "").toLowerCase();
      return (
        nome.includes(q) ||
        String(r.contract_number).includes(q) ||
        (TREATMENT_LABEL[r.treatment_type as TreatmentType] ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const openContract = (r: Row) => {
    if (r.status === "aguardando_recepcao") {
      navigate({ to: "/contratos/$id/editar", params: { id: r.id } });
    } else {
      navigate({ to: "/contratos/$id", params: { id: r.id } });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os contratos de tratamento e a assinatura digital.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link to="/contratos/novo">
            <Plus className="h-4 w-4" /> Novo contrato
          </Link>
        </Button>
      </div>

      <div className="mb-4 relative w-full sm:w-96">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nº, paciente ou tipo..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileSignature className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {rows.length === 0 ? "Nenhum contrato ainda" : "Nenhum resultado"}
          </p>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? 'Clique em "Novo contrato" para começar.'
              : "Tente outro termo de busca."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const st =
                    STATUS_META[r.status as ContractStatus] ?? STATUS_META.aguardando_paciente;
                  const nome = r.paciente_nome || r.contratante_nome;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => openContract(r)}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {String(r.contract_number).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {nome || (
                          <span className="italic text-muted-foreground">Aguardando paciente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {TREATMENT_LABEL[r.treatment_type as TreatmentType] ?? r.treatment_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={st.cls}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "aguardando_recepcao" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/contratos/$id/editar" params={{ id: r.id }}>
                              Completar
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/contratos/$id" params={{ id: r.id }}>
                              Abrir
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </main>
  );
}
