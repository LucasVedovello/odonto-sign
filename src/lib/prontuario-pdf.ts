/**
 * prontuario-pdf.ts
 * A4 landscape (297 × 210 mm), jsPDF unit: 'mm'
 *
 * Pages:
 *   1 — Ficha de Planejamento (frente)
 *   2 — Verso: Arcada Inferior + Odontograma
 *   3+ — Eventos Efetivamente Realizados
 */

const URLS = {
  plano:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg",
  verso:   "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento-verso.jpg",
  eventos: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg",
};

// ── Date helper ───────────────────────────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
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

// ─────────────────────────────────────────────────────────────────────────
//  Arch procedure key mapping  (DB stores capitalized; spec uses lowercase)
// ─────────────────────────────────────────────────────────────────────────
const PROC_KEY: Record<string, string> = {
  periodontia: "Periodontia", endodontia: "Endodontia",
  clareamento: "Clareamento", dentistica: "Dentística",
  nucleo: "Núcleo",           provisoria: "Provisória",
  definitiva: "Definitiva",
};

// ─────────────────────────────────────────────────────────────────────────
//  CALIBRATION — red 10 mm grid over every background image
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
    { bg: bg1,     label: "PAGE 1 — Ficha de Planejamento (frente)" },
    { bg: bgVerso, label: "PAGE 2 — Verso (Arcada Inferior + Odontograma)" },
    { bg: bg2,     label: "PAGE 3 — Eventos Efetivamente Realizados" },
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
//  MAIN PDF GENERATION
// ─────────────────────────────────────────────────────────────────────────
export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const W = 297, H = 210;

  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(URLS.plano), toBase64(URLS.verso), toBase64(URLS.eventos),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const style = (bold = false, size = 9) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(15, 40, 100);
  };

  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x, y, opts ?? undefined);
  };

  const check = (x: number, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 120, 0);
    doc.text("✓", x - 1, y + 2);
    style(true);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento (frente)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  style(true);

  // Cabeçalho linha 1
  t(fmtDate(p.data),       73,  13);
  t(p.planejado_por,      138,  13);
  t(p.num_prontuario,     240,  13);
  t(p.num_contrato,       275,  13);

  // Cabeçalho linha 2
  t(p.nome,                73,  20);
  t(fmtDate(p.data_nasc), 245,  20);
  t(p.rg,                 268,  20);

  // Cabeçalho linha 3
  t(p.endereco,            80,  27);
  t(p.telefone,           268,  27);

  // Anamnese — linha y=37
  t(p.alergico,            92,  37); t(p.esta_gravida,      140,  37);
  t(p.fuma,               195,  37); t(p.hepatite,          247,  37);
  // y=45
  t(p.hemorragia,          92,  45); t(p.prob_respiratorio, 140,  45);
  t(p.bebe,               195,  45); t(p.ts_tc,             247,  45);
  // y=53
  t(p.diabetes,            92,  53); t(p.dst_aids_sifilis,  140,  53);
  t(p.gastrointestinal,   195,  53); t(p.convulsivo,        247,  53);
  // y=61
  t(p.cardiopatia,         92,  61); t(p.usa_drogas,        140,  61);
  t(p.cicatrizacao,       195,  61); t(p.pressao_arterial,  247,  61);

  // Vigência / Médico / Fone — coluna direita
  t(fmtDate(p.vigencia_de), 228, 37); t(fmtDate(p.vigencia_ate), 255, 37);
  t(p.medico,               228, 53); t(p.fone_medico,           260, 53);

  // Linha inferior da anamnese
  t(p.medicamentos,         92,  69);
  t(p.outro_problema,      165,  69);
  t(p.queixa_principal,    245,  69);

  // Assinatura do paciente — campo "Atesto..."
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 230, 67, 58, 10); } catch { /* skip */ }
  }

  // Planejamento e Prognóstico / Cobertura
  style(true);
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), 160), 12, 82);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), 110), 180, 82);
  }

  // Arcada Superior — X positions in mm (already calibrated)
  const dentesSupX: Record<string, number> = {
    "18":159, "17":169, "16":179, "15":189, "14":199,
    "13":209, "12":219, "11":229, "21":239, "22":249,
    "24":259, "24b":269, "26":279, "27":289, "28":295,
  };
  const procSupY: Record<string, number> = {
    periodontia:118, endodontia:128, clareamento:138,
    dentistica:148,  nucleo:158,     provisoria:168, definitiva:178,
  };
  style(true);
  Object.entries(procSupY).forEach(([proc, yRow]) => {
    ["18","17","16","15","14","13","12","11","21","22","24","24b","26","27","28"].forEach((dente) => {
      const x = dentesSupX[dente];
      if (x === undefined) return;
      const dataKey = dente === "24b" ? "24" : dente;
      if (p.arcada_superior?.[dataKey]?.[PROC_KEY[proc]]) check(x, yRow);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Verso: Arcada Inferior + Odontograma
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  style(true);

  const dentesInfX: Record<string, number> = {
    "48":159, "47":169, "46":179, "45":189, "44":199,
    "43":209, "42":219, "41":229, "31":239, "32":249,
    "33":259, "34":269, "35":279, "36":289, "37":295, "38":300,
  };
  const procInfY: Record<string, number> = {
    definitiva:22,  provisoria:32, nucleo:47,
    dentistica:62,  clareamento:77, endodontia:92, periodontia:107,
  };
  Object.entries(procInfY).forEach(([proc, yRow]) => {
    ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"].forEach((dente) => {
      const x = dentesInfX[dente];
      if (x === undefined) return;
      if (p.arcada_inferior?.[dente]?.[PROC_KEY[proc]]) check(x, yRow);
    });
  });

  // Odontograma
  style(true);
  [
    { dentes:[18,17,16,15,14,13,12,11], xTxt: 20, yStart:132 },
    { dentes:[21,22,23,24,25,26,27,28], xTxt: 95, yStart:132 },
    { dentes:[38,37,36,35,34,33,32,31], xTxt:170, yStart:132 },
    { dentes:[41,42,43,44,45,46,47,48], xTxt:245, yStart:132 },
  ].forEach(({ dentes, xTxt, yStart }) => {
    dentes.forEach((d, i) => {
      const obs = (p.odontograma?.[d.toString()] ?? "").trim();
      if (obs) doc.text(obs, xTxt, yStart + i * 8, { maxWidth: 60 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 3+ — Eventos Efetivamente Realizados
  // ═══════════════════════════════════════════════════════════════════════

  const EV = {
    colData: 8, colDente: 58, colProc: 80, largProc: 120,
    colDentista: 205, yPrimeira: 35, espacamento: 8.2,
  };
  const POR_PAG = 18;
  const totalPags = Math.max(1, Math.ceil(eventos.length / POR_PAG));

  for (let pg = 0; pg < totalPags; pg++) {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    style(true);

    // Header
    t(p.nome,           100, 22);
    t(p.num_contrato,   215, 22);
    t(p.num_prontuario, 268, 22);

    // Event rows
    const batch = eventos.slice(pg * POR_PAG, (pg + 1) * POR_PAG);
    batch.forEach((ev: any, i: number) => {
      const y = EV.yPrimeira + i * EV.espacamento;
      if (y > H - 20) return;
      t(fmtDate(ev.data),  EV.colData,    y);
      t(ev.dente,          EV.colDente,   y);
      if (ev.procedimento) {
        const lines = doc.splitTextToSize((ev.procedimento ?? "").trim(), EV.largProc);
        doc.text(lines[0] ?? "", EV.colProc, y);
      }
      t(ev.dentista,       EV.colDentista, y);
      // Coluna Paciente — VAZIA (assinatura à mão)
    });
  }

  // Footer signatures — last events page
  if (p.assinatura_doutor) {
    try { doc.addImage(p.assinatura_doutor, "PNG", 52, 188, 70, 12); } catch { /* skip */ }
  }
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 188, 188, 70, 12); } catch { /* skip */ }
  }

  return doc;
}
