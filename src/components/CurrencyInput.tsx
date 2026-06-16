import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

// Formata um valor (em reais inteiros) como "R$ 1.500,00".
function formatReaisInput(n: number): string {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return `R$ ${v.toLocaleString("pt-BR")},00`;
}

/**
 * Input de texto com máscara monetária brasileira (sem spinner / sem type="number").
 * Os dígitos digitados representam reais inteiros: 15 -> R$ 15,00 ; 1500 -> R$ 1.500,00.
 * Vazio mostra o placeholder "R$ 0,00". O valor propagado (`onChange`) é numérico.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = "R$ 0,00",
  className,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  const display = value ? formatReaisInput(value) : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Considera apenas a parte antes da vírgula (os centavos são sempre ",00").
    const intPart = e.target.value.split(",")[0];
    const digits = intPart.replace(/\D/g, "");
    const n = digits ? parseInt(digits, 10) : 0;
    // posiciona o cursor imediatamente antes de ",00" para a digitação seguir nos reais
    caret.current = n ? formatReaisInput(n).length - 3 : 0;
    onChange(n);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current != null && document.activeElement === el) {
      const pos = Math.min(caret.current, el.value.length);
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* ignore */
      }
      caret.current = null;
    }
  });

  return (
    <Input
      id={id}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={handleChange}
      className={className}
    />
  );
}
