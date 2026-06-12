import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
  head: () => ({ meta: [{ title: "Redefinir senha — OdontoClinic" }] }),
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    supabase
      .rpc("log_audit_event", {
        p_action: "password_reset",
        p_description: "Senha redefinida via link de recuperação",
      })
      .then(
        () => {},
        () => {},
      );
    toast.success("Senha redefinida com sucesso");
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
            style={{ background: "var(--gradient-clinical)" }}
          >
            <Stethoscope className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Nova senha</h1>
        </div>
        <Card className="p-6 sm:p-8 shadow-[var(--shadow-lift)]">
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
