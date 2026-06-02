import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";

export const Route = createFileRoute("/aguardando-aprovacao")({
  component: AguardandoAprovacaoPage,
  head: () => ({ meta: [{ title: "Cadastro em análise — OdontoClinic" }] }),
});

function AguardandoAprovacaoPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/login" });
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warning/15">
          <Hourglass className="h-10 w-10 text-warning" />
        </div>
        <h1 className="text-2xl font-bold">Cadastro em análise</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Sua clínica foi cadastrada com sucesso! Nossa equipe irá analisar as informações
          e você receberá uma confirmação em breve. Se tiver dúvidas, entre em contato
          pelo suporte.
        </p>
        <Button variant="outline" onClick={handleSignOut} className="mt-8">
          Sair
        </Button>
      </div>
    </div>
  );
}
