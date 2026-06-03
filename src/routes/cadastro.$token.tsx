import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PenLine, Eraser } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { CONTRACT_TEXT } from "@/lib/pdf";
import {
  maskCPF, maskRG, maskDate, maskPhone, maskCEP, fetchViaCEP, filterNomeInput,
  isValidCPF, isValidRG, isValidDate, isValidPhone, isValidEmail, isValidNome,
  dateBRtoISO, dateISOtoBR,
} from "@/lib/masks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cadastro/$token")({
  component: PatientFlow,
  head: () => ({ meta: [{ title: "Cadastro do Paciente — OdontoClinic" }] }),
});

type Step = "form" | "contract" | "signature" | "done"; // "signature" kept for backward compat

type FormState = {
  nome: string; cpf: string; rg: string; data_nascimento: string;
  estado_civil: string; estado_nascimento: string;
  telefone: string; email: string;
  cep: string; rua: string; bairro: string; numero: string;
  profissao: string; escolaridade: string;
};

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

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

const EMPTY: FormState = {
  nome: "", cpf: "", rg: "", data_nascimento: "",
  estado_civil: "", estado_nascimento: "",
  telefone: "", email: "",
  cep: "", rua: "", bairro: "", numero: "",
  profissao: "", escolaridade: "",
};

// Procedure terms shown to the patient on the contract step
const TERMOS_MAP: Record<string, { titulo: string; clausulas: string[] }> = {
  protese: {
    titulo: "Contrato de Prótese Dentária",
    clausulas: [
      "Cláusula 1 — Do Objeto: A clínica se compromete a realizar o procedimento de prótese dentária conforme planejamento clínico previamente apresentado e aceito pelo paciente, utilizando materiais de qualidade compatíveis com o procedimento indicado.",
      "Cláusula 2 — Do Prazo: O prazo estimado para conclusão do tratamento será informado pelo profissional responsável na consulta de avaliação, podendo ser alterado em razão de fatores clínicos supervenientes.",
      "Cláusula 3 — Da Garantia: A prótese instalada possui garantia de 12 (doze) meses contra defeitos de fabricação, desde que o paciente siga as orientações de higiene e conservação fornecidas pela equipe clínica.",
      "Cláusula 4 — Das Obrigações do Paciente: O paciente se compromete a comparecer a todas as consultas agendadas, comunicar imediatamente qualquer desconforto e seguir as orientações pós-instalação.",
      "Cláusula 5 — Do Pagamento: Os valores e condições de pagamento foram acordados previamente. O não pagamento nas datas acordadas poderá implicar na suspensão do tratamento.",
    ],
  },
  implante: {
    titulo: "Contrato de Implante Dentário",
    clausulas: [
      "Cláusula 1 — Do Objeto: A clínica se compromete a realizar o procedimento de implante dentário osseointegrado conforme planejamento cirúrgico aprovado, utilizando implantes de titânio certificados.",
      "Cláusula 2 — Dos Riscos: O paciente declara estar ciente de que o sucesso do implante depende de fatores biológicos individuais, incluindo qualidade óssea, higiene bucal e ausência de doenças sistêmicas não controladas.",
      "Cláusula 3 — Do Período de Osseointegração: Após a instalação, será necessário aguardar entre 3 e 6 meses para osseointegração. O paciente deverá seguir todas as orientações e comparecer às consultas de acompanhamento.",
      "Cláusula 4 — Da Garantia: O implante possui garantia de 5 (cinco) anos contra falha de osseointegração primária, condicionada ao seguimento das orientações pós-operatórias.",
      "Cláusula 5 — Das Obrigações do Paciente: O paciente se compromete a não fumar durante a osseointegração, manter higiene bucal rigorosa e comunicar qualquer sintoma de dor intensa ou mobilidade do implante.",
      "Cláusula 6 — Do Pagamento: Os valores foram acordados previamente. A inadimplência poderá resultar na suspensão do tratamento.",
    ],
  },
  ortho: {
    titulo: "Contrato de Ortodontia",
    clausulas: [
      "Cláusula 1 — Do Objeto: A clínica se compromete a realizar o tratamento ortodôntico conforme planejamento apresentado, utilizando aparelhos e materiais adequados ao caso clínico.",
      "Cláusula 2 — Do Prazo: O prazo estimado será informado pelo profissional, podendo variar conforme resposta biológica do paciente e colaboração nos comparecimentos.",
      "Cláusula 3 — Das Obrigações do Paciente: O paciente se compromete a comparecer às consultas mensais, usar os elásticos conforme orientado, evitar alimentos que danifiquem o aparelho e manter higiene bucal rigorosa.",
      "Cláusula 4 — Da Contenção Pós-Tratamento: Ao término do tratamento, o paciente deverá utilizar contenção pelo período indicado. O não uso pode resultar em recidiva, sem responsabilidade da clínica.",
      "Cláusula 5 — Da Garantia: A clínica se responsabiliza pela qualidade técnica. Quebras por mau uso poderão gerar custos adicionais.",
      "Cláusula 6 — Do Pagamento: Inadimplência por mais de 30 dias poderá resultar na suspensão das manutenções.",
    ],
  },
};

const PROC_LABELS: Record<string, string> = {
  protese:  "Prótese",
  implante: "Implante",
  ortho:    "Ortodontia",
};

function PatientFlow() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);
  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  // Procedures requested for this link (read once from URL query params)
  const proc = useMemo(() => {
    if (typeof window === "undefined") return [];
    const raw = new URL(window.location.href).searchParams.get("proc");
    return raw ? raw.split(",").filter((p) => p in PROC_LABELS) : [];
  }, []);

  // One checked state per extra procedure
  const [procAccepted, setProcAccepted] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("token", token).maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setPatient(data);
      if (data.signature_data) {
        setStep("done");
      } else if (data.nome) {
        setForm({
          nome: data.nome || "",
          cpf: data.cpf ? maskCPF(data.cpf) : "",
          rg: data.rg ? maskRG(data.rg) : "",
          data_nascimento: dateISOtoBR(data.data_nascimento),
          estado_civil: data.estado_civil || "",
          estado_nascimento: data.estado_nascimento || "",
          telefone: data.telefone ? maskPhone(data.telefone) : "",
          email: data.email || "",
          cep: data.cep ? maskCEP(data.cep) : "",
          rua: data.rua || "",
          bairro: data.bairro || "",
          numero: data.numero || "",
          profissao: data.profissao || "",
          escolaridade: data.escolaridade || "",
        });
        setStep("contract");
      }
      setLoading(false);
    })();
  }, [token]);

  const handleCEPChange = async (raw: string) => {
    const masked = maskCEP(raw);
    setForm((f) => ({ ...f, cep: masked }));
    if (raw.replace(/\D/g, "").length === 8) {
      setCepLoading(true);
      const result = await fetchViaCEP(masked);
      setCepLoading(false);
      if (result) {
        setForm((f) => ({ ...f, rua: result.logradouro, bairro: result.bairro }));
      }
    }
  };

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.nome && !isValidNome(form.nome)) e.nome = "Digite seu nome completo (apenas letras)";
    if (form.cpf && !isValidCPF(form.cpf)) e.cpf = "CPF inválido";
    if (form.rg && !isValidRG(form.rg)) e.rg = "RG inválido";
    if (form.data_nascimento && !isValidDate(form.data_nascimento)) e.data_nascimento = "Data inválida";
    if (form.telefone && !isValidPhone(form.telefone)) e.telefone = "Telefone inválido";
    if (form.email && !isValidEmail(form.email)) e.email = "Email inválido";
    return e;
  }, [form]);

  const requiredFilled =
    form.nome && form.cpf && form.rg && form.data_nascimento &&
    form.estado_civil && form.estado_nascimento &&
    form.telefone && form.email &&
    form.cep && form.rua && form.bairro && form.numero &&
    form.profissao && form.escolaridade;

  const canSubmit = requiredFilled && Object.keys(errors).length === 0;

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const allKeys = Object.keys(EMPTY) as (keyof FormState)[];
    setTouched(Object.fromEntries(allKeys.map((k) => [k, true])));
    if (!canSubmit) { toast.error("Verifique os campos destacados"); return; }
    setSaving(true);
    const endereco = `${form.rua}, ${form.numero} - ${form.bairro}, CEP: ${form.cep}`;
    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf,
      rg: form.rg,
      data_nascimento: dateBRtoISO(form.data_nascimento),
      estado_civil: form.estado_civil,
      estado_nascimento: form.estado_nascimento,
      telefone: form.telefone,
      email: form.email.trim().toLowerCase(),
      cep: form.cep,
      rua: form.rua.trim(),
      bairro: form.bairro.trim(),
      numero: form.numero.trim(),
      endereco,
      profissao: form.profissao.trim(),
      escolaridade: form.escolaridade,
    };
    const { error } = await supabase.from("patients").update(payload).eq("token", token);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar dados"); return; }
    setStep("contract");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitSignature = async () => {
    if (!accepted || proc.some((p) => !procAccepted[p])) {
      toast.error("Confirme todos os termos antes de finalizar");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Por favor, assine antes de finalizar");
      return;
    }
    setSaving(true);
    const dataUrl = sigRef.current.toDataURL();
    const { error } = await supabase.from("patients").update({
      contract_accepted: true,
      signature_data: dataUrl, // backward compat
      assinatura: dataUrl,     // new field — used in all PDF signature blocks
      signed_at: new Date().toISOString(),
      status: "assinado",
    }).eq("token", token);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar assinatura"); return; }
    setStep("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (!patient) return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Link inválido</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link de cadastro não existe ou já expirou. Solicite um novo à recepção.
        </p>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <img
            src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png"
            alt="OdontoSistema"
            className="h-10 w-10 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-base font-semibold leading-tight">OdontoClinic</h1>
            <p className="text-xs text-muted-foreground">
              {patient.prontuario ? `Prontuário ${patient.prontuario}` : "Cadastro digital"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <Stepper step={step} />

        {step === "form" && (
          <Card className="mt-6 p-5 sm:p-8 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold">Seus dados</h2>
            <p className="mt-1 text-sm text-muted-foreground">Preencha as informações abaixo.</p>
            <form onSubmit={submitForm} className="mt-6 grid gap-5" noValidate>

              {/* Identificação */}
              <Section title="Identificação" />
              <Field label="Nome completo" required
                value={form.nome} placeholder="João da Silva"
                onChange={(v) => setForm((f) => ({ ...f, nome: filterNomeInput(v) }))}
                onBlur={() => setTouched((t) => ({ ...t, nome: true }))}
                error={touched.nome ? errors.nome : undefined} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CPF" required value={form.cpf} placeholder="000.000.000-00"
                  onChange={(v) => setForm((f) => ({ ...f, cpf: maskCPF(v) }))}
                  onBlur={() => setTouched((t) => ({ ...t, cpf: true }))}
                  error={touched.cpf ? errors.cpf : undefined} inputMode="numeric" />
                <Field label="RG" required value={form.rg} placeholder="00.000.000-X"
                  onChange={(v) => setForm((f) => ({ ...f, rg: maskRG(v) }))}
                  onBlur={() => setTouched((t) => ({ ...t, rg: true }))}
                  error={touched.rg ? errors.rg : undefined} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data de nascimento" required value={form.data_nascimento} placeholder="DD/MM/AAAA"
                  onChange={(v) => setForm((f) => ({ ...f, data_nascimento: maskDate(v) }))}
                  onBlur={() => setTouched((t) => ({ ...t, data_nascimento: true }))}
                  error={touched.data_nascimento ? errors.data_nascimento : undefined} inputMode="numeric" />
                <SelectField label="Estado onde nasceu" required
                  value={form.estado_nascimento}
                  onChange={(v) => setForm((f) => ({ ...f, estado_nascimento: v }))}
                  error={touched.estado_nascimento && !form.estado_nascimento ? "Selecione um estado" : undefined}>
                  <option value="">Selecione...</option>
                  {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </SelectField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Estado civil" required
                  value={form.estado_civil}
                  onChange={(v) => setForm((f) => ({ ...f, estado_civil: v }))}
                  error={touched.estado_civil && !form.estado_civil ? "Selecione" : undefined}>
                  <option value="">Selecione...</option>
                  {ESTADOS_CIVIS.map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectField>
                <Field label="Profissão" required value={form.profissao} placeholder="Ex: Advogado, Professor..."
                  onChange={(v) => setForm((f) => ({ ...f, profissao: v }))}
                  onBlur={() => setTouched((t) => ({ ...t, profissao: true }))}
                  error={touched.profissao && !form.profissao ? "Campo obrigatório" : undefined} />
              </div>

              <SelectField label="Escolaridade" required
                value={form.escolaridade}
                onChange={(v) => setForm((f) => ({ ...f, escolaridade: v }))}
                error={touched.escolaridade && !form.escolaridade ? "Selecione" : undefined}>
                <option value="">Selecione...</option>
                {ESCOLARIDADES.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectField>

              {/* Contato */}
              <Section title="Contato" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone" required value={form.telefone} placeholder="(00) 00000-0000"
                  onChange={(v) => setForm((f) => ({ ...f, telefone: maskPhone(v) }))}
                  onBlur={() => setTouched((t) => ({ ...t, telefone: true }))}
                  error={touched.telefone ? errors.telefone : undefined} inputMode="tel" />
                <Field label="Email" required value={form.email} placeholder="nome@exemplo.com"
                  onChange={(v) => setForm((f) => ({ ...f, email: v.replace(/\s/g, "") }))}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  error={touched.email ? errors.email : undefined} inputMode="email" type="email" />
              </div>

              {/* Endereço */}
              <Section title="Endereço" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>CEP <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      value={form.cep} placeholder="00000-000" inputMode="numeric"
                      onChange={(e) => handleCEPChange(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, cep: true }))}
                      className={cn(touched.cep && !form.cep && "border-destructive focus-visible:ring-destructive/40")}
                    />
                    {cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {touched.cep && !form.cep && <p className="text-xs text-destructive">CEP obrigatório</p>}
                </div>
                <Field label="Número" required value={form.numero} placeholder="123"
                  onChange={(v) => setForm((f) => ({ ...f, numero: v }))}
                  onBlur={() => setTouched((t) => ({ ...t, numero: true }))}
                  error={touched.numero && !form.numero ? "Campo obrigatório" : undefined} />
              </div>

              <Field label="Rua" required value={form.rua} placeholder="Preenchida pelo CEP"
                onChange={(v) => setForm((f) => ({ ...f, rua: v }))}
                onBlur={() => setTouched((t) => ({ ...t, rua: true }))}
                error={touched.rua && !form.rua ? "Campo obrigatório" : undefined} />

              <Field label="Bairro" required value={form.bairro} placeholder="Preenchido pelo CEP"
                onChange={(v) => setForm((f) => ({ ...f, bairro: v }))}
                onBlur={() => setTouched((t) => ({ ...t, bairro: true }))}
                error={touched.bairro && !form.bairro ? "Campo obrigatório" : undefined} />

              <Button type="submit" size="lg" disabled={saving} className="mt-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
              </Button>
            </form>
          </Card>
        )}

        {step === "contract" && (
          <Card className="mt-6 p-5 sm:p-8 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold">Contrato</h2>
            <p className="mt-1 text-sm text-muted-foreground">Leia atentamente antes de prosseguir.</p>
            <div className="mt-5 max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-line">
              {CONTRACT_TEXT}
            </div>
            <label className="mt-5 flex items-start gap-3 cursor-pointer">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} className="mt-0.5" />
              <span className="text-sm">Li e concordo com os termos do contrato.</span>
            </label>

            {/* Extra procedure terms + checkboxes — one block per selected procedure */}
            {proc.map((p) => {
              const termos = TERMOS_MAP[p];
              if (!termos) return null;
              return (
                <div key={p} className="mt-4 rounded-lg border border-border">
                  <div className="border-b border-border bg-muted/30 px-4 py-2.5">
                    <p className="text-sm font-semibold">{termos.titulo}</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto px-4 py-3 space-y-2 bg-muted/20">
                    {termos.clausulas.map((c, i) => (
                      <p key={i} className="text-xs leading-relaxed text-muted-foreground">{c}</p>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-border">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={!!procAccepted[p]}
                        onCheckedChange={(v) => setProcAccepted((prev) => ({ ...prev, [p]: !!v }))}
                        className="mt-0.5"
                      />
                      <span className="text-sm font-medium">
                        Li e concordo com os termos do {termos.titulo}.
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}

            {/* Signature canvas — same signature applies to all contracts */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-1">
                <PenLine className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Assinatura digital</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Assine abaixo com o dedo ou mouse. A mesma assinatura será aplicada a todos os contratos.
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-white dark:bg-background overflow-hidden">
                <SignaturePad ref={sigRef} className="block h-44 w-full" />
              </div>
              <div className="mt-1.5 flex justify-end">
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => sigRef.current?.clear()}
                  className="gap-1.5 text-xs text-muted-foreground h-7">
                  <Eraser className="h-3.5 w-3.5" /> Limpar assinatura
                </Button>
              </div>
            </div>

            <Button
              onClick={submitSignature}
              disabled={saving || !accepted || proc.some((p) => !procAccepted[p])}
              size="lg"
              className="mt-6 w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar cadastro"}
            </Button>
          </Card>
        )}

        {/* "signature" step kept for backward compat — redirect to contract if somehow reached */}
        {step === "signature" && (
          <Card className="mt-6 p-8 text-center shadow-[var(--shadow-card)]">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
          </Card>
        )}

        {step === "done" && (
          <Card className="mt-6 p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Cadastro finalizado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Obrigado! Seu contrato foi assinado e enviado à clínica. Você já pode fechar esta página.
            </p>
            {patient.prontuario && (
              <p className="mt-4 font-mono text-xs text-muted-foreground">{patient.prontuario}</p>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="-mb-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-1 h-px bg-border" />
    </div>
  );
}

function Field({ label, value, onChange, onBlur, required, error, placeholder, inputMode, type }: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; required?: boolean; error?: string;
  placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; type?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value} placeholder={placeholder} inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        className={cn(error && "border-destructive focus-visible:ring-destructive/40")} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, required, error, children }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          error && "border-destructive focus-visible:ring-destructive/40"
        )}>
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "form", label: "Dados" },
    { id: "contract", label: "Contrato e Assinatura" },
  ];
  // "signature" step maps to contract (backward compat); "done" is past all steps
  const rawIdx = steps.findIndex((s) => s.id === step);
  const idx = step === "done" ? steps.length : rawIdx === -1 ? 1 : rawIdx;
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = i === idx, done = i < idx;
        return (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${done ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {done ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${done ? "bg-success" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}
