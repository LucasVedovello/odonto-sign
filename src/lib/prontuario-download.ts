// Geração/baixa do PDF do prontuário, compartilhada entre a aba de Prontuários
// e a aba de Prontuários Recentes. Reúne os dados (ficha + eventos), descobre se
// o paciente tem prótese (entra a ficha IOP054) e dispara o download.

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Códigos das fichas que compõem um prontuário, conforme o conteúdo. */
export function prontuarioTipos(opts: { hasEventos: boolean; isProtese: boolean }): string[] {
  const tipos = ["IOP046"]; // Ficha de Planejamento — sempre presente
  if (opts.hasEventos) tipos.push("IOP043"); // Eventos Efetivamente Realizados
  if (opts.isProtese) tipos.push("IOP054"); // Ficha de Prótese
  return tipos;
}

/** True quando o paciente tem "protese" entre os procedimentos. */
export function isProteseProcedimentos(procedimentos: unknown): boolean {
  return Array.isArray(procedimentos)
    ? procedimentos.some((p) => (p ?? "").toString().toLowerCase() === "protese")
    : false;
}

/** Reúne os dados e baixa o PDF do prontuário identificado por `id`. */
export async function downloadProntuarioPdf(id: string): Promise<void> {
  const { data: row } = await db.from("prontuarios").select("*").eq("id", id).single();
  if (!row) return;

  const { data: evs } = await db
    .from("prontuario_eventos")
    .select("*")
    .eq("prontuario_id", id)
    .order("created_at");

  let isProtese = false;
  if (row.patient_id) {
    const { data: pat } = await db
      .from("patients")
      .select("procedimentos")
      .eq("id", row.patient_id)
      .single();
    isProtese = isProteseProcedimentos(pat?.procedimentos);
  }

  const { generateProntuarioPdf } = await import("@/lib/prontuario-pdf");
  const doc = await generateProntuarioPdf(row, evs ?? [], { isProtese });
  doc.save(
    `prontuario-${(row.nome ?? "paciente").replace(/\s+/g, "_")}-${row.data ?? "s-data"}.pdf`,
  );
}
