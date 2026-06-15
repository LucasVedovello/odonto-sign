import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/aceitar-convite")({
  component: AcceptInvitePage,
  head: () => ({ meta: [{ title: "Aceitar convite — OdontoSign" }] }),
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-handles tokens in URL hash via detectSessionInUrl
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setReady(true);
      else {
        // Wait a moment for hash to be processed
        setTimeout(async () => {
          const { data: d2 } = await supabase.auth.getUser();
          if (d2.user) setReady(true);
          else { toast.error("Convite inválido ou expirado"); navigate({ to: "/login" }); }
        }, 800);
      }
    };
    check();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Senha deve ter pelo menos 8 caracteres"); return; }
    if (form.password !== form.confirm) { toast.error("As senhas não coincidem"); return; }
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    const { error } = await supabase.auth.updateUser({
      password: form.password,
      data: { first_name: form.first_name, last_name: form.last_name },
    });

    if (!error && uid) {
      await supabase.from("profiles").update({
        first_name: form.first_name, last_name: form.last_name, status: "active",
      }).eq("id", uid);
    }

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta ativada!");
    navigate({ to: "/" });
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
          <h1 className="text-2xl font-bold">Bem-vindo!</h1>
          <p className="text-sm text-muted-foreground -mt-2">Complete seu cadastro para começar</p>
        </div>

        <Card className="p-6 sm:p-8 shadow-[var(--shadow-lift)]">
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nome</Label>
                <Input required autoFocus value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Sobrenome</Label>
                <Input required value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
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
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar conta"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
