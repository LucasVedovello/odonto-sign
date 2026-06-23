import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OdontoLogo } from "@/components/OdontoLogo";
import { AlertTriangle, LogOut, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/assinatura-expirada")({
  component: SubscriptionExpiredPage,
  head: () => ({ meta: [{ title: "Assinatura expirada — OdontoSign" }] }),
});

// TODO: substituir pelo número de suporte real da plataforma.
const SUPPORT_WHATSAPP = "5519XXXXXXXXX";

function SubscriptionExpiredPage() {
  const navigate = useNavigate();

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      "Olá! Minha assinatura do OdontoSign expirou e gostaria de renovar o acesso.",
    );
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, "_blank");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mb-4 flex justify-center">
          <OdontoLogo size={56} />
        </div>
        <div className="mb-4 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </span>
        </div>
        <h1 className="text-xl font-bold">Sua assinatura expirou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O acesso da sua clínica ao OdontoSign está suspenso porque a assinatura venceu. Entre em
          contato com o suporte para renovar e reativar o acesso.
        </p>

        <div className="mt-6 grid gap-2">
          <Button className="gap-2" size="lg" onClick={openWhatsApp}>
            <MessageCircle className="h-4 w-4" /> Falar com o suporte
          </Button>
          <Button variant="outline" className="gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </Card>
    </div>
  );
}
