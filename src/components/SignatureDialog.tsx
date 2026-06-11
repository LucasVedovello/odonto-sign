import { useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { PenLine, Eraser } from "lucide-react";
import { toast } from "sonner";

export type DualSignature = { doctor: string; patient: string };

/**
 * Modal de assinatura dupla (doutor + paciente), reutilizado para assinar
 * tanto as informações iniciais quanto cada procedimento. Ambas as assinaturas
 * são obrigatórias — sempre doutor + paciente juntos.
 */
export function SignatureDialog({
  open, title, description, onConfirm, onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: (sig: DualSignature) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const docRef = useRef<SignaturePadHandle>(null);
  const pacRef = useRef<SignaturePadHandle>(null);

  const confirm = () => {
    if (docRef.current?.isEmpty() || pacRef.current?.isEmpty()) {
      toast.error("Doutor e paciente devem assinar");
      return;
    }
    onConfirm({ doctor: docRef.current!.toDataURL(), patient: pacRef.current!.toDataURL() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Doutor e paciente devem assinar para validar."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { ref: docRef, label: "Assinatura do Doutor" },
            { ref: pacRef, label: "Assinatura do Paciente" },
          ] as const).map(({ ref, label }) => (
            <div key={label}>
              <p className="mb-2 text-sm font-medium flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5 text-primary" /> {label}
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-white dark:bg-background overflow-hidden">
                <SignaturePad ref={ref} className="block h-36 w-full" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => ref.current?.clear()}
                className="mt-1 gap-1.5 text-xs text-muted-foreground">
                <Eraser className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm}>Confirmar assinaturas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
