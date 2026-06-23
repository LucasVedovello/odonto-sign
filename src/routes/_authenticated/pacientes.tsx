import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Search,
  Link2,
  UserPlus,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  maskCPF,
  maskDate,
  maskPhone,
  maskCEP,
  fetchViaCEP,
  filterNomeInput,
  onlyDigits,
  isValidCPF,
  isValidNome,
  isValidEmail,
  isValidPhone,
  isValidDate,
  dateBRtoISO,
  dateISOtoBR,
} from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/pacientes")({
  component: PacientesPage,
  head: () => ({ meta: [{ title: "Pacientes — OdontoSign" }] }),
});

const PAGE_SIZE = 20;
const GENEROS = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];

type Patient = {
  id: string;
  nome: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  genero: string | null;
  cep: string | null;
  rua: string | null;
  bairro: string | null;
  numero: string | null;
  active: boolean;
  status: string;
  token: string;
  created_at: string;
};

type FormState = {
  nome: string;
  cpf: string;
  data_nascimento: string; // DD/MM/AAAA
  telefone: string;
  email: string;
  genero: string;
  cep: string;
  rua: string;
  bairro: string;
  numero: string;
};

const EMPTY_FORM: FormState = {
  nome: "",
  cpf: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  genero: "",
  cep: "",
  rua: "",
  bairro: "",
  numero: "",
};

const COLUMNS =
  "id,nome,cpf,data_nascimento,telefone,email,genero,cep,rua,bairro,numero,active,status,token,created_at";

function PacientesPage() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);

  // Sheet de criar/editar
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null); // null = novo
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select(COLUMNS)
      .eq("company_id", profile.company_id)
      .is("deleted_at", null)
      .order("nome", { ascending: true })
      .limit(1000);
    if (error) {
      toast.error("Erro ao carregar pacientes");
      setLoading(false);
      return;
    }
    setPatients((data ?? []) as Patient[]);
    setLoading(false);
  }, [profile?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Busca por nome / CPF / e-mail (normaliza dígitos para o CPF).
  const filtered = useMemo(() => {
    const byStatus = patients.filter((p) => (showInactive ? !p.active : p.active));
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    const qDigits = onlyDigits(q);
    return byStatus.filter(
      (p) =>
        (p.nome ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (!!qDigits && onlyDigits(p.cpf ?? "").includes(qDigits)),
    );
  }, [patients, query, showInactive]);

  // Reseta a página quando o filtro muda.
  useEffect(() => {
    setPage(0);
  }, [query, showInactive]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({
      nome: p.nome ?? "",
      cpf: p.cpf ? maskCPF(p.cpf) : "",
      data_nascimento: dateISOtoBR(p.data_nascimento),
      telefone: p.telefone ? maskPhone(p.telefone) : "",
      email: p.email ?? "",
      genero: p.genero ?? "",
      cep: p.cep ? maskCEP(p.cep) : "",
      rua: p.rua ?? "",
      bairro: p.bairro ?? "",
      numero: p.numero ?? "",
    });
    setOpen(true);
  };

  const handleCEP = async (raw: string) => {
    const masked = maskCEP(raw);
    setForm((f) => ({ ...f, cep: masked }));
    if (onlyDigits(raw).length === 8) {
      setCepLoading(true);
      const r = await fetchViaCEP(masked);
      setCepLoading(false);
      if (r) setForm((f) => ({ ...f, rua: r.logradouro || f.rua, bairro: r.bairro || f.bairro }));
    }
  };

  const validate = (): string | null => {
    if (!isValidNome(form.nome)) return "Informe o nome completo do paciente";
    if (!isValidCPF(form.cpf)) return "CPF inválido";
    if (form.data_nascimento && !isValidDate(form.data_nascimento))
      return "Data de nascimento inválida";
    if (form.telefone && !isValidPhone(form.telefone)) return "Telefone inválido";
    if (form.email && !isValidEmail(form.email)) return "E-mail inválido";
    return null;
  };

  const save = async () => {
    if (!profile?.company_id) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      cpf: onlyDigits(form.cpf),
      data_nascimento: dateBRtoISO(form.data_nascimento),
      telefone: form.telefone ? onlyDigits(form.telefone) : null,
      email: form.email.trim().toLowerCase() || null,
      genero: form.genero || null,
      cep: form.cep ? onlyDigits(form.cep) : null,
      rua: form.rua.trim() || null,
      bairro: form.bairro.trim() || null,
      numero: form.numero.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("patients").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Paciente atualizado");
      } else {
        const { error } = await supabase.from("patients").insert({
          company_id: profile.company_id,
          created_by_user: profile.id,
          active: true,
          status: "active",
          ...payload,
        });
        if (error) throw error;
        toast.success("Paciente cadastrado");
      }
      setOpen(false);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar o paciente");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Patient) => {
    const { error } = await supabase.from("patients").update({ active: !p.active }).eq("id", p.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(p.active ? "Paciente desativado" : "Paciente reativado");
    load();
  };

  // Gera um token novo, marca o paciente como pending_registration e copia o
  // link de auto-cadastro para a área de transferência.
  const sendRegistrationLink = async (p: Patient) => {
    const newToken = crypto.randomUUID();
    const { error } = await supabase
      .from("patients")
      .update({ token: newToken, status: "pending_registration" })
      .eq("id", p.id);
    if (error) {
      toast.error("Não foi possível gerar o link");
      return;
    }
    const url = `${window.location.origin}/cadastro/${newToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de cadastro copiado para a área de transferência");
    } catch {
      toast.message("Link de cadastro gerado", { description: url });
    }
    load();
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Cadastro de pacientes da clínica</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Paciente
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, CPF ou e-mail..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={showInactive ? "outline" : "default"}
            onClick={() => setShowInactive(false)}
          >
            Ativos
          </Button>
          <Button
            size="sm"
            variant={showInactive ? "default" : "outline"}
            onClick={() => setShowInactive(true)}
          >
            Inativos
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <UserPlus className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">
            {patients.length === 0 ? "Nenhum paciente cadastrado" : "Nenhum resultado"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {patients.length === 0
              ? 'Clique em "Novo Paciente" para começar.'
              : "Tente outro termo de busca."}
          </p>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-border">
            {pageItems.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openEdit(p)}
                  aria-label={`Editar ${p.nome ?? "paciente"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">
                      {p.nome || <span className="italic text-muted-foreground">Sem nome</span>}
                    </p>
                    {!p.active && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                    {p.status === "pending_registration" && (
                      <Badge
                        variant="outline"
                        className="bg-warning/15 text-warning border-warning/30"
                      >
                        Cadastro pendente
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.cpf ? `CPF ${maskCPF(p.cpf)}` : "CPF não informado"}
                    {p.telefone && ` · ${maskPhone(p.telefone)}`}
                    {p.email && ` · ${p.email}`}
                  </p>
                </button>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => sendRegistrationLink(p)}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Link de cadastro</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={p.active ? "Desativar" : "Reativar"}
                    className={p.active ? "text-destructive hover:bg-destructive/10" : ""}
                    onClick={() => toggleActive(p)}
                  >
                    {p.active ? (
                      <UserX className="h-3.5 w-3.5" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtered.length} paciente(s) · página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sheet de criar/editar paciente */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar paciente" : "Novo paciente"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Atualize os dados do paciente."
                : "Preencha os dados para cadastrar o paciente."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4">
            <div className="grid gap-1.5">
              <Label>Nome completo *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: filterNomeInput(e.target.value) }))}
                placeholder="Nome do paciente"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>CPF *</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => setForm((f) => ({ ...f, cpf: maskCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  value={form.data_nascimento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, data_nascimento: maskDate(e.target.value) }))
                  }
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: maskPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Gênero</Label>
                <Select
                  value={form.genero}
                  onValueChange={(v) => setForm((f) => ({ ...f, genero: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENEROS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="nome@exemplo.com"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1.5">
                  CEP {cepLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <Input
                  value={form.cep}
                  onChange={(e) => handleCEP(e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Rua</Label>
                <Input
                  value={form.rua}
                  onChange={(e) => setForm((f) => ({ ...f, rua: e.target.value }))}
                  placeholder="Preenchida pelo CEP"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Bairro</Label>
                <Input
                  value={form.bairro}
                  onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Número</Label>
                <Input
                  value={form.numero}
                  onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                  placeholder="123"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}
