import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OdontoLogo } from "@/components/OdontoLogo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/aceitar-convite")({
  component: AcceptInvitePage,
  head: () => ({ meta: [{ title: "Aceitar convite — OdontoSign" }] }),
});

const INVALID_INVITE =
  "Convite inválido ou expirado. Solicite um novo convite ao administrador da clínica.";

function AcceptInvitePage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  // Estabelece a sessão a partir do link do convite e carrega o nome da
  // clínica que convidou (para a mensagem de boas-vindas).
  useEffect(() => {
    let active = true;

    const init = async () => {
      const qs = new URLSearchParams(window.location.search);
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hs = new URLSearchParams(hash);

      // Supabase pode sinalizar erro no link (ex.: convite expirado).
      if (qs.get("error_description") || hs.get("error_description")) {
        toast.error(INVALID_INVITE);
        navigate({ to: "/login" });
        return;
      }

      // Fluxo verifyOtp: link com ?token_hash=...&type=invite.
      const tokenHash = qs.get("token_hash");
      if (tokenHash) {
        const type = (qs.get("type") as EmailOtpType) || "invite";
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          if (import.meta.env.DEV) console.error("[aceitar-convite] verifyOtp:", error.message);
          toast.error(INVALID_INVITE);
          navigate({ to: "/login" });
          return;
        }
      }
      // Demais casos (#access_token ou ?code=) já são processados pelo
      // detectSessionInUrl do client. Confirmamos a sessão abaixo, com
      // pequena retentativa para dar tempo ao processamento do hash.

      let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
      for (let i = 0; i < 5 && !user; i++) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
        if (!user) await new Promise((r) => setTimeout(r, 400));
      }

      if (!active) return;
      if (!user) {
        toast.error(INVALID_INVITE);
        navigate({ to: "/login" });
        return;
      }

      setEmail(user.email ?? "");

      // Nome da clínica: prioriza o id gravado no convite (user_metadata),
      // com fallback no company_id do perfil já criado pelo trigger.
      let companyId = (user.user_metadata?.invite_company_id as string | undefined) ?? undefined;
      if (!companyId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();
        companyId = prof?.company_id ?? undefined;
      }
      if (companyId) {
        const { data: comp } = await supabase
          .from("companies")
          .select("company_name")
          .eq("id", companyId)
          .maybeSingle();
        if (active) setCompanyName(comp?.company_name ?? null);
      }

      if (active) setReady(true);
    };

    init();
    return () => {
      active = false;
    };
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = form.nome.trim().replace(/\s+/g, " ");
    if (fullName.length < 3) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (form.password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);

    const parts = fullName.split(" ");
    const first_name = parts[0];
    const last_name = parts.slice(1).join(" ");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;

    // Define senha e nome na conta (auth). A conta já existe desde o convite;
    // ao definir a senha o usuário fica autenticado.
    const { error } = await supabase.auth.updateUser({
      password: form.password,
      data: { first_name, last_name },
    });

    if (error) {
      setLoading(false);
      if (import.meta.env.DEV) console.error("[aceitar-convite] updateUser:", error.message);
      toast.error(
        "Não foi possível ativar a conta. O convite pode ter expirado — solicite um novo.",
      );
      return;
    }

    // Espelha o nome no perfil e marca a conta como ativa.
    if (uid) {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ first_name, last_name, status: "active" })
        .eq("id", uid);
      if (pErr && import.meta.env.DEV)
        console.error("[aceitar-convite] update profile:", pErr.message);
    }

    setLoading(false);
    toast.success("Conta ativada! Bem-vindo(a) à equipe.");
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
          <OdontoLogo size={56} />
          <div className="text-center">
            <h1 className="text-2xl font-bold">Bem-vindo(a) ao OdontoSign</h1>
            {companyName ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Você foi convidado(a) para a equipe da{" "}
                <strong className="text-foreground">{companyName}</strong>.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Complete seu cadastro para entrar na sua clínica.
              </p>
            )}
          </div>
        </div>

        <Card className="p-6 sm:p-8 shadow-[var(--shadow-lift)]">
          <h2 className="text-lg font-semibold">Complete seu cadastro</h2>
          <p className="text-sm text-muted-foreground">
            {email ? (
              <>
                Conta: <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              "Defina seu nome e uma senha de acesso."
            )}
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                required
                autoFocus
                placeholder="Seu nome e sobrenome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </div>
            <Button type="submit" size="lg" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar conta e entrar"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
