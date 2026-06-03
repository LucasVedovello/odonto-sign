import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Stethoscope, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/criar-empresa")({
  component: CreateCompanyPage,
  head: () => ({ meta: [{ title: "Criar empresa — OdontoClinic" }] }),
});

function CreateCompanyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    company_name: "", first_name: "", last_name: "", email: "", password: "", confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Senha deve ter pelo menos 8 caracteres"); return; }
    if (form.password !== form.confirm) { toast.error("As senhas não coincidem"); return; }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          company_name: form.company_name,
          first_name: form.first_name,
          last_name: form.last_name,
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }

    // Notify admin directly via edge function (no server function wrapper that could fail silently)
    // The edge function looks up the companyId internally via service role
    try {
      const { error: fnError } = await supabase.functions.invoke("notify-new-company", {
        body: {
          companyName: form.company_name,
          ownerName: `${form.first_name} ${form.last_name}`.trim(),
          ownerEmail: form.email,
          createdAt: new Date().toISOString(),
        },
      });
      if (fnError) console.error("[criar-empresa] notify-new-company error:", fnError);
      else console.log("[criar-empresa] notify-new-company invocado com sucesso");
    } catch (e) {
      console.error("[criar-empresa] Erro ao notificar admin:", e);
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Solicitação enviada!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua solicitação foi recebida. Você receberá um email em{" "}
            <strong>{form.email}</strong> para confirmar seu cadastro.
          </p>
          <p className="mt-3 text-sm font-medium text-warning">
            Aguarde a aprovação do administrador antes de fazer login. Você será notificado por email quando sua clínica for aprovada.
          </p>
          <Button onClick={() => navigate({ to: "/login" })} className="mt-6 w-full">Voltar para o login</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
               style={{ background: "var(--gradient-clinical)" }}>
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Criar empresa</h1>
          <p className="text-sm text-muted-foreground -mt-2">Cadastre sua clínica em 1 minuto</p>
        </div>

        <Card className="p-6 sm:p-8 shadow-[var(--shadow-lift)]">
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Nome da empresa</Label>
              <Input required value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Clínica Exemplo" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nome</Label>
                <Input required value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Sobrenome</Label>
                <Input required value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Senha</Label>
                <Input type="password" required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Confirmar senha</Label>
                <Input type="password" required value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
              </div>
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar empresa"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
