// Odontograma clicável da Ficha de Avaliação.
// Cada dente é um círculo (SVG) que alterna marcado/desmarcado, no layout de
// quadrantes da ficha (superior dir | esq / inferior dir | esq) com uma cruz
// central separando os lados, igual ao formulário impresso.

import { cn } from "@/lib/utils";
import type { DentesMap } from "@/lib/ficha-avaliacao";

type OdontogramaProps = {
  value: DentesMap;
  onToggle: (dente: string) => void;
  // 4 quadrantes na ordem: superior-direito, superior-esquerdo,
  // inferior-direito, inferior-esquerdo.
  supDir: string[];
  supEsq: string[];
  infDir: string[];
  infEsq: string[];
  readOnly?: boolean;
  // Renderiza um "implante" (pino) dentro do círculo (seção de implantes).
  implante?: boolean;
};

function Tooth({
  dente,
  marked,
  onToggle,
  readOnly,
  implante,
}: {
  dente: string;
  marked: boolean;
  onToggle: (d: string) => void;
  readOnly?: boolean;
  implante?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => onToggle(dente)}
      className={cn(
        "flex w-7 shrink-0 flex-col items-center gap-0.5",
        readOnly ? "cursor-default" : "cursor-pointer",
      )}
      aria-pressed={marked}
      aria-label={`Dente ${dente}${marked ? " (marcado)" : ""}`}
    >
      <span className="text-[10px] font-semibold leading-none text-muted-foreground">{dente}</span>
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <circle
          cx="12"
          cy="12"
          r="10"
          className={cn(
            "transition-colors",
            marked
              ? "fill-primary stroke-primary"
              : "fill-background stroke-muted-foreground/50 group-hover:stroke-primary",
          )}
          strokeWidth="1.5"
        />
        {implante && (
          // Traços do "pino"/implante, esmaecem quando o círculo está preenchido.
          <g
            className={cn(marked ? "stroke-primary-foreground" : "stroke-muted-foreground/60")}
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <line x1="12" y1="6" x2="12" y2="18" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </g>
        )}
        {marked && !implante && (
          <path
            d="M7 12.5l3.2 3.2L17 9"
            fill="none"
            className="stroke-primary-foreground"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}

function Arcada({
  dir,
  esq,
  value,
  onToggle,
  readOnly,
  implante,
}: {
  dir: string[];
  esq: string[];
  value: DentesMap;
  onToggle: (d: string) => void;
  readOnly?: boolean;
  implante?: boolean;
}) {
  return (
    <div className="group flex items-center justify-center gap-0.5">
      <div className="flex gap-0.5">
        {dir.map((d) => (
          <Tooth
            key={d}
            dente={d}
            marked={!!value[d]}
            onToggle={onToggle}
            readOnly={readOnly}
            implante={implante}
          />
        ))}
      </div>
      {/* divisor central (linha média) */}
      <div className="mx-1 h-8 w-px shrink-0 bg-border" aria-hidden />
      <div className="flex gap-0.5">
        {esq.map((d) => (
          <Tooth
            key={d}
            dente={d}
            marked={!!value[d]}
            onToggle={onToggle}
            readOnly={readOnly}
            implante={implante}
          />
        ))}
      </div>
    </div>
  );
}

export function Odontograma({
  value,
  onToggle,
  supDir,
  supEsq,
  infDir,
  infEsq,
  readOnly,
  implante,
}: OdontogramaProps) {
  return (
    <div className="inline-flex flex-col gap-2 overflow-x-auto">
      <Arcada
        dir={supDir}
        esq={supEsq}
        value={value}
        onToggle={onToggle}
        readOnly={readOnly}
        implante={implante}
      />
      <Arcada
        dir={infDir}
        esq={infEsq}
        value={value}
        onToggle={onToggle}
        readOnly={readOnly}
        implante={implante}
      />
    </div>
  );
}
