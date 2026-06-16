import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { PenLine, Eraser } from "lucide-react";
import { toast } from "sonner";

/**
 * Modal de assinatura única (uma pessoa por vez) — usado tanto pela clínica
 * quanto pelo paciente. Devolve o PNG (transparente) da assinatura desenhada.
 */
export function SignDialog({
  open,
  title,
  description,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: (dataUrl: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const ref = useRef<SignaturePadHandle>(null);

  const confirm = () => {
    if (!ref.current || ref.current.isEmpty()) {
      toast.error("Desenhe a assinatura antes de confirmar");
      return;
    }
    onConfirm(ref.current.toDataURL());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Desenhe a assinatura no quadro abaixo."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <PenLine className="h-3.5 w-3.5 text-primary" /> Assinatura
          </p>
          <div className="overflow-hidden rounded-xl border-2 border-dashed border-border bg-white dark:bg-background">
            <SignaturePad ref={ref} className="block h-44 w-full" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => ref.current?.clear()}
            className="mt-1 gap-1.5 text-xs text-muted-foreground"
          >
            <Eraser className="h-3.5 w-3.5" /> Limpar
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm}>Confirmar assinatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
