// Tipos, constantes e helpers compartilhados do módulo Ficha de Avaliação
// (MOD. IOP0037). É o primeiro módulo do atendimento — preenchido na chegada do
// paciente, antes de prontuário e contrato.
//
// A tabela `avaliacoes` não está nos tipos gerados do Supabase; o acesso usa o
// alias `db = supabase as any` (mesmo padrão de prontuarios).

// ── Status / fluxo ───────────────────────────────────────────────────────────
export type FichaStatus =
  | "rascunho" // criada, ainda não enviada ao dentista
  | "aguardando_assinatura" // enviada ao dentista (revisão / clínica vai assinar)
  | "aguardando_paciente" // clínica assinou + link gerado p/ o paciente
  | "assinado"; // paciente assinou

export const STATUS_META: Record<FichaStatus, { label: string; cls: string }> = {
  rascunho: {
    label: "Rascunho",
    cls: "bg-muted text-muted-foreground border-border",
  },
  aguardando_assinatura: {
    label: "Aguardando Assinatura",
    cls: "bg-warning/15 text-warning border-warning/30",
  },
  aguardando_paciente: {
    label: "Aguardando Paciente",
    cls: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-300",
  },
  assinado: {
    label: "Assinado",
    cls: "bg-success/15 text-success border-success/30",
  },
};

// ── Odontogramas ─────────────────────────────────────────────────────────────
// Mapa de dentes marcados: { "18": true, "21": true, ... }
export type DentesMap = Record<string, boolean>;

// Quadrantes do odontograma adulto, na ordem visual da ficha (FDI).
export const DENTES_ADULTO_SUP_DIR = ["18", "17", "16", "15", "14", "13", "12", "11"];
export const DENTES_ADULTO_SUP_ESQ = ["21", "22", "23", "24", "25", "26", "27", "28"];
export const DENTES_ADULTO_INF_DIR = ["48", "47", "46", "45", "44", "43", "42", "41"];
export const DENTES_ADULTO_INF_ESQ = ["31", "32", "33", "34", "35", "36", "37", "38"];

// Dentes decíduos (leite).
export const DENTES_DECIDUOS_SUP_DIR = ["55", "54", "53", "52", "51"];
export const DENTES_DECIDUOS_SUP_ESQ = ["61", "62", "63", "64", "65"];
export const DENTES_DECIDUOS_INF_DIR = ["85", "84", "83", "82", "81"];
export const DENTES_DECIDUOS_INF_ESQ = ["71", "72", "73", "74", "75"];

export const TODOS_DENTES_ADULTO = [
  ...DENTES_ADULTO_SUP_DIR,
  ...DENTES_ADULTO_SUP_ESQ,
  ...DENTES_ADULTO_INF_DIR,
  ...DENTES_ADULTO_INF_ESQ,
];

// ── Tipo do formulário ───────────────────────────────────────────────────────
// Reflete (quase) 1:1 as colunas de `avaliacoes`. Campos de sistema (id, status,
// assinaturas, auditoria) ficam fora — são tratados nas páginas.
export type FichaData = {
  // Cabeçalho
  paciente_nome: string;
  paciente_telefone: string;
  paciente_celular: string;
  paciente_data_nascimento: string;
  paciente_cpf: string;
  paciente_email: string;
  origem: string;
  avaliador: string;
  data_avaliacao: string;
  numero_contrato: string;
  numero_prontuario: string;

  // Dentística
  dentistica_dentes: DentesMap;
  dentistica_restauracao_dentes: string;
  dentistica_total: string;

  // Clareamento / Dessensibilização
  clareamento_externo_comum: boolean;
  clareamento_externo_laser: boolean;
  clareamento_externo_apos_ortod: boolean;
  clareamento_externo_apenas_arcada: string;
  clareamento_interno: string;
  dessensibilizacao_comum: boolean;
  dessensibilizacao_laser: boolean;
  dessensibilizacao_arcada_sup: boolean;
  dessensibilizacao_arcada_inf: boolean;
  dessensibilizacao_obs: string;

  // Decíduos
  deciduos_dentes: DentesMap;
  deciduos_oclusao_devida: string;
  deciduos_cavidade_causal: string;
  deciduos_cirurgia_agendada: string;
  deciduos_replantacao: string;
  deciduos_condicionamento: boolean;
  deciduos_fluor: boolean;
  deciduos_arcada_sup: boolean;
  deciduos_arcada_inf: boolean;

  // Endodontia
  endodontia_dentes: DentesMap;
  endodontia_uni_tratamento: string;
  endodontia_uni_retratamento: string;
  endodontia_bi_tratamento: string;
  endodontia_bi_retratamento: string;
  endodontia_tri_tratamento: string;
  endodontia_tri_retratamento: string;
  endodontia_obs: boolean;

  // Periodontia
  perio_fluor: boolean;
  perio_profilaxia: boolean;
  perio_basica: boolean;
  perio_moderada: boolean;
  perio_avancada: boolean;
  gengivectomia_dentes: string;
  gengivectomia_obs: boolean;

  // Núcleo
  nucleo_dentes: DentesMap;
  nucleo_nos_dentes: string;
  nucleo_total: string;
  nucleo_material: string;

  // Prótese Fixa Definitiva
  protese_fixa_dentes: DentesMap;
  protese_fixa_material: string;
  protese_elemento_definitivo: string;
  protese_onlay_inlay: string;
  protese_faceta: string;
  protese_lente_contato: string;

  // Provisórios
  provisorios_dentes: DentesMap;
  provisorios_nos_dentes: string;
  provisorios_total: string;
  provisorios_material: string;
  provisorios_fixado_aparelho: boolean;

  // Prótese Total
  pt_definitiva_superior: boolean;
  pt_definitiva_inferior: boolean;
  pt_imediata_sup: boolean;
  pt_imediata_inf: boolean;
  pt_nacionais: boolean;
  pt_importados: boolean;

  // PPR
  ppr_definitiva_superior: boolean;
  ppr_definitiva_inferior: boolean;
  ppr_provisoria_sup: boolean;
  ppr_provisoria_inf: boolean;
  ppr_flex_superior: boolean;
  ppr_flex_inferior: boolean;
  ppr_nacionais: boolean;
  ppr_importados: boolean;

  // ATM
  atm_placa_mordida: boolean;
  atm_placa_disfuncao: boolean;

  // Cirurgia
  cirurgia_dentes: DentesMap;
  exodontia_simples: string;
  exodontia_raiz: string;
  exodontia_semi_incluso: string;
  exodontia_incluso: string;
  exodontia_erupcionado: string;
  cirurgia_frenectomia: boolean;
  cirurgia_biopsia: boolean;
  cirurgia_hiperplasia: boolean;
  cirurgia_regularizacao: string;

  // Implante
  implante_dentes: DentesMap;
  implante_total_superior: string;
  implante_total_inferior: string;
  implante_coroas_dentes: string;
  implante_overdenture_sup: boolean;
  implante_overdenture_inf: boolean;
  implante_protocolo_sup: boolean;
  implante_protocolo_inf: boolean;
  implante_protocolo_carga_sup: boolean;
  implante_protocolo_carga_inf: boolean;
  implante_zigomatico: boolean;
  implante_apos_ortodontia: boolean;
  implante_pinos_importados: boolean;
  implante_guia: string;
  implante_enxerto_bloco: string;
  implante_enxerto_liofilizado: string;
  implante_elevacao_seio: string;

  // Opções de tratamento / observações
  opcao_tratamento_1: string;
  opcao_tratamento_2: string;
  opcao_tratamento_3: string;
  observacoes: string;

  // Ortodontia
  ortod_alinhador: boolean;
  ortod_auto_ligado: boolean;
  ortod_convencional: boolean;
  ortod_ortopedia: boolean;
  ortod_mini_implante: string;
  ortod_tracionamento: string;
  ortod_cir_ortognatica: boolean;
  ortod_documentacao: boolean;
  ortod_panoramica: boolean;
  braquetes_porcelana: boolean;
  braquetes_safira: boolean;
  braquetes_policarbonato: boolean;
  braquetes_metalico: boolean;

  // Radiografia
  radio_panoramica: boolean;
  radio_tomografia: string;
  radio_periapical: string;

  // E.S. / R.V. / R.P.
  es_am: boolean;
  es_an: boolean;
  es_ex: boolean;
  es_em: boolean;
  rv_min: boolean;
  rv_med: boolean;
  rv_total: boolean;
  rp_min: boolean;
  rp_med: boolean;
  rp_total: boolean;
};

// Registro completo carregado do banco (form + campos de sistema).
export type FichaRow = FichaData & {
  id: string;
  company_id: string;
  dentista_id: string | null;
  status: FichaStatus;
  assinatura_clinica: string | null;
  assinatura_paciente: string | null;
  link_assinatura_token: string | null;
  link_assinatura_expira_em: string | null;
  pdf_url: string | null;
  clinica_assinada_em: string | null;
  paciente_assinado_em: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const today = () => new Date().toISOString().split("T")[0];

export function EMPTY_FICHA(): FichaData {
  return {
    paciente_nome: "",
    paciente_telefone: "",
    paciente_celular: "",
    paciente_data_nascimento: "",
    paciente_cpf: "",
    paciente_email: "",
    origem: "",
    avaliador: "",
    data_avaliacao: today(),
    numero_contrato: "",
    numero_prontuario: "",

    dentistica_dentes: {},
    dentistica_restauracao_dentes: "",
    dentistica_total: "",

    clareamento_externo_comum: false,
    clareamento_externo_laser: false,
    clareamento_externo_apos_ortod: false,
    clareamento_externo_apenas_arcada: "",
    clareamento_interno: "",
    dessensibilizacao_comum: false,
    dessensibilizacao_laser: false,
    dessensibilizacao_arcada_sup: false,
    dessensibilizacao_arcada_inf: false,
    dessensibilizacao_obs: "",

    deciduos_dentes: {},
    deciduos_oclusao_devida: "",
    deciduos_cavidade_causal: "",
    deciduos_cirurgia_agendada: "",
    deciduos_replantacao: "",
    deciduos_condicionamento: false,
    deciduos_fluor: false,
    deciduos_arcada_sup: false,
    deciduos_arcada_inf: false,

    endodontia_dentes: {},
    endodontia_uni_tratamento: "",
    endodontia_uni_retratamento: "",
    endodontia_bi_tratamento: "",
    endodontia_bi_retratamento: "",
    endodontia_tri_tratamento: "",
    endodontia_tri_retratamento: "",
    endodontia_obs: false,

    perio_fluor: false,
    perio_profilaxia: false,
    perio_basica: false,
    perio_moderada: false,
    perio_avancada: false,
    gengivectomia_dentes: "",
    gengivectomia_obs: false,

    nucleo_dentes: {},
    nucleo_nos_dentes: "",
    nucleo_total: "",
    nucleo_material: "",

    protese_fixa_dentes: {},
    protese_fixa_material: "",
    protese_elemento_definitivo: "",
    protese_onlay_inlay: "",
    protese_faceta: "",
    protese_lente_contato: "",

    provisorios_dentes: {},
    provisorios_nos_dentes: "",
    provisorios_total: "",
    provisorios_material: "",
    provisorios_fixado_aparelho: false,

    pt_definitiva_superior: false,
    pt_definitiva_inferior: false,
    pt_imediata_sup: false,
    pt_imediata_inf: false,
    pt_nacionais: false,
    pt_importados: false,

    ppr_definitiva_superior: false,
    ppr_definitiva_inferior: false,
    ppr_provisoria_sup: false,
    ppr_provisoria_inf: false,
    ppr_flex_superior: false,
    ppr_flex_inferior: false,
    ppr_nacionais: false,
    ppr_importados: false,

    atm_placa_mordida: false,
    atm_placa_disfuncao: false,

    cirurgia_dentes: {},
    exodontia_simples: "",
    exodontia_raiz: "",
    exodontia_semi_incluso: "",
    exodontia_incluso: "",
    exodontia_erupcionado: "",
    cirurgia_frenectomia: false,
    cirurgia_biopsia: false,
    cirurgia_hiperplasia: false,
    cirurgia_regularizacao: "",

    implante_dentes: {},
    implante_total_superior: "",
    implante_total_inferior: "",
    implante_coroas_dentes: "",
    implante_overdenture_sup: false,
    implante_overdenture_inf: false,
    implante_protocolo_sup: false,
    implante_protocolo_inf: false,
    implante_protocolo_carga_sup: false,
    implante_protocolo_carga_inf: false,
    implante_zigomatico: false,
    implante_apos_ortodontia: false,
    implante_pinos_importados: false,
    implante_guia: "",
    implante_enxerto_bloco: "",
    implante_enxerto_liofilizado: "",
    implante_elevacao_seio: "",

    opcao_tratamento_1: "",
    opcao_tratamento_2: "",
    opcao_tratamento_3: "",
    observacoes: "",

    ortod_alinhador: false,
    ortod_auto_ligado: false,
    ortod_convencional: false,
    ortod_ortopedia: false,
    ortod_mini_implante: "",
    ortod_tracionamento: "",
    ortod_cir_ortognatica: false,
    ortod_documentacao: false,
    ortod_panoramica: false,
    braquetes_porcelana: false,
    braquetes_safira: false,
    braquetes_policarbonato: false,
    braquetes_metalico: false,

    radio_panoramica: false,
    radio_tomografia: "",
    radio_periapical: "",

    es_am: false,
    es_an: false,
    es_ex: false,
    es_em: false,
    rv_min: false,
    rv_med: false,
    rv_total: false,
    rp_min: false,
    rp_med: false,
    rp_total: false,
  };
}

// Mescla uma linha do banco (parcial) sobre os defaults, garantindo que todos
// os campos existam (datas null viram "", odontogramas null viram {}).
export function fichaFromRow(row: Record<string, unknown>): FichaData {
  const base = EMPTY_FICHA();
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base)) {
    const v = row[key];
    if (v === null || v === undefined) continue;
    out[key] = v;
  }
  return out as FichaData;
}

// Link público completo (copiar / WhatsApp). Usa a rota pública flat.
export function publicSignUrl(id: string, token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/fichas-avaliacao/${id}/assinar?token=${token}`;
}
