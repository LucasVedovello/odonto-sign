// Tipos, constantes e helpers compartilhados do novo fluxo de documentos
// assináveis (Contratos e Termos). Os dois fluxos são IDÊNTICOS — mudam apenas
// a tabela, o bucket de Storage e os rótulos/rotas. Tudo é parametrizado por
// `DocKind` para evitar duplicação.

export type DocKind = "contract" | "term";

export type SignedDocStatus =
  | "aguardando_clinica" // PDF anexado, clínica ainda não assinou
  | "aguardando_paciente" // clínica assinou, link gerado p/ o paciente
  | "assinado"; // ambos assinaram, PDF final disponível

// Posição de um campo de assinatura, em RAZÕES (0..1) relativas à página.
// x,y = canto superior-esquerdo; w,h = largura/altura. Resolução-independente,
// igual à técnica do prontuário (coordenadas proporcionais sobre a página).
export type SignaturePos = {
  page: number; // 1-based
  x: number;
  y: number;
  w: number;
  h: number;
};

// Tamanho padrão do campo de assinatura ao posicionar (razões da página).
export const DEFAULT_SIG_SIZE = { w: 0.3, h: 0.09 };

// Campo de texto automático (data / local) detectado no PDF. Estende SignaturePos
// com o "kind", que define que texto será gravado na geração do PDF final.
export type AutoTextKind = "date" | "local" | "local_date";
export type AutoTextField = SignaturePos & { kind: AutoTextKind };

// Normaliza um valor jsonb (pode ser null, objeto único legado, ou array) em array.
export const asPosArray = (v: unknown): SignaturePos[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v as SignaturePos[];
  return [v as SignaturePos];
};

// ── Data e local automáticos (pt-BR) ────────────────────────────────────────
const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// Ex.: "16 de junho de 2026"
export const formatPtDate = (d: Date = new Date()): string =>
  `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;

// Texto a gravar em cada campo automático, conforme o tipo do campo.
export const autoFieldText = (
  kind: AutoTextKind,
  city?: string | null,
  d: Date = new Date(),
): string => {
  const date = formatPtDate(d);
  const c = (city ?? "").trim();
  if (kind === "date") return date;
  if (kind === "local") return c;
  return c ? `${c}, ${date}` : date; // local_date
};

// ── Registro de um documento assinável ──────────────────────────────────────
export type SignedDoc = {
  id: string;
  company_id: string | null;
  patient_id: string | null;
  patient_name: string;
  title: string | null;
  original_pdf_path: string;
  signed_pdf_path: string | null;
  status: SignedDocStatus;
  public_token: string;
  clinic_signature: string | null;
  // Arrays: um documento pode ter VÁRIOS campos da mesma parte (ex.: contrato
  // com "Contratada" + "Contratante" assinados pela clínica). A mesma assinatura
  // é reutilizada em todos os campos da parte.
  clinic_signature_pos: SignaturePos[] | null;
  patient_signature: string | null;
  patient_signature_pos: SignaturePos[] | null;
  // Campos de texto automático (data/local) detectados no PDF.
  auto_text_fields: AutoTextField[] | null;
  // Cidade da clínica (tabela companies), resolvida no upload, para os campos de local.
  clinic_city: string | null;
  clinic_signed_at: string | null;
  patient_signed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ── Configuração por tipo ────────────────────────────────────────────────────
type KindConfig = {
  table: "contracts" | "terms";
  bucket: "contracts" | "terms";
  label: string; // singular ("Contrato")
  labelPlural: string; // ("Contratos")
  listPath: "/contratos" | "/termos";
  // caminho da rota pública (a página de assinatura do paciente)
  publicBase: "/assinar-contrato" | "/assinar-termo";
};

const CONFIG: Record<DocKind, KindConfig> = {
  contract: {
    table: "contracts",
    bucket: "contracts",
    label: "Contrato",
    labelPlural: "Contratos",
    listPath: "/contratos",
    publicBase: "/assinar-contrato",
  },
  term: {
    table: "terms",
    bucket: "terms",
    label: "Termo",
    labelPlural: "Termos",
    listPath: "/termos",
    publicBase: "/assinar-termo",
  },
};

export const docConfig = (kind: DocKind): KindConfig => CONFIG[kind];

// Link público completo (para copiar/compartilhar via WhatsApp etc.)
export const publicSignUrl = (kind: DocKind, token: string): string => {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}${CONFIG[kind].publicBase}/${token}`;
};

// ── Status (badges) ──────────────────────────────────────────────────────────
export const STATUS_META: Record<SignedDocStatus, { label: string; cls: string }> = {
  aguardando_clinica: {
    label: "Aguardando clínica",
    cls: "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-300",
  },
  aguardando_paciente: {
    label: "Aguardando paciente",
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-300",
  },
  assinado: {
    label: "Assinado",
    cls: "bg-success/15 text-success border-success/30",
  },
};
