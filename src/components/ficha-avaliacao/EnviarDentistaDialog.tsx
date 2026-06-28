// Modal "Enviar para qual dentista?" — lista os usuários com role 'dentist' da
// mesma clínica. A recepção seleciona o dentista que deve revisar/assinar a ficha.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { profileDisplayName } from "@/lib/audit";

type Dentist = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string;
};

export function EnviarDentistaDialog({
  open,
  onOpenChange,
  companyId,
  onConfirm,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string | null | undefined;
  onConfirm: (dentistaId: string) => void;
  saving?: boolean;
}) {
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !companyId) return;
    setLoading(true);
    setSelected(null);
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,username")
        .eq("company_id", companyId)
        .eq("role", "dentist")
        .eq("status", "active");
      setDentists((data ?? []) as Dentist[]);
      setLoading(false);
    })();
  }, [open, companyId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar para qual dentista?</DialogTitle>
          <DialogDescription>
            O dentista selecionado verá a ficha na lista dele com o status “Aguardando Assinatura”.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : dentists.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum dentista cadastrado nesta clínica. Cadastre um usuário com a função “Dentista”.
          </p>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {dentists.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
                  selected === d.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent",
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Stethoscope className="h-4 w-4" />
                </span>
                <span className="font-medium">{profileDisplayName(d)}</span>
              </button>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || saving}
            className="gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar para o dentista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
