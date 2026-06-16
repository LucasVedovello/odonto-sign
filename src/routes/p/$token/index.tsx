import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEXO_OPTIONS, TREATMENT_LABEL, type TreatmentType } from "@/lib/contracts";
import {
  maskCPF,
  maskRG,
  maskDate,
  maskPhone,
  dateBRtoISO,
  isValidCPF,
  isValidEmail,
  isValidDate,
  isValidPhone,
} from "@/lib/masks";

export const Route = createFileRoute("/p/$token/")({
  component: PatientFillFlow,
  head: () => ({ meta: [{ title: "Preenchimento — OdontoSign" }] }),
});

type Person = {
  nome: string;
  nascimento: string;
  cpf: string;
  rg: string;
  profissao: string;
  sexo: string;
  endereco: string;
  telefone: string;
  celular: string;
  email: string;
};

const EMPTY_PERSON: Person = {
  nome: "",
  nascimento: "",
  cpf: "",
  rg: "",
  profissao: "",
  sexo: "",
  endereco: "",
  telefone: "",
  celular: "",
  email: "",
};

function PatientFillFlow() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<{
    id: string;
    treatment_type: string;
    status: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [contratante, setContratante] = useState<Person>(EMPTY_PERSON);
  const [paciente, setPaciente] = useState<Person>(EMPTY_PERSON);
  const [mesmo, setMesmo] = useState(true);
  const [ref1, setRef1] = useState({ nome: "", telefone: "" });
  const [ref2, setRef2] = useState({ nome: "", telefone: "" });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id,treatment_type,status")
        .eq("patient_token", token)
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      setContract(data);
      if (data.status !== "aguardando_paciente") setDone(true);
      setLoading(false);
    })();
  }, [token]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!contratante.nome.trim()) e.push("nome do contratante");
    if (contratante.cpf && !isValidCPF(contratante.cpf)) e.push("CPF do contratante");
    if (contratante.email && !isValidEmail(contratante.email)) e.push("email do contratante");
    if (contratante.nascimento && !isValidDate(contratante.nascimento))
      e.push("nascimento do contratante");
    if (contratante.celular && !isValidPhone(contratante.celular)) e.push("celular do contratante");
    if (!mesmo && !paciente.nome.trim()) e.push("nome do paciente");
    return e;
  }, [contratante, paciente, mesmo]);

  const submit = async () => {
    if (errors.length) {
      toast.error(`Verifique: ${errors.join(", ")}`);
      return;
    }
    setSaving(true);
    const src = mesmo ? contratante : paciente;
    const payload = {
      contratante_nome: contratante.nome.trim(),
      contratante_nascimento: dateBRtoISO(contratante.nascimento),
      contratante_cpf: contratante.cpf || null,
      contratante_rg: contratante.rg || null,
      contratante_profissao: contratante.profissao || null,
      contratante_sexo: contratante.sexo || null,
      contratante_endereco: contratante.endereco || null,
      contratante_telefone: contratante.telefone || null,
      contratante_celular: contratante.celular || null,
      contratante_email: contratante.email.trim().toLowerCase() || null,
      paciente_nome: src.nome.trim(),
      paciente_nascimento: dateBRtoISO(src.nascimento),
      paciente_cpf: src.cpf || null,
      paciente_rg: src.rg || null,
      paciente_profissao: src.profissao || null,
      paciente_sexo: src.sexo || null,
      paciente_endereco: src.endereco || null,
      paciente_telefone: src.telefone || null,
      paciente_celular: src.celular || null,
      paciente_email: src.email.trim().toLowerCase() || null,
      referencia_1_nome: ref1.nome || null,
      referencia_1_telefone: ref1.telefone || null,
      referencia_2_nome: ref2.nome || null,
      referencia_2_telefone: ref2.telefone || null,
      status: "aguardando_recepcao" as const,
    };
    const { error } = await supabase.from("contracts").update(payload).eq("patient_token", token);
    setSaving(false);
    if (error) {
      toast.error("Erro ao enviar dados");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (!contract)
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold">Link inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link não existe ou expirou. Solicite um novo à recepção.
          </p>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen">
      <PublicHeader subtitle={TREATMENT_LABEL[contract.treatment_type as TreatmentType]} />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {done ? (
          <Card className="mt-2 p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Dados enviados com sucesso!</h2>
            <p className="mt-2 text-sm text-muted-foreground">A clínica entrará em contato.</p>
          </Card>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Seus dados</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha as informações abaixo para o contrato.
            </p>

            {/* Contratante */}
            <Card className="mt-5 p-5 sm:p-6">
              <SectionTitle>Dados do Contratante</SectionTitle>
              <PersonFields value={contratante} onChange={setContratante} />
            </Card>

            {/* Paciente */}
            <Card className="mt-4 p-5 sm:p-6">
              <SectionTitle>Dados do Paciente</SectionTitle>
              <label className="mt-1 flex cursor-pointer items-center gap-2.5">
                <Checkbox checked={mesmo} onCheckedChange={(v) => setMesmo(!!v)} />
                <span className="text-sm">O paciente é o mesmo que o contratante</span>
              </label>
              {!mesmo && (
                <div className="mt-4">
                  <PersonFields value={paciente} onChange={setPaciente} />
                </div>
              )}
            </Card>

            {/* Referências */}
            <Card className="mt-4 p-5 sm:p-6">
              <SectionTitle>Referências Pessoais</SectionTitle>
              <div className="mt-3 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Referência 1 — Nome"
                    value={ref1.nome}
                    onChange={(v) => setRef1((r) => ({ ...r, nome: v }))}
                  />
                  <Field
                    label="Referência 1 — Telefone"
                    value={ref1.telefone}
                    onChange={(v) => setRef1((r) => ({ ...r, telefone: maskPhone(v) }))}
                    inputMode="tel"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Referência 2 — Nome"
                    value={ref2.nome}
                    onChange={(v) => setRef2((r) => ({ ...r, nome: v }))}
                  />
                  <Field
                    label="Referência 2 — Telefone"
                    value={ref2.telefone}
                    onChange={(v) => setRef2((r) => ({ ...r, telefone: maskPhone(v) }))}
                    inputMode="tel"
                  />
                </div>
              </div>
            </Card>

            <Button onClick={submit} disabled={saving} size="lg" className="mt-6 w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar dados"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

export function PublicHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
        <img
          src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/logo.jpg"
          alt="OdontoClinic"
          className="h-10 w-10 rounded-lg object-contain"
        />
        <div>
          <h1 className="text-base font-semibold leading-tight">OdontoClinic</h1>
          <p className="text-xs text-muted-foreground">{subtitle || "Contrato digital"}</p>
        </div>
      </div>
    </header>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">{children}</h3>;
}

function PersonFields({ value, onChange }: { value: Person; onChange: (v: Person) => void }) {
  const set = (patch: Partial<Person>) => onChange({ ...value, ...patch });
  return (
    <div className="mt-3 grid gap-4">
      <Field label="Nome completo" value={value.nome} onChange={(v) => set({ nome: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Data de nascimento"
          value={value.nascimento}
          onChange={(v) => set({ nascimento: maskDate(v) })}
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
        />
        <SelectField label="Sexo" value={value.sexo} onChange={(v) => set({ sexo: v })}>
          <option value="">Selecione...</option>
          {SEXO_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="CPF"
          value={value.cpf}
          onChange={(v) => set({ cpf: maskCPF(v) })}
          placeholder="000.000.000-00"
          inputMode="numeric"
        />
        <Field
          label="RG"
          value={value.rg}
          onChange={(v) => set({ rg: maskRG(v) })}
          placeholder="00.000.000-X"
        />
      </div>
      <Field label="Profissão" value={value.profissao} onChange={(v) => set({ profissao: v })} />
      <Field label="Endereço" value={value.endereco} onChange={(v) => set({ endereco: v })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Telefone"
          value={value.telefone}
          onChange={(v) => set({ telefone: maskPhone(v) })}
          inputMode="tel"
        />
        <Field
          label="Celular"
          value={value.celular}
          onChange={(v) => set({ celular: maskPhone(v) })}
          inputMode="tel"
        />
        <Field
          label="Email"
          value={value.email}
          onChange={(v) => set({ email: v.replace(/\s/g, "") })}
          inputMode="email"
          type="email"
        />
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        {children}
      </select>
    </div>
  );
}
