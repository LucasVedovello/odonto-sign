import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — OdontoClinic" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Email not confirmed"
        ? "Confirme seu email antes de entrar"
        : "Email ou senha inválidos");
      return;
    }
    navigate({ to: "/" });
  };

  const forgot = async () => {
    if (!email) { toast.error("Informe seu email primeiro"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error("Erro ao enviar email");
    else toast.success("Email de recuperação enviado");
  };

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
        <img
          src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png"
          alt="OdontoClinic Dashboard"
          className="w-full h-full object-cover object-top rounded-xl"
        />
      </ContainerScroll>

      <div className="flex items-center justify-center px-4 pb-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src="https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png"
            alt="OdontoSistema"
            className="h-14 w-14 rounded-2xl object-contain shadow-[var(--shadow-lift)]"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold">OdontoClinic</h1>
            <p className="text-sm text-muted-foreground">Acesso da equipe</p>
          </div>
        </div>

        <Card className="p-6 sm:p-8 shadow-[var(--shadow-lift)]">
          <h2 className="text-lg font-semibold">Entrar</h2>
          <p className="text-sm text-muted-foreground">Acesse o painel da sua clínica.</p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button type="button" onClick={forgot} className="text-xs text-primary hover:underline">
                  Esqueci a senha
                </button>
              </div>
              <Input id="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/criar-empresa" className="font-medium text-primary hover:underline">
              Criar empresa
            </Link>
          </p>
        </Card>
      </div>
      </div>
    </div>
  );
}
