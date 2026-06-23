import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { OdontoLogo } from "@/components/OdontoLogo";
import {
  maskCPF,
  maskRG,
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

export const Route = createFileRoute("/cadastro/$token")({
  component: PatientRegistration,
  head: () => ({ meta: [{ title: "Cadastro do Paciente — OdontoSign" }] }),
});

const GENEROS = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const ESCOLARIDADES = [
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Completo",
  "Ensino Superior Incompleto",
  "Ensino Superior Completo",
  "Pós-graduação",
  "Mestrado",
  "Doutorado",
];

type FormState = {
  nome: string;
  cpf: string;
  rg: string;
  data_nascimento: string; // DD/MM/AAAA
  genero: string;
  estado_civil: string;
  telefone: string;
  email: string;
  cep: string;
  rua: string;
  bairro: string;
  numero: string;
  profissao: string;
  escolaridade: string;
};

const EMPTY: FormState = {
  nome: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  genero: "",
  estado_civil: "",
  telefone: "",
  email: "",
  cep: "",
  rua: "",
  bairro: "",
  numero: "",
  profissao: "",
  escolaridade: "",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reg = Record<string, any>;

function PatientRegistration() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    (async () => {
      // Acesso público apenas via RPC SECURITY DEFINER (sem acesso anon direto
      // à tabela patients — ver migration fix_rls_anon_policies).
      const { data, error } = await supabase.rpc("public_get_patient_registration", {
        p_token: token,
      });
      if (error || !data) {
        setInvalid(true);
        setLoading(false);
        return;
      }
      const reg = data as Reg;
      if (reg.status === "registered") {
        setDone(true);
        setLoading(false);
        return;
      }
      setForm({
        nome: reg.nome ?? "",
        cpf: reg.cpf ? maskCPF(reg.cpf) : "",
        rg: reg.rg ? maskRG(reg.rg) : "",
        data_nascimento: dateISOtoBR(reg.data_nascimento),
        genero: reg.genero ?? "",
        estado_civil: reg.estado_civil ?? "",
        telefone: reg.telefone ? maskPhone(reg.telefone) : "",
        email: reg.email ?? "",
        cep: reg.cep ? maskCEP(reg.cep) : "",
        rua: reg.rua ?? "",
        bairro: reg.bairro ?? "",
        numero: reg.numero ?? "",
        profissao: reg.profissao ?? "",
        escolaridade: reg.escolaridade ?? "",
      });
      setLoading(false);
    })();
  }, [token]);

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

  const submit = async () => {
    if (!isValidNome(form.nome)) return toast.error("Informe seu nome completo");
    if (!isValidCPF(form.cpf)) return toast.error("CPF inválido");
    if (form.data_nascimento && !isValidDate(form.data_nascimento))
      return toast.error("Data de nascimento inválida");
    if (form.telefone && !isValidPhone(form.telefone)) return toast.error("Telefone inválido");
    if (form.email && !isValidEmail(form.email)) return toast.error("E-mail inválido");

    setSaving(true);
    const { data, error } = await supabase.rpc("public_complete_patient_registration", {
      p_token: token,
      p_data: {
        nome: form.nome.trim(),
        cpf: onlyDigits(form.cpf),
        rg: onlyDigits(form.rg),
        data_nascimento: dateBRtoISO(form.data_nascimento) ?? "",
        genero: form.genero,
        estado_civil: form.estado_civil,
        telefone: onlyDigits(form.telefone),
        email: form.email.trim().toLowerCase(),
        cep: onlyDigits(form.cep),
        rua: form.rua.trim(),
        bairro: form.bairro.trim(),
        numero: form.numero.trim(),
        profissao: form.profissao.trim(),
        escolaridade: form.escolaridade,
      },
    });
    setSaving(false);
    if (error || !data) {
      toast.error("Não foi possível concluir o cadastro. O link pode ter expirado.");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mb-4 flex justify-center">
            <OdontoLogo size={48} />
          </div>
          <h1 className="text-xl font-semibold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de cadastro não existe ou expirou. Solicite um novo à clínica.
          </p>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" />
          <h1 className="text-xl font-semibold">Cadastro concluído!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Obrigado. Seus dados foram enviados à clínica com sucesso.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8">
      <main className="mx-auto max-w-2xl px-4">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <OdontoLogo size={48} />
          <h1 className="text-2xl font-bold">Complete seu cadastro</h1>
          <p className="text-sm text-muted-foreground">
            Confira e complete seus dados. Eles serão enviados diretamente à clínica.
          </p>
        </div>

        <Card className="grid gap-4 p-6">
          <div className="grid gap-1.5">
            <Label>Nome completo *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: filterNomeInput(e.target.value) }))}
              placeholder="Seu nome completo"
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
              <Label>RG</Label>
              <Input
                value={form.rg}
                onChange={(e) => setForm((f) => ({ ...f, rg: maskRG(e.target.value) }))}
                placeholder="00.000.000-0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="nome@exemplo.com"
              />
            </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Estado civil</Label>
              <Select
                value={form.estado_civil}
                onValueChange={(v) => setForm((f) => ({ ...f, estado_civil: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVIS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Escolaridade</Label>
              <Select
                value={form.escolaridade}
                onValueChange={(v) => setForm((f) => ({ ...f, escolaridade: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESCOLARIDADES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Profissão</Label>
            <Input
              value={form.profissao}
              onChange={(e) => setForm((f) => ({ ...f, profissao: e.target.value }))}
              placeholder="Ex.: Professor"
            />
          </div>

          <Button size="lg" onClick={submit} disabled={saving} className="mt-2 gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Concluir cadastro
          </Button>
        </Card>
      </main>
    </div>
  );
}
