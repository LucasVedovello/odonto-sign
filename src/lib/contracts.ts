// Tipos, constantes e helpers compartilhados do sistema de contratos.

export type TreatmentType =
  | "protese"
  | "implante"
  | "ortodontia"
  | "alinhador_transparente"
  | "lente_contato_facetas";

export type ContractStatus =
  | "aguardando_paciente"
  | "aguardando_recepcao"
  | "aguardando_assinatura_paciente"
  | "concluido";

export const TREATMENT_OPTIONS: { value: TreatmentType; label: string }[] = [
  { value: "protese", label: "Prótese" },
  { value: "implante", label: "Implante" },
  { value: "ortodontia", label: "Ortodontia" },
  { value: "alinhador_transparente", label: "Alinhador Transparente" },
  { value: "lente_contato_facetas", label: "Lente de Contato / Facetas" },
];

export const TREATMENT_LABEL: Record<TreatmentType, string> = TREATMENT_OPTIONS.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<TreatmentType, string>,
);

export type PaymentAnnex = "parcela_facil" | "compra_programada" | "pagamento_recorrente";

export const PAYMENT_ANNEX_OPTIONS: {
  value: PaymentAnnex;
  label: string;
  column: "has_parcela_facil" | "has_compra_programada" | "has_pagamento_recorrente";
  file: string;
}[] = [
  {
    value: "parcela_facil",
    label: "Parcela Fácil",
    column: "has_parcela_facil",
    file: "anexo_parcela_facil.pdf",
  },
  {
    value: "compra_programada",
    label: "Compra Programada",
    column: "has_compra_programada",
    file: "anexo_compra_programada.pdf",
  },
  {
    value: "pagamento_recorrente",
    label: "Pagamento Recorrente",
    column: "has_pagamento_recorrente",
    file: "termo_pagamento_recorrente.pdf",
  },
];

// ── Documentos (PDFs) no bucket público `contract-terms` ────────────────────
export const CONTRACT_TERMS_BASE =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/contract-terms/";

export const termUrl = (file: string) => `${CONTRACT_TERMS_BASE}${file}`;

// Termo específico por tipo de tratamento (além do contrato geral).
export const TREATMENT_TERM_FILE: Record<TreatmentType, string | null> = {
  protese: "termo_protese.pdf",
  implante: "termo_implantes.pdf",
  ortodontia: null, // Ortodontia usa apenas o contrato geral
  alinhador_transparente: "termo_alinhador_transparente.pdf",
  lente_contato_facetas: "termo_lente_contato_facetas.pdf",
};

export const CONTRATO_GERAL_FILE = "contrato_geral.pdf";

// Lista ordenada de documentos (geral + termo específico + anexos selecionados)
export function documentsFor(c: {
  treatment_type: TreatmentType | string;
  has_parcela_facil?: boolean | null;
  has_compra_programada?: boolean | null;
  has_pagamento_recorrente?: boolean | null;
}): { title: string; file: string }[] {
  const docs: { title: string; file: string }[] = [
    { title: "Contrato Geral", file: CONTRATO_GERAL_FILE },
  ];
  const specific = TREATMENT_TERM_FILE[c.treatment_type as TreatmentType];
  if (specific) {
    docs.push({
      title: `Termo — ${TREATMENT_LABEL[c.treatment_type as TreatmentType] ?? c.treatment_type}`,
      file: specific,
    });
  }
  for (const a of PAYMENT_ANNEX_OPTIONS) {
    const enabled =
      (a.column === "has_parcela_facil" && c.has_parcela_facil) ||
      (a.column === "has_compra_programada" && c.has_compra_programada) ||
      (a.column === "has_pagamento_recorrente" && c.has_pagamento_recorrente);
    if (enabled) docs.push({ title: `Anexo — ${a.label}`, file: a.file });
  }
  return docs;
}

// ── Status (badges) ─────────────────────────────────────────────────────────
export const STATUS_META: Record<ContractStatus, { label: string; cls: string }> = {
  aguardando_paciente: {
    label: "Aguardando paciente",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  aguardando_recepcao: {
    label: "Aguardando recepção",
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-300",
  },
  aguardando_assinatura_paciente: {
    label: "Aguardando assinatura",
    cls: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-300",
  },
  concluido: {
    label: "Concluído",
    cls: "bg-success/15 text-success border-success/30",
  },
};

export const SEXO_OPTIONS = ["Masculino", "Feminino", "Outro"];

// ── Estruturas dinâmicas (JSONB) ────────────────────────────────────────────
export type Procedimento = {
  tratamento: string;
  dentes: string;
  qtd: number;
  valor: number;
};

export type MaterialExtra = {
  tipo: string;
  valor: number;
};

// ── Tipo do registro de contrato ────────────────────────────────────────────
export type Contract = {
  id: string;
  company_id: string | null;
  contract_number: number;
  treatment_type: TreatmentType;
  has_parcela_facil: boolean | null;
  has_compra_programada: boolean | null;
  has_pagamento_recorrente: boolean | null;

  contratante_nome: string | null;
  contratante_nascimento: string | null;
  contratante_cpf: string | null;
  contratante_rg: string | null;
  contratante_profissao: string | null;
  contratante_sexo: string | null;
  contratante_endereco: string | null;
  contratante_telefone: string | null;
  contratante_celular: string | null;
  contratante_email: string | null;

  paciente_nome: string | null;
  paciente_nascimento: string | null;
  paciente_cpf: string | null;
  paciente_rg: string | null;
  paciente_profissao: string | null;
  paciente_sexo: string | null;
  paciente_endereco: string | null;
  paciente_telefone: string | null;
  paciente_celular: string | null;
  paciente_email: string | null;

  referencia_1_nome: string | null;
  referencia_1_telefone: string | null;
  referencia_2_nome: string | null;
  referencia_2_telefone: string | null;

  procedimentos: Procedimento[] | null;
  valor_total: number | null;
  desconto: number | null;
  valor_final: number | null;
  valor_ortodontico: number | null;
  valor_nao_ortodontico: number | null;
  documentacao_ortodontica: number | null;
  entrada_tipo: string | null;
  entrada_valor: number | null;
  sinal_valor: number | null;
  parcelamento_tipo: string | null;
  parcelamento_qtd: number | null;
  parcelamento_valor: number | null;
  vencimento_dia: number | null;
  venc_primeira_parcela: string | null;
  materiais_extras: MaterialExtra[] | null;

  status: ContractStatus;
  patient_token: string;
  signing_token: string;
  clinic_signature: string | null;
  patient_signature: string | null;
  signed_at: string | null;
  clinic_signed_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Helpers de moeda ────────────────────────────────────────────────────────
export const formatBRL = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "1.234,56" / "1234.56" / "R$ 1.234,56" -> 1234.56
export const parseBRL = (s: string): number => {
  if (!s) return 0;
  const cleaned = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};
