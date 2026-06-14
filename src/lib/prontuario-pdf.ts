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
 *  coordenada deve ser escrita "solta" no código de renderização.
 *
 *  Proteção de overflow: TODO campo de texto define `maxWidth` (largura da
 *  célula) e `maxLines`. fitText() reduz a fonte de `size` até 5pt para caber;
 *  se não couber, quebra em até `maxLines` linhas; se ainda assim estourar,
 *  trunca com "…". Nenhum texto ultrapassa os limites da célula.
 *
 *  O fundo (template) é SEMPRE desenhado antes do texto. Não há texto fora do
 *  formulário; se um template não carregar, o texto aparenta "flutuar" — por
 *  isso toBase64() tenta novamente em caso de falha de rede.
 */

const URLS = {
  plano:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg",
  verso:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento-verso.jpg",
  protese: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/iop054-protese.jpg",
  eventos: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg",
};

const W = 297, H = 210; // A4 landscape, mm

// ── Tipos de configuração ─────────────────────────────────────────────────
type FieldPos = {
  key: string;       // chave do dado em `p` (snake_case do banco)
  x: number;
  y: number;
  maxWidth: number;  // largura da célula (mm) — obrigatória p/ conter o texto
  maxLines?: number; // linhas permitidas (default 1)
  date?: boolean;    // formata YYYY-MM-DD → DD/MM/YYYY
  size?: number;     // fonte base (default 10); fitText reduz até minSize
  minSize?: number;  // fonte mínima (default 5)
};

// ─────────────────────────────────────────────────────────────────────────
//  IOP046 — campos de texto (cabeçalho + anamnese + médico + medicamentos)
// ─────────────────────────────────────────────────────────────────────────
// NB: no template IOP046 os rótulos (DATA, NOME, PLANEJADO POR, DATA DE NASC…)
// são impressos no TOPO-ESQUERDO de cada célula. Os valores são desenhados
// ABAIXO do rótulo (Y na metade inferior da célula), nunca na mesma linha —
// é isso que evita a sobreposição com a label impressa.
const IOP046_FIELDS: FieldPos[] = [
  // Cabeçalho — linha 1 (célula y 4.6–14; valor abaixo do rótulo, baseline ~12.5)
  { key: "data",            x: 60,  y: 12.5, maxWidth: 28, date: true },
  { key: "planejado_por",   x: 91,  y: 12.5, maxWidth: 34, size: 9 },
  { key: "num_prontuario",  x: 227, y: 12.5, maxWidth: 33 },
  { key: "num_contrato",    x: 263, y: 12.5, maxWidth: 29 },
  // Cabeçalho — linha 2 (célula y 14–23; baseline ~21.5)
  { key: "nome",            x: 60,  y: 21.5, maxWidth: 164 },
  { key: "data_nasc",       x: 227, y: 21.5, maxWidth: 33, date: true },
  { key: "rg",              x: 263, y: 21.5, maxWidth: 29 },
  // Cabeçalho — linha 3 (célula y 23–31.3; baseline ~30)
  { key: "endereco",        x: 60,  y: 30, maxWidth: 200 },
  { key: "telefone",        x: 263, y: 30, maxWidth: 29 },

  // Anamnese — valor na MESMA linha do rótulo. X = fim do rótulo (+gap), maxWidth
  // estende até o divisor da coluna (medido por pixel-scan do template, 4.886 px/mm).
  // Fonte grande (11pt, mín 9) p/ legibilidade; respostas longas truncam com "…".
  { key: "alergico",          x: 33.7,  y: 35.5, maxWidth: 26.5, size: 11, minSize: 9, maxLines: 1 },
  { key: "esta_gravida",      x: 90.6,  y: 35.5, maxWidth: 28.2, size: 11, minSize: 9, maxLines: 1 },
  { key: "fuma",              x: 134.4, y: 35.5, maxWidth: 31.2, size: 11, minSize: 9, maxLines: 1 },
  { key: "hepatite",          x: 185.8, y: 35.5, maxWidth: 29.0, size: 11, minSize: 9, maxLines: 1 },

  { key: "hemorragia",        x: 39.3,  y: 41.5, maxWidth: 20.9, size: 11, minSize: 9, maxLines: 1 },
  { key: "prob_respiratorio", x: 102.1, y: 41.5, maxWidth: 16.7, size: 11, minSize: 9, maxLines: 1 },
  { key: "bebe",              x: 133.8, y: 41.5, maxWidth: 31.8, size: 11, minSize: 9, maxLines: 1 },
  { key: "ts_tc",             x: 179.7, y: 41.5, maxWidth: 35.1, size: 11, minSize: 9, maxLines: 1 },

  { key: "diabetes",          x: 32.9,  y: 47.5, maxWidth: 27.3, size: 11, minSize: 9, maxLines: 1 },
  { key: "dst_aids_sifilis",  x: 93.1,  y: 47.5, maxWidth: 25.7, size: 11, minSize: 9, maxLines: 1 },
  { key: "gastrointestinal",  x: 155.9, y: 47.5, maxWidth: 9.7,  size: 11, minSize: 9, maxLines: 1 },
  { key: "convulsivo",        x: 191.7, y: 47.5, maxWidth: 23.1, size: 11, minSize: 9, maxLines: 1 },

  { key: "cardiopatia",       x: 38.6,  y: 53.5, maxWidth: 21.6, size: 11, minSize: 9, maxLines: 1 },
  { key: "usa_drogas",        x: 88.4,  y: 53.5, maxWidth: 30.4, size: 11, minSize: 9, maxLines: 1 },
  { key: "cicatrizacao",      x: 147.5, y: 53.5, maxWidth: 18.1, size: 11, minSize: 9, maxLines: 1 },
  { key: "pressao_arterial",  x: 202.8, y: 53.5, maxWidth: 12.0, size: 11, minSize: 9, maxLines: 1 },

  // Coluna direita — MÉDICO (célula 216–259) e FONE DO MÉDICO (célula 259–293),
  // lado a lado na mesma linha (abaixo da VIGÊNCIA). Valor ao lado do rótulo MÉDICO;
  // FONE abaixo do rótulo (rótulo "FONE DO MÉDICO" é largo).
  { key: "medico",        x: 218, y: 54, maxWidth: 40, size: 8 },
  { key: "fone_medico",   x: 261, y: 54, maxWidth: 31, size: 8 },

  // Faixa medicamentos / outro problema / queixa principal (até 2 linhas)
  { key: "medicamentos",     x: 15,  y: 64, maxWidth: 73, maxLines: 2, size: 8 },
  { key: "outro_problema",   x: 92,  y: 64, maxWidth: 73, maxLines: 2, size: 8 },
  { key: "queixa_principal", x: 169, y: 64, maxWidth: 60, maxLines: 2, size: 8 },
];

// Campos multilinha grandes (planejamento / cobertura)
const IOP046_TEXTAREAS: Record<string, { x: number; y: number; maxWidth: number; maxLines: number; size: number }> = {
  planejamento_prognostico: { x: 12,  y: 80, maxWidth: 182, maxLines: 4, size: 9 },
  cobertura:                { x: 201, y: 80, maxWidth: 88,  maxLines: 4, size: 9 },
};

// Vigência DE / ATÉ — datas divididas em dia/mês/ano sobre a máscara impressa.
// Barras "/" medidas por pixel-scan: DE em ~233.2 e ~245.3; ATÉ em ~274.1 e ~284.8.
// Os X abaixo são os CENTROS de cada slot (entre as barras); render centralizado
// (align:center) garante números nítidos sem sobrescrever as barras. Fonte 10pt.
const VIGENCIA = {
  y: 40.3,
  size: 10,
  de:  { dd: 227.6, mm: 239.3, aaaa: 252.3 },
  ate: { dd: 269.5, mm: 279.5, aaaa: 290.4 },
};

// Assinatura do paciente — o texto "ATESTO…" ocupa 3 linhas (y58–67.5) e a borda
// inferior da célula fica em ~y69. Logo abaixo há faixa em branco (x234–292, y70–78;
// o rótulo COBERTURA fica à esquerda em ~x201, fora desta faixa). A assinatura vai
// aí, abaixo do atestado, centralizada e proporcional, sem fundo branco.
const IOP046_SIG_PACIENTE = { x: 236, y: 70, w: 54, h: 6 };

// Assinatura do DOUTOR na página 1 (responsável pelo planejamento).
// ⚠ COORDENADA ESTIMADA — posicionada na faixa do atestado, à esquerda da
// assinatura do paciente. Verifique/ajuste com o botão "Grid calibração" da
// tela de Prontuários (gera o PDF com grade de 10mm sobre o template).
const IOP046_SIG_DOUTOR = { x: 178, y: 70, w: 54, h: 6 };

// ─────────────────────────────────────────────────────────────────────────
//  IOP054 — Ficha de Planejamento de Prótese (somente contratos de Prótese)
// ─────────────────────────────────────────────────────────────────────────
// Mesmo cabeçalho da IOP046 (DATA / PLANEJADO POR / Nº PRONTUÁRIO / Nº CONTRATO
// na linha 1; NOME / DATA DE NASC / RG na linha 2; ENDEREÇO / TELEFONE na 3).
// Os rótulos são impressos no topo-esquerdo de cada célula; os valores vão
// ABAIXO do rótulo (Y na metade inferior da célula), mesmo padrão da IOP046.
// Reutiliza as MESMAS chaves de `p` já carregadas — nada é buscado de novo.
const IOP054_FIELDS: FieldPos[] = [
  // Linha 1 (célula y ~11–19; baseline ~16.5)
  { key: "data",            x: 54,  y: 16.5, maxWidth: 30, date: true },
  { key: "planejado_por",   x: 87,  y: 16.5, maxWidth: 38, size: 9 },
  { key: "num_prontuario",  x: 223, y: 16.5, maxWidth: 22 },
  { key: "num_contrato",    x: 248, y: 16.5, maxWidth: 44 },
  // Linha 2 (célula y ~19–27; baseline ~25)
  { key: "nome",            x: 54,  y: 25, maxWidth: 162 },
  { key: "data_nasc",       x: 223, y: 25, maxWidth: 22, date: true },
  { key: "rg",              x: 248, y: 25, maxWidth: 44 },
  // Linha 3 (célula y ~27–35; baseline ~33)
  { key: "endereco",        x: 54,  y: 33, maxWidth: 190 },
  { key: "telefone",        x: 248, y: 33, maxWidth: 44 },
];

// ─────────────────────────────────────────────────────────────────────────
//  Arcada Superior (página 1) — centros de coluna (X) e de linha (Y), mm
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

// ── Arcada Inferior (página 2) — 16 colunas ────────────────────────────────
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

// ── Odontograma (página 2) — 4 blocos de 8 dentes ──────────────────────────
const ODONTOGRAMA = {
  yStart: 131,
  rowHeight: 7.4,
  maxWidth: 56,
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
    nome:           { x: 102, y: 24, maxWidth: 110 },
    num_contrato:   { x: 215, y: 24, maxWidth: 44 },
    num_prontuario: { x: 262, y: 24, maxWidth: 30 },
  },
  startY: 38.5,       // baseline da 1ª linha de eventos
  rowTop: 32.8,       // topo da célula da 1ª linha
  rowHeight: 8.9,
  perPage: 19,
  columns: {
    data:         { x: 9,  maxWidth: 26 },
    dente:        { x: 40, maxWidth: 15 },
    procedimento: { x: 58, maxWidth: 170 },
  },
  // Assinaturas DENTRO das colunas Dentista / Paciente, por linha
  sigDentista: { x: 232, w: 28 },
  sigPaciente: { x: 262, w: 27 },
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

// fetch → dataURL, com 1 nova tentativa (evita "texto flutuante" por falha de rede)
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
    console.error(`[prontuario-pdf] falha ao carregar template: ${url}`);
    return null;
  }
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
export async function generateProntuarioPdf(
  p: any,
  eventos: any[],
  opts: { isProtese?: boolean } = {},
): Promise<any> {
  const { jsPDF } = await import("jspdf");
  // bgProtese (IOP054) só é baixado para contratos de Prótese.
  const [bg1, bgVerso, bgProtese, bg2] = await Promise.all([
    toBase64(URLS.plano),
    toBase64(URLS.verso),
    opts.isProtese ? toBase64(URLS.protese) : Promise.resolve(null),
    toBase64(URLS.eventos),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  // Azul-escuro navy forte (bold) p/ distinguir o dado preenchido do template.
  const TEXT_COLOR: [number, number, number] = [26, 58, 107];

  const setFont = (size = 10, bold = true) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...TEXT_COLOR);
  };

  // pt → mm para altura de linha
  const lineMm = (sizePt: number) => sizePt * 0.3528 * 1.15;

  /**
   * Desenha texto SEMPRE contido na célula:
   *  1. reduz a fonte de `size` até `minSize` tentando caber em `maxLines`;
   *  2. se não couber, quebra em `maxLines` linhas;
   *  3. se ainda estourar, trunca a última linha com "…".
   */
  const fitText = (
    val: string | null | undefined,
    x: number, y: number,
    maxWidth: number, maxLines = 1, baseSize = 10, minSize = 5,
  ) => {
    const v = (val ?? "").toString().trim();
    if (!v) return;

    let chosen = minSize;
    let lines: string[] = [];
    for (let s = baseSize; s >= minSize; s--) {
      doc.setFontSize(s);
      const wrapped = doc.splitTextToSize(v, maxWidth) as string[];
      if (wrapped.length <= maxLines) { chosen = s; lines = wrapped; break; }
      if (s === minSize) { chosen = s; lines = wrapped; }
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

  // ✓ verde centrado em (x,y)
  const check = (x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 120, 0);
    doc.text("✓", x, y, { align: "center", baseline: "middle" });
    setFont();
  };

  /**
   * Desenha uma assinatura (PNG dataURL) preenchendo a célula ao máximo,
   * preservando proporção, com fundo branco para contraste/visibilidade.
   */
  const drawSignature = (dataUrl: string, cellX: number, cellY: number, cellW: number, cellH: number, whiteBg = true) => {
    let imgW = 3, imgH = 1;
    try {
      const props = doc.getImageProperties(dataUrl);
      imgW = props.width; imgH = props.height;
    } catch { /* usa proporção padrão */ }
    const scale = Math.min(cellW / imgW, cellH / imgH);
    const w = imgW * scale, h = imgH * scale;
    const x = cellX + (cellW - w) / 2;
    const y = cellY + (cellH - h) / 2;
    // fundo branco para contraste — desligado quando há texto do template atrás
    if (whiteBg) {
      doc.setFillColor(255, 255, 255);
      doc.rect(cellX, cellY, cellW, cellH, "F");
    }
    try { doc.addImage(dataUrl, "PNG", x, y, w, h); } catch { /* skip */ }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — IOP046 frente  (fundo SEMPRE antes do texto)
  // ═══════════════════════════════════════════════════════════════════════
  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  for (const f of IOP046_FIELDS) {
    const raw = p[f.key];
    const val = f.date ? fmtDate(raw) : raw;
    fitText(val, f.x, f.y, f.maxWidth, f.maxLines ?? 1, f.size ?? 10, f.minSize ?? 5);
  }

  // Vigência: dia/mês/ano nos espaços entre as barras impressas (X = borda esquerda
  // de cada segmento; alinhamento à esquerda evita problemas perto da margem direita).
  const drawVigencia = (raw: string | null | undefined, pos: { dd: number; mm: number; aaaa: number }) => {
    const f = fmtDate(raw); // DD/MM/YYYY
    if (!f) return;
    const [dd, mm, aaaa] = f.split("/");
    setFont(VIGENCIA.size);
    // centralizado no slot entre as barras impressas (pos.* = centro do slot)
    if (dd) doc.text(dd, pos.dd, VIGENCIA.y, { align: "center" });
    if (mm) doc.text(mm, pos.mm, VIGENCIA.y, { align: "center" });
    if (aaaa) doc.text(aaaa, pos.aaaa, VIGENCIA.y, { align: "center" });
    setFont();
  };
  drawVigencia(p.vigencia_de, VIGENCIA.de);
  drawVigencia(p.vigencia_ate, VIGENCIA.ate);

  // Textareas (planejamento / cobertura)
  for (const [key, cfg] of Object.entries(IOP046_TEXTAREAS)) {
    fitText(p[key], cfg.x, cfg.y, cfg.maxWidth, cfg.maxLines, cfg.size, 6);
  }

  // Assinatura do paciente (ATESTO) — sem fundo branco (há texto do atestado atrás)
  if (p.assinatura_paciente_planejamento) {
    const s = IOP046_SIG_PACIENTE;
    drawSignature(p.assinatura_paciente_planejamento, s.x, s.y, s.w, s.h, false);
  }

  // Assinatura do doutor (informações iniciais) — ao lado da do paciente
  if (p.assinatura_doutor) {
    const s = IOP046_SIG_DOUTOR;
    drawSignature(p.assinatura_doutor, s.x, s.y, s.w, s.h, false);
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

  for (const block of ODONTOGRAMA.blocks) {
    block.dentes.forEach((d, i) => {
      fitText(
        p.odontograma?.[d.toString()],
        block.xTxt, ODONTOGRAMA.yStart + i * ODONTOGRAMA.rowHeight,
        ODONTOGRAMA.maxWidth, 1, 9, 5,
      );
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PÁGINA EXTRA — IOP054 Ficha de Planejamento de Prótese
  // Apenas para contratos de Prótese; entra ENTRE a arcada (verso) e os
  // Eventos (IOP043). Implante/Ortodontia não recebem esta página.
  // ═══════════════════════════════════════════════════════════════════════
  if (opts.isProtese) {
    doc.addPage();
    if (bgProtese) { try { doc.addImage(bgProtese, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    setFont();
    for (const f of IOP054_FIELDS) {
      const raw = p[f.key];
      const val = f.date ? fmtDate(raw) : raw;
      fitText(val, f.x, f.y, f.maxWidth, f.maxLines ?? 1, f.size ?? 10, f.minSize ?? 5);
    }
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

    // Header (dentro da faixa Nome/Contrato/Prontuário)
    fitText(p.nome,           C.header.nome.x,           C.header.nome.y,           C.header.nome.maxWidth, 1, 10);
    fitText(p.num_contrato,   C.header.num_contrato.x,   C.header.num_contrato.y,   C.header.num_contrato.maxWidth, 1, 10);
    fitText(p.num_prontuario, C.header.num_prontuario.x, C.header.num_prontuario.y, C.header.num_prontuario.maxWidth, 1, 10);

    // Linhas + assinaturas nas colunas Dentista / Paciente
    const batch = eventos.slice(pg * C.perPage, (pg + 1) * C.perPage);
    batch.forEach((ev: any, i: number) => {
      const y = C.startY + i * C.rowHeight;
      if (y > H - 8) return;
      fitText(fmtDate(ev.data), C.columns.data.x, y, C.columns.data.maxWidth, 1, 9);
      fitText(ev.dente,         C.columns.dente.x, y, C.columns.dente.maxWidth, 1, 9);
      fitText(ev.procedimento,  C.columns.procedimento.x, y, C.columns.procedimento.maxWidth, 1, 9);

      // célula da linha (vertical) p/ assinatura
      const cellTop = C.rowTop + i * C.rowHeight + 0.7;
      const cellH = C.rowHeight - 1.4;

      // Dentista: assinatura do doutor DO EVENTO (assinatura por procedimento);
      // na ausência, a global do prontuário; por fim, o nome digitado.
      const sigDoc = ev.assinatura_doutor || p.assinatura_doutor;
      if (sigDoc) {
        drawSignature(sigDoc, C.sigDentista.x, cellTop, C.sigDentista.w, cellH);
      } else {
        fitText(ev.dentista, C.sigDentista.x + 1, y, C.sigDentista.w - 2, 1, 9);
      }

      // Paciente: assinatura do paciente. Por evento (raro) ou a global do
      // prontuário (assinatura_paciente_planejamento), que é a cadastrada.
      const sigPac = ev.assinatura_paciente || p.assinatura_paciente_planejamento;
      if (sigPac) {
        drawSignature(sigPac, C.sigPaciente.x, cellTop, C.sigPaciente.w, cellH);
      }
    });
  }

  return doc;
}
