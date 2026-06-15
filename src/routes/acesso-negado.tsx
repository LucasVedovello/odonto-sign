import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

export const Route = createFileRoute("/acesso-negado")({
  component: AcessoNegadoPage,
  head: () => ({ meta: [{ title: "Cadastro não aprovado — OdontoSign" }] }),
});

function AcessoNegadoPage() {
  const navigate = useNavigate();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate({ to: "/login" }); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      const { data: company } = await supabase
        .from("companies")
        .select("rejection_reason")
        .eq("id", profile.company_id)
        .maybeSingle();

      setRejectionReason(company?.rejection_reason ?? null);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/15">
          <ShieldOff className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Cadastro não aprovado</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Infelizmente seu cadastro não foi aprovado.
        </p>
        {rejectionReason && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-left">
            <span className="font-medium text-destructive">Motivo: </span>
            {rejectionReason}
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link to="/suporte">Entrar em contato</Link>
          </Button>
          <Button variant="ghost" onClick={handleSignOut} className="text-destructive hover:text-destructive">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
