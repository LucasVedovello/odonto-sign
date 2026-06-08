/**
 * prontuario-pdf.ts
 * A4 landscape (297 × 210 mm), jsPDF unit: 'mm'
 *
 * Pages:
 *   1 — IOP046 Ficha de Planejamento (frente): cabeçalho, anamnese, planejamento, arcada superior
 *   2 — IOP046 verso: arcada inferior + odontograma
 *   3+ — IOP043 Eventos Efetivamente Realizados
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  COORDENADAS CENTRALIZADAS
 * ─────────────────────────────────────────────────────────────────────────
 *  Todas as posições (mm) vivem nos objetos de configuração abaixo. NENHUMA
 *  coordenada deve ser escrita "solta" no código de renderização — para
 *  recalibrar, edite SOMENTE estes objetos.
 *
 *  Os valores foram medidos automaticamente a partir das linhas das imagens
 *  de fundo (ficha-*.jpg) no MESMO espaço de coordenadas em que o renderizador
 *  desenha (a imagem é esticada para preencher 297×210 mm). Ferramentas usadas:
 *    • generateCalibrationPdf() — grade vermelha de 10 mm sobre cada fundo.
 *
 *  NOTA sobre a arcada superior: o template IOP046 possui apenas 14 colunas de
 *  dentes (omite o 23). O formulário de captura coleta 16 dentes; dentes sem
 *  coluna no template (23 e o último molar) não são impressos. Confirme o
 *  mapeamento dos molares finais (26/27/28) contra uma impressão física.
 */

const URLS = {
  plano:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg",
  verso:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento-verso.jpg",
  eventos: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg",
};

const W = 297, H = 210; // A4 landscape, mm

// ── Tipos de configuração ─────────────────────────────────────────────────
type FieldPos = {
  /** chave do dado em `p` (snake_case do banco) */
  key: string;
  x: number;
  y: number;
  /** formata datas YYYY-MM-DD → DD/MM/YYYY */
  date?: boolean;
  /** tamanho de fonte (default 10) */
  size?: number;
  /** largura máxima em mm (quebra/clipa a 1ª linha) */
  maxWidth?: number;
};

// ─────────────────────────────────────────────────────────────────────────
//  IOP046 — campos de texto (cabeçalho + anamnese + médico + planejamento)
// ─────────────────────────────────────────────────────────────────────────
const IOP046_FIELDS: FieldPos[] = [
  // Cabeçalho — linha 1
  { key: "data",            x: 73,  y: 11.5, date: true },
  { key: "planejado_por",   x: 138, y: 11.5, size: 8, maxWidth: 26 },
  { key: "num_prontuario",  x: 240, y: 11.5 },
  { key: "num_contrato",    x: 270, y: 11.5 },
  // Cabeçalho — linha 2
  { key: "nome",            x: 70,  y: 20 },
  { key: "data_nasc",       x: 233, y: 20, date: true },
  { key: "rg",              x: 268, y: 20 },
  // Cabeçalho — linha 3
  { key: "endereco",        x: 92,  y: 28.5 },
  { key: "telefone",        x: 268, y: 28.5 },

  // Anamnese — 4 colunas × 4 linhas (fonte menor, espaços estreitos)
  { key: "alergico",          x: 50,  y: 36, size: 8 },
  { key: "esta_gravida",      x: 109, y: 36, size: 8 },
  { key: "fuma",              x: 157, y: 36, size: 8 },
  { key: "hepatite",          x: 205, y: 36, size: 8 },

  { key: "hemorragia",        x: 50,  y: 42, size: 8 },
  { key: "prob_respiratorio", x: 109, y: 42, size: 8 },
  { key: "bebe",              x: 157, y: 42, size: 8 },
  { key: "ts_tc",             x: 205, y: 42, size: 8 },

  { key: "diabetes",          x: 50,  y: 48, size: 8 },
  { key: "dst_aids_sifilis",  x: 109, y: 48, size: 8 },
  { key: "gastrointestinal",  x: 157, y: 48, size: 8 },
  { key: "convulsivo",        x: 205, y: 48, size: 8 },

  { key: "cardiopatia",       x: 50,  y: 54, size: 8 },
  { key: "usa_drogas",        x: 109, y: 54, size: 8 },
  { key: "cicatrizacao",      x: 157, y: 54, size: 8 },
  { key: "pressao_arterial",  x: 205, y: 54, size: 8 },

  // Coluna direita — vigência / médico
  { key: "vigencia_de",   x: 230, y: 42, date: true, size: 8 },
  { key: "vigencia_ate",  x: 262, y: 42, date: true, size: 8 },
  { key: "medico",        x: 233, y: 49, size: 8 },
  { key: "fone_medico",   x: 250, y: 55, size: 8 },

  // Faixa medicamentos / outro problema / queixa principal (linha abaixo do rótulo)
  { key: "medicamentos",     x: 15,  y: 68, size: 8, maxWidth: 73 },
  { key: "outro_problema",   x: 92,  y: 68, size: 8, maxWidth: 73 },
  { key: "queixa_principal", x: 169, y: 68, size: 8, maxWidth: 62 },

  // Planejamento e prognóstico / cobertura (multilinha — tratados à parte)
];

// Campos multilinha (planejamento / cobertura) — config separada
const IOP046_TEXTAREAS = {
  planejamento_prognostico: { x: 12,  y: 82, maxWidth: 182 },
  cobertura:                { x: 201, y: 82, maxWidth: 88 },
};

// Assinatura do paciente (cláusula "ATESTO…") na página 1
const IOP046_SIG_PACIENTE = { x: 236, y: 60, w: 55, h: 9 };

// ─────────────────────────────────────────────────────────────────────────
//  Arcada Superior (página 1) — centros de coluna (X) e de linha (Y), em mm
// ─────────────────────────────────────────────────────────────────────────
const ARCADA_SUP = {
  teethX: {
    "18": 65.3, "17": 81.6, "16": 98,   "15": 114.4, "14": 131,   "13": 148.1, "12": 164.7,
    "11": 181.6, "21": 198.6, "22": 215.5, "24": 232.4, "25": 249.5, "26": 266.8, "28": 283.6,
  } as Record<string, number>,
  procY: {
    periodontia: 138, endodontia: 151, clareamento: 163,
    dentistica: 176, nucleo: 189, provisoria: 201, definitiva: 207,
  } as Record<string, number>,
};

// ─────────────────────────────────────────────────────────────────────────
//  Arcada Inferior (página 2) — 16 colunas
// ─────────────────────────────────────────────────────────────────────────
const ARCADA_INF = {
  teethX: {
    "48": 53.65, "47": 69.2, "46": 85.1, "45": 100.85, "44": 116.15, "43": 131.35,
    "42": 146.15, "41": 160.65, "31": 175.2, "32": 189.8, "33": 204.45, "34": 219.15,
    "35": 234.45, "36": 250.2, "37": 266, "38": 281.95,
  } as Record<string, number>,
  procY: {
    definitiva: 29, provisoria: 43, nucleo: 57, dentistica: 71,
    clareamento: 84, endodontia: 98, periodontia: 112,
  } as Record<string, number>,
};

// ─────────────────────────────────────────────────────────────────────────
//  Odontograma (página 2) — 4 blocos de 8 dentes
// ─────────────────────────────────────────────────────────────────────────
const ODONTOGRAMA = {
  yStart: 131,
  rowHeight: 7.4,
  maxWidth: 58,
  blocks: [
    { dentes: [18, 17, 16, 15, 14, 13, 12, 11], xTxt: 22 },
    { dentes: [21, 22, 23, 24, 25, 26, 27, 28], xTxt: 95 },
    { dentes: [38, 37, 36, 35, 34, 33, 32, 31], xTxt: 165 },
    { dentes: [41, 42, 43, 44, 45, 46, 47, 48], xTxt: 235 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
//  IOP043 — Eventos Efetivamente Realizados
// ─────────────────────────────────────────────────────────────────────────
const IOP043_CONFIG = {
  header: {
    nome:           { x: 102, y: 24 },
    num_contrato:   { x: 215, y: 24 },
    num_prontuario: { x: 262, y: 24 },
  },
  startY: 38.5,       // baseline da 1ª linha de eventos
  rowHeight: 8.9,
  perPage: 19,
  procMaxWidth: 170,
  columns: {
    data:         { x: 9 },
    dente:        { x: 40 },
    procedimento: { x: 58 },
    dentista:     { x: 234 },
    // paciente: coluna deixada em branco (assinatura à mão)
  },
  // Assinaturas no rodapé da última página
  sigDoutor:   { x: 40,  y: 205, w: 70, h: 9 },
  sigPaciente: { x: 180, y: 205, w: 70, h: 9 },
};

// Dados gravados capitalizados; spec usa minúsculas
const PROC_KEY: Record<string, string> = {
  periodontia: "Periodontia", endodontia: "Endodontia",
  clareamento: "Clareamento", dentistica: "Dentística",
  nucleo: "Núcleo",           provisoria: "Provisória",
  definitiva: "Definitiva",
};

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────
//  CALIBRAÇÃO — grade vermelha de 10 mm sobre cada fundo
// ─────────────────────────────────────────────────────────────────────────
export async function generateCalibrationPdf(): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(URLS.plano), toBase64(URLS.verso), toBase64(URLS.eventos),
  ]);

  const addGrid = (doc: any) => {
    doc.setLineWidth(0.15); doc.setDrawColor(255, 0, 0);
    doc.setFontSize(3.5);   doc.setTextColor(255, 0, 0);
    for (let x = 0; x <= W; x += 10) {
      doc.line(x, 0, x, H);
      doc.text(String(x), x + 0.3, 3.5);
    }
    for (let y = 0; y <= H; y += 10) {
      doc.line(0, y, W, y);
      doc.text(String(y), 0.5, y > 0 ? y - 0.5 : 3.5);
    }
  };

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pages = [
    { bg: bg1,     label: "PAGE 1 — IOP046 Ficha de Planejamento (frente)" },
    { bg: bgVerso, label: "PAGE 2 — Verso (Arcada Inferior + Odontograma)" },
    { bg: bg2,     label: "PAGE 3 — IOP043 Eventos Efetivamente Realizados" },
  ];
  pages.forEach(({ bg, label }, i) => {
    if (i > 0) doc.addPage();
    if (bg) { try { doc.addImage(bg, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    doc.setFontSize(6); doc.setTextColor(0, 0, 200);
    doc.text(label, 5, 8);
    addGrid(doc);
  });
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────
//  GERAÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────
export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(URLS.plano), toBase64(URLS.verso), toBase64(URLS.eventos),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const TEXT_COLOR: [number, number, number] = [10, 35, 100];

  const setFont = (size = 10, bold = true) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...TEXT_COLOR);
  };

  // desenha uma string (clipando à 1ª linha se maxWidth definido)
  const drawText = (val: string | null | undefined, x: number, y: number, maxWidth?: number) => {
    const v = (val ?? "").toString().trim();
    if (!v) return;
    if (maxWidth) {
      const lines = doc.splitTextToSize(v, maxWidth);
      doc.text(lines[0] ?? "", x, y);
    } else {
      doc.text(v, x, y);
    }
  };

  // ✓ verde centrado em (x,y)
  const check = (x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 120, 0);
    doc.text("✓", x, y, { align: "center", baseline: "middle" });
    setFont();
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — IOP046 frente
  // ═══════════════════════════════════════════════════════════════════════
  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  // Campos simples
  for (const f of IOP046_FIELDS) {
    const raw = p[f.key];
    const val = f.date ? fmtDate(raw) : raw;
    setFont(f.size ?? 10);
    drawText(val, f.x, f.y, f.maxWidth);
  }

  // Textareas (planejamento / cobertura)
  setFont(10);
  for (const [key, cfg] of Object.entries(IOP046_TEXTAREAS)) {
    const v = (p[key] ?? "").toString().trim();
    if (v) doc.text(doc.splitTextToSize(v, cfg.maxWidth), cfg.x, cfg.y);
  }

  // Assinatura do paciente (ATESTO)
  if (p.assinatura_paciente_planejamento) {
    const s = IOP046_SIG_PACIENTE;
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", s.x, s.y, s.w, s.h); } catch { /* skip */ }
  }

  // Arcada superior — checkmarks
  for (const [proc, yRow] of Object.entries(ARCADA_SUP.procY)) {
    for (const [dente, xCol] of Object.entries(ARCADA_SUP.teethX)) {
      if (p.arcada_superior?.[dente]?.[PROC_KEY[proc]]) check(xCol, yRow);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — verso: arcada inferior + odontograma
  // ═══════════════════════════════════════════════════════════════════════
  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  setFont();

  for (const [proc, yRow] of Object.entries(ARCADA_INF.procY)) {
    for (const [dente, xCol] of Object.entries(ARCADA_INF.teethX)) {
      if (p.arcada_inferior?.[dente]?.[PROC_KEY[proc]]) check(xCol, yRow);
    }
  }

  // Odontograma
  setFont(10);
  for (const block of ODONTOGRAMA.blocks) {
    block.dentes.forEach((d, i) => {
      const obs = (p.odontograma?.[d.toString()] ?? "").trim();
      if (obs) doc.text(obs, block.xTxt, ODONTOGRAMA.yStart + i * ODONTOGRAMA.rowHeight, { maxWidth: ODONTOGRAMA.maxWidth });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PÁGINA 3+ — IOP043 eventos
  // ═══════════════════════════════════════════════════════════════════════
  const C = IOP043_CONFIG;
  const totalPags = Math.max(1, Math.ceil(eventos.length / C.perPage));

  for (let pg = 0; pg < totalPags; pg++) {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    setFont();

    // Header
    drawText(p.nome,           C.header.nome.x,           C.header.nome.y);
    drawText(p.num_contrato,   C.header.num_contrato.x,   C.header.num_contrato.y);
    drawText(p.num_prontuario, C.header.num_prontuario.x, C.header.num_prontuario.y);

    // Linhas
    const batch = eventos.slice(pg * C.perPage, (pg + 1) * C.perPage);
    batch.forEach((ev: any, i: number) => {
      const y = C.startY + i * C.rowHeight;
      if (y > H - 8) return;
      drawText(fmtDate(ev.data), C.columns.data.x, y);
      drawText(ev.dente,         C.columns.dente.x, y);
      drawText(ev.procedimento,  C.columns.procedimento.x, y, C.procMaxWidth);
      drawText(ev.dentista,      C.columns.dentista.x, y);
    });
  }

  // Assinaturas no rodapé da última página
  if (p.assinatura_doutor) {
    const s = C.sigDoutor;
    try { doc.addImage(p.assinatura_doutor, "PNG", s.x, s.y, s.w, s.h); } catch { /* skip */ }
  }
  if (p.assinatura_paciente_planejamento) {
    const s = C.sigPaciente;
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", s.x, s.y, s.w, s.h); } catch { /* skip */ }
  }

  return doc;
}
