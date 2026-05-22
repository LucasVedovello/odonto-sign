import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Stethoscope, PenLine, Eraser } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { CONTRACT_TEXT } from "@/lib/pdf";

export const Route = createFileRoute("/cadastro/$token")({
  component: PatientFlow,
  head: () => ({ meta: [{ title: "Cadastro do Paciente — OdontoClinic" }] }),
});

type Step = "form" | "contract" | "signature" | "done";

function PatientFlow() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);
  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const [form, setForm] = useState({
    nome: "", cpf: "", rg: "", endereco: "", telefone: "", convenio: "",
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setPatient(data);
      if (data.signature_data) setStep("done");
      else if (data.nome) {
        setForm({
          nome: data.nome || "", cpf: data.cpf || "", rg: data.rg || "",
          endereco: data.endereco || "", telefone: data.telefone || "",
          convenio: data.convenio || "",
        });
        setStep("contract");
      }
      setLoading(false);
    })();
  }, [token]);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.cpf.trim()) {
      toast.error("Preencha pelo menos nome e CPF");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("patients").update(form).eq("token", token);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar dados"); return; }
    setStep("contract");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitSignature = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Por favor, assine antes de finalizar");
      return;
    }
    setSaving(true);
    const dataUrl = sigRef.current.toDataURL();
    const { error } = await supabase
      .from("patients")
      .update({
        contract_accepted: true,
        signature_data: dataUrl,
        signed_at: new Date().toISOString(),
        status: "assinado",
      })
      .eq("token", token);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar assinatura"); return; }
    setStep("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold">Link inválido</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de cadastro não existe ou já expirou. Solicite um novo à recepção.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-clinical)" }}
          >
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">OdontoClinic</h1>
            <p className="text-xs text-muted-foreground">Prontuário {patient.prontuario}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        <Stepper step={step} />

        {step === "form" && (
          <Card className="mt-6 p-5 sm:p-8 shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold">Seus dados</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha as informações abaixo. Leva menos de 2 minutos.
            </p>
            <form onSubmit={submitForm} className="mt-6 grid gap-4">
              <Field label="Nome completo" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} required />
                <Field label="RG" value={form.rg} onChange={(v) => setForm({ ...form, rg: v })} />
              </div>
              <Field label="Endereço" value={form.endereco} onChange={(v) => setForm({ ...form, endereco: v })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
                <Field label="Convênio" value={form.convenio} onChange={(v) => setForm({ ...form, convenio: v })} />
              </div>
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
            <Button
              onClick={() => setStep("signature")}
              disabled={!accepted}
              size="lg"
              className="mt-6 w-full"
            >
              Avançar para assinatura
            </Button>
          </Card>
        )}

        {step === "signature" && (
          <Card className="mt-6 p-5 sm:p-8 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Assinatura digital</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Assine no quadro abaixo usando o dedo ou o mouse.
            </p>
            <div className="mt-5 rounded-xl border-2 border-dashed border-border bg-background">
              <SignaturePad ref={sigRef} className="block h-56 w-full rounded-xl" />
            </div>
            <div className="mt-3 flex justify-between gap-3">
              <Button variant="ghost" onClick={() => sigRef.current?.clear()} className="gap-2">
                <Eraser className="h-4 w-4" /> Limpar
              </Button>
              <Button onClick={submitSignature} disabled={saving} size="lg" className="flex-1 sm:flex-initial">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar cadastro"}
              </Button>
            </div>
          </Card>
        )}

        {step === "done" && (
          <Card className="mt-6 p-8 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">Cadastro finalizado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Obrigado! Seu contrato foi assinado e enviado à clínica.
              Você já pode fechar esta página.
            </p>
            <p className="mt-4 font-mono text-xs text-muted-foreground">{patient.prontuario}</p>
          </Card>
        )}
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, required,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "form", label: "Dados" },
    { id: "contract", label: "Contrato" },
    { id: "signature", label: "Assinatura" },
  ];
  const idx = step === "done" ? 3 : steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s.id} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                done ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
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
