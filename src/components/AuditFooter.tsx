// Rodapé de auditoria discreto exibido em cada item das listagens de
// Prontuários, Contratos e Termos. Mostra "Criado por" e — quando houve edição
// posterior — "Última edição". Estilo: texto pequeno, cor cinza, separado do
// conteúdo principal por uma linha fina.

import { cn } from "@/lib/utils";
import { formatBrasilia, wasEdited } from "@/lib/audit";

type AuditFooterProps = {
  createdByName?: string | null;
  createdAt?: string | null;
  updatedByName?: string | null;
  updatedAt?: string | null;
  className?: string;
};

export function AuditFooter({
  createdByName,
  createdAt,
  updatedByName,
  updatedAt,
  className,
}: AuditFooterProps) {
  const edited = wasEdited(createdAt, updatedAt);

  return (
    <div
      className={cn(
        "mt-3 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <p>
        Criado por: <span className="font-medium text-foreground/80">{createdByName || "—"}</span>
        {"  |  "}Em: {formatBrasilia(createdAt)}
      </p>
      {edited && (
        <p>
          Última edição:{" "}
          <span className="font-medium text-foreground/80">{updatedByName || "—"}</span>
          {"  |  "}Em: {formatBrasilia(updatedAt)}
        </p>
      )}
    </div>
  );
}
