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

  const style = (bold = false, size = 10) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(10, 35, 100);
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
  t(fmtDate(p.data),       73,  11);
  t(p.planejado_por,      138,  11);
  t(p.num_prontuario,     240,  11);
  t(p.num_contrato,       270,  11);

  // Cabeçalho linha 2
  t(p.nome,                70,  19);
  t(fmtDate(p.data_nasc), 233,  19);
  t(p.rg,                 268,  19);

  // Cabeçalho linha 3
  t(p.endereco,            70,  27);
  t(p.telefone,           268,  27);

  // Anamnese — linha y=37
  t(p.alergico,            98,  37); t(p.esta_gravida,      160,  37);
  t(p.fuma,               215,  37); t(p.hepatite,          260,  37);
  // y=44
  t(p.hemorragia,          98,  44); t(p.prob_respiratorio, 160,  44);
  t(p.bebe,               215,  44); t(p.ts_tc,             260,  44);
  // y=51
  t(p.diabetes,            98,  51); t(p.dst_aids_sifilis,  160,  51);
  t(p.gastrointestinal,   215,  51); t(p.convulsivo,        260,  51);
  // y=58
  t(p.cardiopatia,         98,  58); t(p.usa_drogas,        160,  58);
  t(p.cicatrizacao,       215,  58); t(p.pressao_arterial,  260,  58);

  // Vigência / Médico / Fone — coluna separada direita
  t(fmtDate(p.vigencia_de), 230, 38); t(fmtDate(p.vigencia_ate), 262, 38);
  t(p.medico,               230, 51); t(p.fone_medico,           267, 58);

  // Linha inferior da anamnese
  t(p.medicamentos,         50,  65);
  t(p.outro_problema,      165,  65);
  t(p.queixa_principal,    255,  65);
  // Segunda linha se medicamentos for longo
  if (p.medicamentos) {
    const medLines = doc.splitTextToSize(p.medicamentos.trim(), 110);
    if (medLines.length > 1) doc.text(medLines.slice(1), 50, 71);
  }

  // Assinatura do paciente — campo "Atesto..."
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 228, 65, 60, 10); } catch { /* skip */ }
  }

  // Planejamento e Prognóstico / Cobertura
  style(true);
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), 155), 12, 80);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), 105), 180, 80);
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
    colData: 8, colDente: 55, colProc: 73, largProc: 118,
    colDentista: 198, yPrimeira: 33, espacamento: 8.0,
  };
  const POR_PAG = 18;
  const totalPags = Math.max(1, Math.ceil(eventos.length / POR_PAG));

  for (let pg = 0; pg < totalPags; pg++) {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    style(true);

    // Header
    t(p.nome,            82, 22);
    t(p.num_contrato,   218, 22);
    t(p.num_prontuario, 262, 22);

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

  // Footer signatures — last events page (descer 5mm vs versão anterior)
  if (p.assinatura_doutor) {
    try { doc.addImage(p.assinatura_doutor, "PNG", 52, 193, 68, 10); } catch { /* skip */ }
  }
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 188, 193, 68, 10); } catch { /* skip */ }
  }

  return doc;
}
