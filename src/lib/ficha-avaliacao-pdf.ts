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
 *  COORDENADAS CENTRALIZADAS — todas as posições (mm) vivem nos objetos de
 *  config abaixo. Nenhuma coordenada "solta" no render.
 *
 *  ⚠ As coordenadas foram estimadas a partir das imagens de fundo. Para o
 *  ajuste fino, use generateFichaCalibrationPdf() — gera o PDF com uma grade
 *  vermelha de 10 mm sobre cada página (mesmo fluxo do prontuário).
 *
 *  O fundo (template) é SEMPRE desenhado antes do texto.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { FichaData, FichaRow } from "@/lib/ficha-avaliacao";

const URLS = {
  p1: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-avaliacao-pagina-1.jpg",
  p2: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-avaliacao-pagina-2.jpg",
};

const W = 210,
  H = 297; // A4 retrato, mm

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
// Seção de odontograma: chave do mapa de dentes + Y das duas arcadas.
type ToothSection = { key: keyof FichaData; topY: number; botY: number };

// ── Odontograma adulto — X (mm) de cada dente, comum a todas as seções ───────
// 8 dentes (quadrante direito) + intervalo central + 8 dentes (esquerdo).
const ADULT_TEETH_X: Record<string, number> = {
  "18": 15,
  "17": 21,
  "16": 27,
  "15": 33,
  "14": 39,
  "13": 45,
  "12": 51,
  "11": 57,
  "21": 70,
  "22": 76,
  "23": 82,
  "24": 88,
  "25": 94,
  "26": 100,
  "27": 106,
  "28": 112,
  "48": 15,
  "47": 21,
  "46": 27,
  "45": 33,
  "44": 39,
  "43": 45,
  "42": 51,
  "41": 57,
  "31": 70,
  "32": 76,
  "33": 82,
  "34": 88,
  "35": 94,
  "36": 100,
  "37": 106,
  "38": 112,
};
const isSuperior = (d: string) => d.startsWith("1") || d.startsWith("2");

// Decíduos — X próprio (10 dentes: 5 + 5).
const DECID_TEETH_X: Record<string, number> = {
  "55": 18,
  "54": 25,
  "53": 32,
  "52": 39,
  "51": 46,
  "61": 60,
  "62": 67,
  "63": 74,
  "64": 81,
  "65": 88,
  "85": 18,
  "84": 25,
  "83": 32,
  "82": 39,
  "81": 46,
  "71": 60,
  "72": 67,
  "73": 74,
  "74": 81,
  "75": 88,
};
const isSupDecid = (d: string) => d.startsWith("5") || d.startsWith("6");

// ─────────────────────────────────────────────────────────────────────────
//  PÁGINA 1
// ─────────────────────────────────────────────────────────────────────────
const P1_TEXT: TextField[] = [
  // Cabeçalho
  { key: "numero_contrato", x: 47, y: 13.5, maxWidth: 28 },
  { key: "numero_prontuario", x: 108, y: 13.5, maxWidth: 28 },
  { key: "paciente_nome", x: 42, y: 22, maxWidth: 62, size: 9 },
  { key: "paciente_telefone", x: 112, y: 22, maxWidth: 28 },
  { key: "paciente_data_nascimento", x: 168, y: 22, maxWidth: 36, date: true },
  { key: "paciente_cpf", x: 22, y: 29, maxWidth: 28 },
  { key: "origem", x: 62, y: 29, maxWidth: 28 },
  { key: "avaliador", x: 108, y: 29, maxWidth: 22 },
  { key: "data_avaliacao", x: 138, y: 29, maxWidth: 24, date: true },
  { key: "paciente_email", x: 178, y: 29, maxWidth: 28, size: 7 },

  // Dentística (texto à direita do odontograma)
  { key: "dentistica_restauracao_dentes", x: 150, y: 47, maxWidth: 52, maxLines: 2, size: 8 },
  { key: "dentistica_total", x: 165, y: 56, maxWidth: 38, size: 8 },

  // Clareamento / Dessensibilização
  { key: "clareamento_externo_apenas_arcada", x: 38, y: 80, maxWidth: 28, size: 8 },
  { key: "clareamento_interno", x: 80, y: 76, maxWidth: 55, maxLines: 2, size: 8 },
  { key: "dessensibilizacao_obs", x: 150, y: 80, maxWidth: 52, size: 8 },

  // Decíduos — campos à direita
  { key: "deciduos_oclusao_devida", x: 130, y: 92, maxWidth: 72, size: 8 },
  { key: "deciduos_cavidade_causal", x: 130, y: 98, maxWidth: 72, size: 8 },
  { key: "deciduos_cirurgia_agendada", x: 130, y: 104, maxWidth: 72, size: 8 },
  { key: "deciduos_replantacao", x: 130, y: 110, maxWidth: 72, size: 8 },

  // Endodontia — tabela UNI/BI/TRI (à direita)
  { key: "endodontia_uni_tratamento", x: 150, y: 131, maxWidth: 24, size: 8 },
  { key: "endodontia_uni_retratamento", x: 180, y: 131, maxWidth: 24, size: 8 },
  { key: "endodontia_bi_tratamento", x: 150, y: 137, maxWidth: 24, size: 8 },
  { key: "endodontia_bi_retratamento", x: 180, y: 137, maxWidth: 24, size: 8 },
  { key: "endodontia_tri_tratamento", x: 150, y: 143, maxWidth: 24, size: 8 },
  { key: "endodontia_tri_retratamento", x: 180, y: 143, maxWidth: 24, size: 8 },

  // Periodontia / Gengivectomia
  { key: "gengivectomia_dentes", x: 150, y: 168, maxWidth: 52, size: 8 },

  // Núcleo p/ prótese fixa
  { key: "nucleo_nos_dentes", x: 150, y: 192, maxWidth: 52, size: 8 },
  { key: "nucleo_total", x: 150, y: 198, maxWidth: 52, size: 8 },
  { key: "nucleo_material", x: 150, y: 204, maxWidth: 52, size: 8 },

  // Prótese fixa definitiva
  { key: "protese_elemento_definitivo", x: 150, y: 224, maxWidth: 52, size: 8 },
  { key: "protese_onlay_inlay", x: 150, y: 230, maxWidth: 52, size: 8 },
  { key: "protese_faceta", x: 150, y: 236, maxWidth: 52, size: 8 },
  { key: "protese_lente_contato", x: 150, y: 242, maxWidth: 52, size: 8 },
  { key: "protese_fixa_material", x: 30, y: 250, maxWidth: 70, size: 8 },

  // Provisórios
  { key: "provisorios_nos_dentes", x: 150, y: 262, maxWidth: 52, size: 8 },
  { key: "provisorios_total", x: 150, y: 268, maxWidth: 52, size: 8 },
  { key: "provisorios_material", x: 150, y: 274, maxWidth: 52, size: 8 },
];

const P1_CHECKS: CheckField[] = [
  // Clareamento externo
  { key: "clareamento_externo_comum", x: 12, y: 68 },
  { key: "clareamento_externo_laser", x: 12, y: 74 },
  { key: "clareamento_externo_apos_ortod", x: 12, y: 80 },
  // Dessensibilização
  { key: "dessensibilizacao_comum", x: 138, y: 68 },
  { key: "dessensibilizacao_laser", x: 138, y: 74 },
  { key: "dessensibilizacao_arcada_sup", x: 178, y: 68 },
  { key: "dessensibilizacao_arcada_inf", x: 178, y: 74 },
  // Decíduos
  { key: "deciduos_condicionamento", x: 12, y: 117 },
  { key: "deciduos_fluor", x: 70, y: 117 },
  { key: "deciduos_arcada_sup", x: 120, y: 117 },
  { key: "deciduos_arcada_inf", x: 165, y: 117 },
  // Endodontia obs
  { key: "endodontia_obs", x: 12, y: 150 },
  // Periodontia
  { key: "perio_fluor", x: 12, y: 158 },
  { key: "perio_profilaxia", x: 12, y: 164 },
  { key: "perio_basica", x: 12, y: 170 },
  { key: "perio_moderada", x: 12, y: 176 },
  { key: "perio_avancada", x: 12, y: 182 },
  { key: "gengivectomia_obs", x: 138, y: 174 },
  // Provisórios
  { key: "provisorios_fixado_aparelho", x: 12, y: 284 },
];

const P1_TEETH: ToothSection[] = [
  { key: "dentistica_dentes", topY: 45, botY: 53 },
  { key: "endodontia_dentes", topY: 128, botY: 136 },
  { key: "nucleo_dentes", topY: 189, botY: 197 },
  { key: "protese_fixa_dentes", topY: 219, botY: 227 },
  { key: "provisorios_dentes", topY: 259, botY: 267 },
];

// ─────────────────────────────────────────────────────────────────────────
//  PÁGINA 2
// ─────────────────────────────────────────────────────────────────────────
const P2_TEXT: TextField[] = [
  // Cirurgia — exodontia (à direita)
  { key: "exodontia_simples", x: 150, y: 96, maxWidth: 52, size: 8 },
  { key: "exodontia_raiz", x: 150, y: 102, maxWidth: 52, size: 8 },
  { key: "exodontia_semi_incluso", x: 150, y: 108, maxWidth: 52, size: 8 },
  { key: "exodontia_incluso", x: 150, y: 114, maxWidth: 52, size: 8 },
  { key: "exodontia_erupcionado", x: 150, y: 120, maxWidth: 52, size: 8 },
  { key: "cirurgia_regularizacao", x: 150, y: 134, maxWidth: 52, size: 8 },
  // Implante
  { key: "implante_total_superior", x: 135, y: 158, maxWidth: 28, size: 8 },
  { key: "implante_total_inferior", x: 180, y: 158, maxWidth: 26, size: 8 },
  { key: "implante_coroas_dentes", x: 120, y: 170, maxWidth: 84, size: 8 },
  { key: "implante_guia", x: 38, y: 218, maxWidth: 40, size: 8 },
  { key: "implante_enxerto_bloco", x: 38, y: 230, maxWidth: 30, size: 8 },
  { key: "implante_enxerto_liofilizado", x: 110, y: 230, maxWidth: 30, size: 8 },
  { key: "implante_elevacao_seio", x: 180, y: 230, maxWidth: 26, size: 8 },
  // Opções de tratamento (1, 2, 3) — caixas grandes
  { key: "opcao_tratamento_1", x: 16, y: 250, maxWidth: 58, maxLines: 3, size: 8 },
  { key: "opcao_tratamento_2", x: 80, y: 250, maxWidth: 58, maxLines: 3, size: 8 },
  { key: "opcao_tratamento_3", x: 144, y: 250, maxWidth: 58, maxLines: 3, size: 8 },
  // Observações
  { key: "observacoes", x: 14, y: 280, maxWidth: 188, maxLines: 2, size: 8 },
  // Ortodontia
  { key: "ortod_mini_implante", x: 95, y: 300, maxWidth: 28, size: 8 },
  { key: "ortod_tracionamento", x: 95, y: 306, maxWidth: 28, size: 8 },
  // Radiografia
  { key: "radio_tomografia", x: 95, y: 330, maxWidth: 32, size: 8 },
  { key: "radio_periapical", x: 165, y: 330, maxWidth: 32, size: 8 },
];

const P2_CHECKS: CheckField[] = [
  // Prótese Total
  { key: "pt_definitiva_superior", x: 12, y: 22 },
  { key: "pt_imediata_sup", x: 12, y: 28 },
  { key: "pt_definitiva_inferior", x: 95, y: 22 },
  { key: "pt_imediata_inf", x: 95, y: 28 },
  { key: "pt_nacionais", x: 150, y: 22 },
  { key: "pt_importados", x: 150, y: 28 },
  // PPR
  { key: "ppr_definitiva_superior", x: 12, y: 44 },
  { key: "ppr_provisoria_sup", x: 12, y: 50 },
  { key: "ppr_flex_superior", x: 12, y: 56 },
  { key: "ppr_definitiva_inferior", x: 95, y: 44 },
  { key: "ppr_provisoria_inf", x: 95, y: 50 },
  { key: "ppr_flex_inferior", x: 95, y: 56 },
  { key: "ppr_nacionais", x: 150, y: 44 },
  { key: "ppr_importados", x: 150, y: 50 },
  // ATM
  { key: "atm_placa_mordida", x: 12, y: 70 },
  { key: "atm_placa_disfuncao", x: 95, y: 70 },
  // Cirurgia
  { key: "cirurgia_frenectomia", x: 12, y: 128 },
  { key: "cirurgia_biopsia", x: 55, y: 128 },
  { key: "cirurgia_hiperplasia", x: 95, y: 128 },
  // Implante checkboxes (direita)
  { key: "implante_overdenture_sup", x: 120, y: 178 },
  { key: "implante_overdenture_inf", x: 120, y: 184 },
  { key: "implante_protocolo_sup", x: 120, y: 190 },
  { key: "implante_protocolo_inf", x: 120, y: 196 },
  { key: "implante_protocolo_carga_sup", x: 120, y: 202 },
  { key: "implante_protocolo_carga_inf", x: 120, y: 208 },
  { key: "implante_zigomatico", x: 120, y: 214 },
  // Implante checkboxes (esquerda)
  { key: "implante_apos_ortodontia", x: 12, y: 206 },
  { key: "implante_pinos_importados", x: 12, y: 212 },
  // Ortodontia
  { key: "ortod_alinhador", x: 12, y: 300 },
  { key: "ortod_auto_ligado", x: 12, y: 306 },
  { key: "ortod_convencional", x: 12, y: 312 },
  { key: "ortod_ortopedia", x: 12, y: 318 },
  { key: "ortod_panoramica", x: 130, y: 312 },
  { key: "ortod_cir_ortognatica", x: 60, y: 312 },
  { key: "ortod_documentacao", x: 60, y: 318 },
  // Bráquetes
  { key: "braquetes_porcelana", x: 165, y: 300 },
  { key: "braquetes_safira", x: 188, y: 300 },
  { key: "braquetes_policarbonato", x: 165, y: 306 },
  { key: "braquetes_metalico", x: 188, y: 306 },
  // Radiografia
  { key: "radio_panoramica", x: 12, y: 330 },
  // E.S. / R.V. / R.P. — uma linha
  { key: "es_am", x: 22, y: 344 },
  { key: "es_an", x: 38, y: 344 },
  { key: "es_ex", x: 54, y: 344 },
  { key: "es_em", x: 70, y: 344 },
  { key: "rv_min", x: 100, y: 344 },
  { key: "rv_med", x: 118, y: 344 },
  { key: "rv_total", x: 138, y: 344 },
  { key: "rp_min", x: 165, y: 344 },
  { key: "rp_med", x: 180, y: 344 },
  { key: "rp_total", x: 196, y: 344 },
];

const P2_TEETH: ToothSection[] = [
  { key: "cirurgia_dentes", topY: 92, botY: 100 },
  { key: "implante_dentes", topY: 156, botY: 164 },
];

// Assinaturas no rodapé da página 2 (duas caixas).
const SIG_CLINICA = { x: 25, y: 360, w: 60, h: 16 };
const SIG_PACIENTE = { x: 125, y: 360, w: 60, h: 16 };

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
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
//  CALIBRAÇÃO — grade vermelha de 10 mm sobre cada fundo
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bg2] = await Promise.all([toBase64(URLS.p1), toBase64(URLS.p2)]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const TEXT_COLOR: [number, number, number] = [26, 58, 107]; // navy

  const setFont = (size = 9, bold = true) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...TEXT_COLOR);
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

  const check = (x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 120, 0);
    doc.text("X", x, y, { align: "center", baseline: "middle" });
    setFont();
  };

  // "●" sobre o dente marcado (X também serve; usamos ponto cheio).
  const toothMark = (x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(200, 0, 0);
    doc.text("●", x, y, { align: "center", baseline: "middle" });
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
    for (const f of fields) if (ficha[f.key]) check(f.x, f.y);
  };
  const renderTeeth = (
    sections: ToothSection[],
    teethX: Record<string, number>,
    isSup: (d: string) => boolean,
  ) => {
    for (const s of sections) {
      const map = (ficha[s.key] ?? {}) as Record<string, boolean>;
      for (const [dente, marked] of Object.entries(map)) {
        if (!marked) continue;
        const x = teethX[dente];
        if (x == null) continue;
        toothMark(x, isSup(dente) ? s.topY : s.botY);
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
  renderTeeth(P1_TEETH, ADULT_TEETH_X, isSuperior);
  // Decíduos (X próprio)
  {
    const map = (ficha.deciduos_dentes ?? {}) as Record<string, boolean>;
    for (const [dente, marked] of Object.entries(map)) {
      if (!marked) continue;
      const x = DECID_TEETH_X[dente];
      if (x == null) continue;
      toothMark(x, isSupDecid(dente) ? 88 : 96);
    }
  }

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
  renderTeeth(P2_TEETH, ADULT_TEETH_X, isSuperior);

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
): Promise<void> {
  const doc = await generateFichaAvaliacaoPdf(ficha);
  const nome = (ficha.paciente_nome || "paciente").replace(/\s+/g, "_");
  doc.save(`ficha-avaliacao-${nome}.pdf`);
}
