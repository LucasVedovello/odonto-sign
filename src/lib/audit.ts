// Helpers de auditoria compartilhados (rodapé "criado/editado por" e aba de
// prontuários recentes). Centraliza:
//   • formatação de data/hora no fuso de Brasília (America/Sao_Paulo);
//   • resolução de nomes de usuários a partir de `profiles` (nunca pelo e-mail);
//   • heurística de "houve edição posterior à criação".

import { supabase } from "@/integrations/supabase/client";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "DD/MM/AAAA às HH:MM" no fuso de Brasília. Retorna "—" para valores inválidos. */
export function formatBrasilia(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${DATE_FMT.format(d)} às ${TIME_FMT.format(d)}`;
}

// Margem para distinguir "salvo uma vez" de "editado depois". updated_at e
// created_at saem iguais na criação; só consideramos edição quando passam
// alguns segundos entre os dois.
const EDIT_THRESHOLD_MS = 3000;

/** True quando houve uma edição relevante após a criação. */
export function wasEdited(createdAt?: string | null, updatedAt?: string | null): boolean {
  if (!createdAt || !updatedAt) return false;
  const c = new Date(createdAt).getTime();
  const u = new Date(updatedAt).getTime();
  if (Number.isNaN(c) || Number.isNaN(u)) return false;
  return u - c > EDIT_THRESHOLD_MS;
}

/** Nome de exibição a partir de uma linha de `profiles` (nunca usa o e-mail). */
export function profileDisplayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string {
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return full || p.username || "—";
}

/**
 * Resolve um conjunto de user_ids em nomes de exibição (mapa id → nome).
 * Ignora nulos/duplicados e devolve {} quando não há ids.
 */
export async function fetchProfileNames(
  ids: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,username")
    .in("id", unique);
  const map: Record<string, string> = {};
  for (const p of data ?? []) {
    map[p.id] = profileDisplayName(p);
  }
  return map;
}
