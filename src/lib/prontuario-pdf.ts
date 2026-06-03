/**
 * prontuario-pdf.ts
 * A4 landscape (297 × 210 mm), jsPDF unit: 'mm'
 *
 * Pages:
 *   1 — Ficha de Planejamento (frente)
 *   2 — Verso: Arcada Inferior + Odontograma
 *   3+ — Eventos Efetivamente Realizados
 *
 * Dental-arch cell X values below are in the ORIGINAL IMAGE pixels.
 * They are converted to mm at runtime using the image's naturalWidth.
 */

const URLS = {
  plano:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg",
  verso:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento-verso.jpg",
  eventos: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg",
};

// ── Date helper ───────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return "";
  try {
    const dt = new Date(d + "T12:00:00"); // noon avoids timezone-shift on date-only strings
    return dt.toLocaleDateString("pt-BR");
  } catch { return d; }
}

// ── Image utilities ───────────────────────────────────────────────────────
async function toBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** Returns the natural pixel width of a base64 image (browser only). */
function getNaturalWidth(b64: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload  = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(0);
    img.src = b64;
  });
}

// ─────────────────────────────────────────────────────────────────────────
//  CALIBRATION — generates a PDF with a red 10 mm grid over every background
// ─────────────────────────────────────────────────────────────────────────

export async function generateCalibrationPdf(): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const W = 297, H = 210;
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
    { bg: bg1,    label: "PAGE 1 — Ficha de Planejamento (frente)" },
    { bg: bgVerso, label: "PAGE 2 — Verso (Arcada Inferior + Odontograma)" },
    { bg: bg2,    label: "PAGE 3 — Eventos Efetivamente Realizados" },
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
//  DENTAL ARCH pixel-x tables (will be multiplied by scaleX at runtime)
// ─────────────────────────────────────────────────────────────────────────

// Upper arch (18-28) — pixel x of each tooth column
const UPPER_X_PX: Record<string, number> = {
  "18": 183, "17": 200, "16": 217, "15": 234, "14": 251,
  "13": 268, "12": 285, "11": 302, "21": 319, "22": 336,
  "24": 353, "24b": 370, "26": 387, "27": 404, "28": 421,
};
const UPPER_TEETH_ORDER = ["18","17","16","15","14","13","12","11","21","22","24","24b","26","27","28"];

// Lower arch (48-38) — pixel x of each tooth column
const LOWER_X_PX: Record<string, number> = {
  "48": 183, "47": 200, "46": 217, "45": 234, "44": 251,
  "43": 268, "42": 285, "41": 302, "31": 319, "32": 336,
  "33": 353, "34": 370, "35": 387, "36": 404, "37": 421, "38": 438,
};
const LOWER_TEETH_ORDER = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];

// Upper arch: procedure → y (mm, already calibrated)
const UPPER_PROC_Y: Record<string, number> = {
  Periodontia: 118, Endodontia: 128, Clareamento: 138,
  "Dentística": 148, "Núcleo": 158, "Provisória": 168, Definitiva: 178,
};

// Lower arch (verso): procedure → y (mm, already calibrated)
const LOWER_PROC_Y: Record<string, number> = {
  Definitiva: 28, "Provisória": 38, "Núcleo": 48,
  "Dentística": 68, Clareamento: 83, Endodontia: 98, Periodontia: 112,
};

// Odontograma columns
const ODONTO_COLS = [
  { dentes: [18,17,16,15,14,13,12,11], xTxt:  20, yStart: 132 },
  { dentes: [21,22,23,24,25,26,27,28], xTxt:  95, yStart: 132 },
  { dentes: [38,37,36,35,34,33,32,31], xTxt: 170, yStart: 132 },
  { dentes: [41,42,43,44,45,46,47,48], xTxt: 245, yStart: 132 },
];

// Events table layout
const EVT = {
  colData:      8,
  colDente:    58,
  colProc:     93,
  largProc:   105,
  colDentista: 203,
  firstRowY:   35,
  rowSpacing:   8,
  maxLinhas:   18,
};

// ─────────────────────────────────────────────────────────────────────────
//  MAIN PDF GENERATION
// ─────────────────────────────────────────────────────────────────────────

export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const W = 297, H = 210;

  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(URLS.plano), toBase64(URLS.verso), toBase64(URLS.eventos),
  ]);

  // Compute pixel→mm scale from actual image width
  let scaleX = 1;
  if (bg1) {
    const natW = await getNaturalWidth(bg1);
    if (natW > 0) scaleX = W / natW;
  }
  const px = (xPx: number) => xPx * scaleX;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const style9 = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(26, 58, 107);
  };
  const style8 = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(26, 58, 107);
  };
  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x, y, opts ?? undefined);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento (frente)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  style9();

  // ── Cabeçalho ─────────────────────────────────────────────────────────
  t(fmtDate(p.data),       60,  14);
  t(p.planejado_por,      110,  14);
  t(p.num_prontuario,     230,  14);
  t(p.num_contrato,       270,  14);

  t(p.nome,                60,  22);
  t(fmtDate(p.data_nasc), 230,  22);
  t(p.rg,                 265,  22);

  t(p.endereco,            60,  30);
  t(p.telefone,           265,  30);

  // ── Anamnese ──────────────────────────────────────────────────────────
  style8();
  t(p.alergico,            50,  38); t(p.esta_gravida,       135,  38);
  t(p.fuma,               195,  38); t(p.hepatite,           255,  38);
  t(p.hemorragia,          50,  44); t(p.prob_respiratorio,  135,  44);
  t(p.bebe,               195,  44); t(p.ts_tc,              255,  44);
  t(p.diabetes,            50,  50); t(p.dst_aids_sifilis,   135,  50);
  t(p.gastrointestinal,   195,  50); t(p.convulsivo,         255,  50);
  t(p.cardiopatia,         50,  56); t(p.usa_drogas,         135,  56);
  t(p.cicatrizacao,       195,  56); t(p.pressao_arterial,   255,  56);

  // Coluna direita — vigência / médico
  t(fmtDate(p.vigencia_de),  233, 38); t(fmtDate(p.vigencia_ate), 260, 38);
  t(p.medico,               233, 50); t(p.fone_medico,           270, 50);

  // Linha inferior
  t(p.medicamentos,        50,  62);
  t(p.outro_problema,     160,  62);
  t(p.queixa_principal,   255,  62);

  // ── Assinatura paciente — campo "Atesto..." ────────────────────────────
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 228, 64, 55, 10); } catch { /* skip */ }
  }

  // ── Planejamento e Prognóstico / Cobertura ─────────────────────────────
  style9();
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), 155), 12, 76);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), 110), 178, 76);
  }

  // ── Arcada Superior ────────────────────────────────────────────────────
  Object.entries(UPPER_PROC_Y).forEach(([proc, yRow]) => {
    UPPER_TEETH_ORDER.forEach((dente) => {
      const xPx = UPPER_X_PX[dente];
      if (xPx === undefined) return;
      // Map "24b" → "24" for data lookup (second occurrence of tooth 24)
      const dataKey = dente === "24b" ? "24" : dente;
      if (p.arcada_superior?.[dataKey]?.[proc]) {
        doc.setFontSize(12);
        doc.setTextColor(0, 100, 0);
        doc.text("✓", px(xPx) - 1, yRow + 2);
        style9();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Verso: Arcada Inferior + Odontograma
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  Object.entries(LOWER_PROC_Y).forEach(([proc, yRow]) => {
    LOWER_TEETH_ORDER.forEach((dente) => {
      const xPx = LOWER_X_PX[dente];
      if (xPx === undefined) return;
      if (p.arcada_inferior?.[dente]?.[proc]) {
        doc.setFontSize(12);
        doc.setTextColor(0, 100, 0);
        doc.text("✓", px(xPx) - 1, yRow + 2);
        style9();
      }
    });
  });

  style8();
  ODONTO_COLS.forEach(({ dentes, xTxt, yStart }) => {
    dentes.forEach((d, i) => {
      const obs = (p.odontograma?.[d.toString()] ?? "").trim();
      if (obs) doc.text(obs, xTxt, yStart + i * 8.5, { maxWidth: 60 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 3+ — Eventos Efetivamente Realizados
  // ═══════════════════════════════════════════════════════════════════════

  const evRows = [...eventos];
  let firstEvPage = true;

  const addEvPage = (batch: any[]) => {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

    style9();
    if (firstEvPage) {
      t(p.nome,           90,  22);
      t(p.num_contrato,  210,  22);
      t(p.num_prontuario, 262, 22);
      firstEvPage = false;
    }

    style8();
    batch.forEach((ev: any, i: number) => {
      const y = EVT.firstRowY + i * EVT.rowSpacing;
      if (y > H - 20) return;
      t(fmtDate(ev.data),  EVT.colData,    y);
      t(ev.dente,          EVT.colDente,   y);
      if (ev.procedimento) {
        const lines = doc.splitTextToSize((ev.procedimento ?? "").trim(), EVT.largProc);
        doc.text(lines[0] ?? "", EVT.colProc, y);
      }
      t(ev.dentista,       EVT.colDentista, y);
      // Coluna Paciente — VAZIA (assinatura à mão no papel impresso)
    });
  };

  // Split events into pages of maxLinhas each
  for (let i = 0; i < Math.max(1, Math.ceil(evRows.length / EVT.maxLinhas)); i++) {
    addEvPage(evRows.slice(i * EVT.maxLinhas, (i + 1) * EVT.maxLinhas));
  }

  // ── Footer signatures (last events page) ──────────────────────────────
  style8();
  if (p.assinatura_doutor) {
    try { doc.addImage(p.assinatura_doutor, "PNG", 50, 190, 75, 12); } catch { /* skip */ }
  }
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 185, 190, 75, 12); } catch { /* skip */ }
  }

  return doc;
}
