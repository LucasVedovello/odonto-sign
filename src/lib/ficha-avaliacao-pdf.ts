/**
 * ficha-avaliacao-pdf.ts — Ficha de Avaliação (MOD. IOP0037)
 * A4 RETRATO (210 × 297 mm), jsPDF unit: 'mm'
 *
 * Páginas:
 *   1 — Dentística / Clareamento / Decíduos / Endodontia / Periodontia /
 *       Núcleo / Prótese Fixa / Provisórios
 *   2 — Prótese Total / PPR / ATM / Cirurgia / Implante / Opções /
 *       Observações / Ortodontia / Radiografia / E.S.-R.V.-R.P. / Assinaturas
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  COORDENADAS CENTRALIZADAS (mm). As posições dos campos, checkboxes e
 *  odontogramas foram calibradas medindo as imagens de fundo (1060×1484 e
 *  1026×1533 px → 210×297 mm). Todas as marcações são um "X" VERDE (#16a34a).
 *
 *  Para ajuste fino use generateFichaCalibrationPdf() — desenha uma grade
 *  vermelha de 10 mm sobre cada página.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { FichaData, FichaRow } from "@/lib/ficha-avaliacao";

const URLS = {
  p1: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-avaliacao-pagina-1.jpg",
  p2: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-avaliacao-pagina-2.jpg",
};

const W = 210,
  H = 297; // A4 retrato, mm

const GREEN: [number, number, number] = [22, 163, 74]; // #16a34a
const NAVY: [number, number, number] = [26, 58, 107];

// ── Tipos de configuração ───────────────────────────────────────────────────
type TextField = {
  key: keyof FichaData;
  x: number;
  y: number;
  maxWidth: number;
  maxLines?: number;
  date?: boolean;
  size?: number;
  minSize?: number;
};
type CheckField = { key: keyof FichaData; x: number; y: number };
type ToothSection = { key: keyof FichaData; topY: number; botY: number };

// ── Odontograma adulto página 1 — X (mm) de cada dente (medido) ──────────────
const ADULT_X_P1: Record<string, number> = {
  "18": 11.3,
  "17": 17.2,
  "16": 24.1,
  "15": 30.8,
  "14": 37.5,
  "13": 44.4,
  "12": 51.1,
  "11": 57.9,
  "21": 76.6,
  "22": 83.5,
  "23": 90.4,
  "24": 97.4,
  "25": 104.3,
  "26": 111.2,
  "27": 117.9,
  "28": 125.0,
  "48": 11.3,
  "47": 17.2,
  "46": 24.1,
  "45": 30.8,
  "44": 37.5,
  "43": 44.4,
  "42": 51.1,
  "41": 57.9,
  "31": 76.6,
  "32": 83.5,
  "33": 90.4,
  "34": 97.4,
  "35": 104.3,
  "36": 111.2,
  "37": 117.9,
  "38": 125.0,
};
// Odontograma adulto página 2 (imagem com escala diferente)
const ADULT_X_P2: Record<string, number> = {
  "18": 17.7,
  "17": 23.3,
  "16": 29.4,
  "15": 35.1,
  "14": 40.9,
  "13": 46.7,
  "12": 52.7,
  "11": 58.5,
  "21": 73.7,
  "22": 79.7,
  "23": 85.2,
  "24": 90.8,
  "25": 97.3,
  "26": 103.1,
  "27": 108.8,
  "28": 114.5,
  "48": 17.7,
  "47": 23.3,
  "46": 29.4,
  "45": 35.1,
  "44": 40.9,
  "43": 46.7,
  "42": 52.7,
  "41": 58.5,
  "31": 73.7,
  "32": 79.7,
  "33": 85.2,
  "34": 90.8,
  "35": 97.3,
  "36": 103.1,
  "37": 108.8,
  "38": 114.5,
};
// Decíduos (página 1)
const DECID_X: Record<string, number> = {
  "55": 17.5,
  "54": 23.9,
  "53": 30.1,
  "52": 36.4,
  "51": 43.0,
  "61": 49.8,
  "62": 56.2,
  "63": 62.9,
  "64": 69.1,
  "65": 76.0,
  "85": 17.5,
  "84": 23.9,
  "83": 30.1,
  "82": 36.4,
  "81": 43.0,
  "71": 49.8,
  "72": 56.2,
  "73": 62.9,
  "74": 69.1,
  "75": 76.0,
};
const isSup = (d: string) =>
  d.startsWith("1") || d.startsWith("2") || d.startsWith("5") || d.startsWith("6");

// ─────────────────────────────────────────────────────────────────────────
//  PÁGINA 1
// ─────────────────────────────────────────────────────────────────────────
const P1_TEXT: TextField[] = [
  // Cabeçalho
  { key: "numero_contrato", x: 52, y: 15, maxWidth: 38 },
  { key: "numero_prontuario", x: 98, y: 15, maxWidth: 40 },
  { key: "paciente_nome", x: 40, y: 25.5, maxWidth: 52, size: 9 },
  { key: "paciente_telefone", x: 114, y: 25.5, maxWidth: 33 },
  { key: "paciente_data_nascimento", x: 184, y: 25.5, maxWidth: 22, date: true, size: 8 },
  { key: "paciente_cpf", x: 16, y: 31.5, maxWidth: 32 },
  { key: "origem", x: 65, y: 31.5, maxWidth: 26 },
  { key: "avaliador", x: 110, y: 31.5, maxWidth: 20 },
  { key: "data_avaliacao", x: 136, y: 31.5, maxWidth: 22, date: true, size: 7 },
  { key: "paciente_email", x: 168, y: 31.5, maxWidth: 38, size: 6 },
  // Dentística (direita)
  { key: "dentistica_restauracao_dentes", x: 150, y: 55, maxWidth: 52, maxLines: 2, size: 8 },
  { key: "dentistica_total", x: 166, y: 61, maxWidth: 36, size: 8 },
  // Clareamento / Dessensibilização
  { key: "clareamento_externo_apenas_arcada", x: 38, y: 88, maxWidth: 28, size: 8 },
  { key: "clareamento_interno", x: 80, y: 75, maxWidth: 55, maxLines: 2, size: 8 },
  { key: "dessensibilizacao_obs", x: 150, y: 84, maxWidth: 52, size: 8 },
  // Decíduos (direita)
  { key: "deciduos_oclusao_devida", x: 132, y: 100, maxWidth: 72, size: 8 },
  { key: "deciduos_cavidade_causal", x: 132, y: 106, maxWidth: 72, size: 8 },
  { key: "deciduos_cirurgia_agendada", x: 132, y: 112, maxWidth: 72, size: 8 },
  { key: "deciduos_replantacao", x: 132, y: 118, maxWidth: 72, size: 8 },
  // Endodontia — tabela UNI/BI/TRI
  { key: "endodontia_uni_tratamento", x: 148, y: 140, maxWidth: 24, size: 8 },
  { key: "endodontia_uni_retratamento", x: 178, y: 140, maxWidth: 24, size: 8 },
  { key: "endodontia_bi_tratamento", x: 148, y: 146, maxWidth: 24, size: 8 },
  { key: "endodontia_bi_retratamento", x: 178, y: 146, maxWidth: 24, size: 8 },
  { key: "endodontia_tri_tratamento", x: 148, y: 151.5, maxWidth: 24, size: 8 },
  { key: "endodontia_tri_retratamento", x: 178, y: 151.5, maxWidth: 24, size: 8 },
  // Gengivectomia
  { key: "gengivectomia_dentes", x: 150, y: 170, maxWidth: 52, size: 8 },
  // Núcleo
  { key: "nucleo_nos_dentes", x: 150, y: 200, maxWidth: 52, size: 8 },
  { key: "nucleo_total", x: 150, y: 206, maxWidth: 52, size: 8 },
  { key: "nucleo_material", x: 150, y: 212, maxWidth: 52, size: 8 },
  // Prótese fixa
  { key: "protese_elemento_definitivo", x: 150, y: 222, maxWidth: 52, size: 8 },
  { key: "protese_onlay_inlay", x: 150, y: 228, maxWidth: 52, size: 8 },
  { key: "protese_faceta", x: 150, y: 234, maxWidth: 52, size: 8 },
  { key: "protese_lente_contato", x: 150, y: 240, maxWidth: 52, size: 8 },
  { key: "protese_fixa_material", x: 35, y: 248, maxWidth: 70, size: 8 },
  // Provisórios
  { key: "provisorios_nos_dentes", x: 150, y: 256, maxWidth: 52, size: 8 },
  { key: "provisorios_total", x: 150, y: 262, maxWidth: 52, size: 8 },
  { key: "provisorios_material", x: 150, y: 268, maxWidth: 52, size: 8 },
];

const P1_CHECKS: CheckField[] = [
  // Clareamento externo
  { key: "clareamento_externo_comum", x: 10, y: 70 },
  { key: "clareamento_externo_laser", x: 10, y: 76 },
  { key: "clareamento_externo_apos_ortod", x: 10, y: 82 },
  // Dessensibilização
  { key: "dessensibilizacao_comum", x: 140, y: 70 },
  { key: "dessensibilizacao_laser", x: 140, y: 76 },
  { key: "dessensibilizacao_arcada_sup", x: 178, y: 70 },
  { key: "dessensibilizacao_arcada_inf", x: 178, y: 76 },
  // Decíduos
  { key: "deciduos_condicionamento", x: 10, y: 125 },
  { key: "deciduos_fluor", x: 72, y: 125 },
  { key: "deciduos_arcada_sup", x: 122, y: 125 },
  { key: "deciduos_arcada_inf", x: 168, y: 125 },
  // Endodontia obs
  { key: "endodontia_obs", x: 10, y: 158 },
  // Periodontia
  { key: "perio_fluor", x: 10, y: 163 },
  { key: "perio_profilaxia", x: 10, y: 169 },
  { key: "perio_basica", x: 10, y: 175 },
  { key: "perio_moderada", x: 10, y: 181 },
  { key: "perio_avancada", x: 10, y: 187 },
  // Gengivectomia
  { key: "gengivectomia_obs", x: 140, y: 176 },
  // Provisórios
  { key: "provisorios_fixado_aparelho", x: 10, y: 283 },
];

const P1_TEETH: ToothSection[] = [
  { key: "dentistica_dentes", topY: 50, botY: 61 },
  { key: "endodontia_dentes", topY: 143, botY: 153 },
  { key: "nucleo_dentes", topY: 200, botY: 208 },
  { key: "protese_fixa_dentes", topY: 224, botY: 233 },
  { key: "provisorios_dentes", topY: 256, botY: 266 },
];
const DECID_SECTION: ToothSection = { key: "deciduos_dentes", topY: 108, botY: 118 };

// ─────────────────────────────────────────────────────────────────────────
//  PÁGINA 2
// ─────────────────────────────────────────────────────────────────────────
const P2_TEXT: TextField[] = [
  // Cirurgia — exodontia
  { key: "exodontia_simples", x: 150, y: 79, maxWidth: 52, size: 8 },
  { key: "exodontia_raiz", x: 150, y: 85, maxWidth: 52, size: 8 },
  { key: "exodontia_semi_incluso", x: 150, y: 90, maxWidth: 52, size: 8 },
  { key: "exodontia_incluso", x: 150, y: 95, maxWidth: 52, size: 8 },
  { key: "exodontia_erupcionado", x: 150, y: 100, maxWidth: 52, size: 8 },
  { key: "cirurgia_regularizacao", x: 166, y: 96, maxWidth: 38, size: 7 },
  // Implante
  { key: "implante_total_superior", x: 150, y: 110, maxWidth: 24, size: 8 },
  { key: "implante_total_inferior", x: 185, y: 110, maxWidth: 20, size: 8 },
  { key: "implante_coroas_dentes", x: 150, y: 120, maxWidth: 55, size: 8 },
  { key: "implante_guia", x: 40, y: 140, maxWidth: 42, size: 8 },
  { key: "implante_enxerto_bloco", x: 40, y: 150, maxWidth: 34, size: 7 },
  { key: "implante_enxerto_liofilizado", x: 110, y: 150, maxWidth: 34, size: 7 },
  { key: "implante_elevacao_seio", x: 178, y: 150, maxWidth: 28, size: 7 },
  // Opções de tratamento (1, 2, 3)
  { key: "opcao_tratamento_1", x: 12, y: 167, maxWidth: 56, maxLines: 3, size: 8 },
  { key: "opcao_tratamento_2", x: 77, y: 167, maxWidth: 56, maxLines: 3, size: 8 },
  { key: "opcao_tratamento_3", x: 142, y: 167, maxWidth: 56, maxLines: 3, size: 8 },
  // Observações
  { key: "observacoes", x: 14, y: 195, maxWidth: 188, maxLines: 2, size: 8 },
  // Ortodontia (campos)
  { key: "ortod_mini_implante", x: 92, y: 207, maxWidth: 30, size: 7 },
  { key: "ortod_tracionamento", x: 92, y: 213, maxWidth: 30, size: 7 },
  // Radiografia
  { key: "radio_tomografia", x: 92, y: 236, maxWidth: 32, size: 7 },
  { key: "radio_periapical", x: 168, y: 236, maxWidth: 34, size: 7 },
];

const P2_CHECKS: CheckField[] = [
  // Prótese Total
  { key: "pt_definitiva_superior", x: 10, y: 15 },
  { key: "pt_imediata_sup", x: 10, y: 21 },
  { key: "pt_definitiva_inferior", x: 95, y: 15 },
  { key: "pt_imediata_inf", x: 95, y: 21 },
  { key: "pt_nacionais", x: 150, y: 15 },
  { key: "pt_importados", x: 150, y: 21 },
  // PPR
  { key: "ppr_definitiva_superior", x: 10, y: 37 },
  { key: "ppr_provisoria_sup", x: 10, y: 43 },
  { key: "ppr_flex_superior", x: 10, y: 49 },
  { key: "ppr_definitiva_inferior", x: 95, y: 37 },
  { key: "ppr_provisoria_inf", x: 95, y: 43 },
  { key: "ppr_flex_inferior", x: 95, y: 49 },
  { key: "ppr_nacionais", x: 150, y: 37 },
  { key: "ppr_importados", x: 150, y: 43 },
  // ATM
  { key: "atm_placa_mordida", x: 10, y: 63 },
  { key: "atm_placa_disfuncao", x: 95, y: 63 },
  // Cirurgia
  { key: "cirurgia_frenectomia", x: 10, y: 96 },
  { key: "cirurgia_biopsia", x: 55, y: 96 },
  { key: "cirurgia_hiperplasia", x: 95, y: 96 },
  // Implante (esquerda)
  { key: "implante_apos_ortodontia", x: 10, y: 128 },
  { key: "implante_pinos_importados", x: 10, y: 134 },
  // Implante (direita)
  { key: "implante_overdenture_sup", x: 126, y: 123 },
  { key: "implante_overdenture_inf", x: 126, y: 128 },
  { key: "implante_protocolo_sup", x: 126, y: 133 },
  { key: "implante_protocolo_inf", x: 126, y: 138 },
  { key: "implante_protocolo_carga_sup", x: 126, y: 143 },
  { key: "implante_protocolo_carga_inf", x: 126, y: 148 },
  { key: "implante_zigomatico", x: 126, y: 153 },
  // Ortodontia
  { key: "ortod_alinhador", x: 10, y: 207 },
  { key: "ortod_auto_ligado", x: 10, y: 213 },
  { key: "ortod_convencional", x: 10, y: 219 },
  { key: "ortod_ortopedia", x: 10, y: 225 },
  { key: "ortod_cir_ortognatica", x: 70, y: 219 },
  { key: "ortod_documentacao", x: 70, y: 225 },
  { key: "ortod_panoramica", x: 130, y: 207 },
  // Bráquetes
  { key: "braquetes_porcelana", x: 165, y: 207 },
  { key: "braquetes_safira", x: 190, y: 207 },
  { key: "braquetes_policarbonato", x: 165, y: 213 },
  { key: "braquetes_metalico", x: 190, y: 213 },
  // Radiografia
  { key: "radio_panoramica", x: 10, y: 236 },
  // E.S. / R.V. / R.P.
  { key: "es_am", x: 22, y: 247 },
  { key: "es_an", x: 40, y: 247 },
  { key: "es_ex", x: 56, y: 247 },
  { key: "es_em", x: 72, y: 247 },
  { key: "rv_min", x: 108, y: 247 },
  { key: "rv_med", x: 126, y: 247 },
  { key: "rv_total", x: 145, y: 247 },
  { key: "rp_min", x: 180, y: 247 },
  { key: "rp_med", x: 194, y: 247 },
  { key: "rp_total", x: 205, y: 247 },
];

const P2_TEETH: ToothSection[] = [
  { key: "cirurgia_dentes", topY: 78, botY: 88 },
  { key: "implante_dentes", topY: 107, botY: 115 },
];

// Data + assinaturas (rodapé página 2)
const DATE_POS = { x: 22, y: 258, size: 9, maxWidth: 130 };
const SIG_CLINICA = { x: 12, y: 262, w: 75, h: 14 };
const SIG_PACIENTE = { x: 118, y: 262, w: 78, h: 14 };

// ── Helpers ─────────────────────────────────────────────────────────────
const MESES = [
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

function fmtDate(d?: string | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

// "Paulínia, 28 de junho de 2026"
function fmtLocalDate(city: string | null | undefined, iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return city ?? "";
  const data = `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  const c = (city ?? "").trim();
  return c ? `${c}, ${data}` : data;
}

async function toBase64(url: string, attempt = 0): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    if (attempt < 1) return toBase64(url, attempt + 1);
    console.error(`[ficha-pdf] falha ao carregar template: ${url}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  CALIBRAÇÃO — grade vermelha de 10 mm
// ─────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateFichaCalibrationPdf(): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bg2] = await Promise.all([toBase64(URLS.p1), toBase64(URLS.p2)]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addGrid = (doc: any) => {
    doc.setLineWidth(0.1);
    doc.setDrawColor(255, 0, 0);
    doc.setFontSize(3.5);
    doc.setTextColor(255, 0, 0);
    for (let x = 0; x <= W; x += 10) {
      doc.line(x, 0, x, H);
      doc.text(String(x), x + 0.3, 3.5);
    }
    for (let y = 0; y <= H; y += 10) {
      doc.line(0, y, W, y);
      doc.text(String(y), 0.5, y > 0 ? y - 0.5 : 3.5);
    }
  };
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  [bg1, bg2].forEach((bg, i) => {
    if (i > 0) doc.addPage();
    if (bg) {
      try {
        doc.addImage(bg, "JPEG", 0, 0, W, H);
      } catch {
        /* skip */
      }
    }
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 200);
    doc.text(`PÁGINA ${i + 1} — calibração (grade 10mm)`, 5, 8);
    addGrid(doc);
  });
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────
//  GERAÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────
export async function generateFichaAvaliacaoPdf(
  ficha: FichaData & Partial<FichaRow>,
  opts: { cidade?: string | null } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bg2] = await Promise.all([toBase64(URLS.p1), toBase64(URLS.p2)]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const setFont = (size = 9, bold = true) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...NAVY);
  };
  const lineMm = (sizePt: number) => sizePt * 0.3528 * 1.15;

  const fitText = (
    val: string | null | undefined,
    x: number,
    y: number,
    maxWidth: number,
    maxLines = 1,
    baseSize = 9,
    minSize = 5,
  ) => {
    const v = (val ?? "").toString().trim();
    if (!v) return;
    let chosen = minSize;
    let lines: string[] = [];
    for (let s = baseSize; s >= minSize; s--) {
      doc.setFontSize(s);
      const wrapped = doc.splitTextToSize(v, maxWidth) as string[];
      if (wrapped.length <= maxLines) {
        chosen = s;
        lines = wrapped;
        break;
      }
      if (s === minSize) {
        chosen = s;
        lines = wrapped;
      }
    }
    doc.setFontSize(chosen);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1] ?? "";
      while (last.length > 0 && doc.getTextWidth(last + "…") > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    const lh = lineMm(chosen);
    lines.forEach((ln, i) => doc.text(ln, x, y + i * lh));
    setFont();
  };

  // "X" verde centrado em (x,y) — usado para checkboxes E dentes.
  const mark = (x: number, y: number, size = 10) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...GREEN);
    doc.text("X", x, y, { align: "center", baseline: "middle" });
    setFont();
  };

  const drawSignature = (
    dataUrl: string,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
  ) => {
    let imgW = 3,
      imgH = 1;
    try {
      const props = doc.getImageProperties(dataUrl);
      imgW = props.width;
      imgH = props.height;
    } catch {
      /* proporção padrão */
    }
    const scale = Math.min(cellW / imgW, cellH / imgH);
    const w = imgW * scale,
      h = imgH * scale;
    const x = cellX + (cellW - w) / 2;
    const y = cellY + (cellH - h) / 2;
    try {
      doc.addImage(dataUrl, "PNG", x, y, w, h);
    } catch {
      /* skip */
    }
  };

  const renderText = (fields: TextField[]) => {
    for (const f of fields) {
      const raw = ficha[f.key] as unknown;
      const val = f.date ? fmtDate(raw as string) : (raw as string);
      fitText(val, f.x, f.y, f.maxWidth, f.maxLines ?? 1, f.size ?? 9, f.minSize ?? 5);
    }
  };
  const renderChecks = (fields: CheckField[]) => {
    for (const f of fields) if (ficha[f.key]) mark(f.x, f.y, 10);
  };
  const renderTeeth = (sections: ToothSection[], teethX: Record<string, number>) => {
    for (const s of sections) {
      const map = (ficha[s.key] ?? {}) as Record<string, boolean>;
      for (const [dente, marked] of Object.entries(map)) {
        if (!marked) continue;
        const x = teethX[dente];
        if (x == null) continue;
        mark(x, isSup(dente) ? s.topY : s.botY, 11);
      }
    }
  };

  // ═══ PÁGINA 1 ═══
  if (bg1) {
    try {
      doc.addImage(bg1, "JPEG", 0, 0, W, H);
    } catch {
      /* skip */
    }
  }
  setFont();
  renderText(P1_TEXT);
  renderChecks(P1_CHECKS);
  renderTeeth(P1_TEETH, ADULT_X_P1);
  renderTeeth([DECID_SECTION], DECID_X);

  // ═══ PÁGINA 2 ═══
  doc.addPage();
  if (bg2) {
    try {
      doc.addImage(bg2, "JPEG", 0, 0, W, H);
    } catch {
      /* skip */
    }
  }
  setFont();
  renderText(P2_TEXT);
  renderChecks(P2_CHECKS);
  renderTeeth(P2_TEETH, ADULT_X_P2);

  // Data ("Cidade, DD de mês de AAAA") — usa a data de assinatura do paciente.
  setFont(DATE_POS.size);
  fitText(
    fmtLocalDate(opts.cidade, ficha.paciente_assinado_em ?? ficha.clinica_assinada_em ?? null),
    DATE_POS.x,
    DATE_POS.y,
    DATE_POS.maxWidth,
    1,
    DATE_POS.size,
    7,
  );

  // Assinaturas
  if (ficha.assinatura_clinica)
    drawSignature(
      ficha.assinatura_clinica,
      SIG_CLINICA.x,
      SIG_CLINICA.y,
      SIG_CLINICA.w,
      SIG_CLINICA.h,
    );
  if (ficha.assinatura_paciente)
    drawSignature(
      ficha.assinatura_paciente,
      SIG_PACIENTE.x,
      SIG_PACIENTE.y,
      SIG_PACIENTE.w,
      SIG_PACIENTE.h,
    );

  return doc;
}

// Baixa o PDF da ficha com nome amigável.
export async function downloadFichaAvaliacaoPdf(
  ficha: FichaData & Partial<FichaRow>,
  opts: { cidade?: string | null } = {},
): Promise<void> {
  const doc = await generateFichaAvaliacaoPdf(ficha, opts);
  const nome = (ficha.paciente_nome || "paciente").replace(/\s+/g, "_");
  doc.save(`ficha-avaliacao-${nome}.pdf`);
}
