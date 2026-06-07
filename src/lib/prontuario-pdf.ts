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

  const style = (bold = false, size = 7) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(10, 35, 100);
  };

  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x, y, opts ?? undefined);
  };

  // Draws a checkmark centred on (x, yCenter) — yCenter is the row centre in mm.
  const check = (x: number, yCenter: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 120, 0);
    doc.text("✓", x, yCenter, { align: "center", baseline: "middle" });
    style(true);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento (frente)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  // ── Cabeçalho ───────────────────────────────────────────────────────────
  // Linha 1: DATA | PLANEJADO POR (esq.)  ·  Nº PRONTUÁRIO | Nº CONTRATO (dir.)
  style(true, 7);
  t(fmtDate(p.data),       74,  11);
  t(p.planejado_por,      112,  11);
  t(p.num_prontuario,     236,  14);
  t(p.num_contrato,       266,  14);

  // Linha 2: NOME (esq.)  ·  DATA DE NASC. | RG (dir.)
  style(true, 8);
  t(p.nome,                90,  19);
  style(true, 7);
  t(fmtDate(p.data_nasc), 234,  24);
  t(p.rg,                 274,  24);

  // Linha 3: ENDEREÇO (esq.)  ·  TELEFONE (dir.)
  t(p.endereco,            97,  28);
  t(p.telefone,           274,  31);

  // ── Anamnese ────────────────────────────────────────────────────────────
  // 4 colunas de respostas, alinhadas à direita do limite de cada coluna para
  // não invadir o rótulo impresso. 4 linhas (y = 38 / 45 / 52 / 59).
  const R = { align: "right" } as const;
  const COL = { c1: 90, c2: 160, c3: 208, c4: 256 };
  t(p.alergico,    COL.c1, 38, R); t(p.esta_gravida,      COL.c2, 38, R); t(p.fuma,             COL.c3, 38, R); t(p.hepatite,         COL.c4, 38, R);
  t(p.hemorragia,  COL.c1, 45, R); t(p.prob_respiratorio, COL.c2, 45, R); t(p.bebe,             COL.c3, 45, R); t(p.ts_tc,            COL.c4, 45, R);
  t(p.diabetes,    COL.c1, 52, R); t(p.dst_aids_sifilis,  COL.c2, 52, R); t(p.gastrointestinal, COL.c3, 52, R); t(p.convulsivo,       COL.c4, 52, R);
  t(p.cardiopatia, COL.c1, 59, R); t(p.usa_drogas,        COL.c2, 59, R); t(p.cicatrizacao,     COL.c3, 59, R); t(p.pressao_arterial, COL.c4, 59, R);

  // Vigência / Médico / Fone — coluna direita
  t(fmtDate(p.vigencia_de), 266, 38); t(fmtDate(p.vigencia_ate), 287, 38);
  t(p.medico,               263, 53); t(p.fone_medico,           283, 53);

  // Linha inferior da anamnese (texto livre) — fonte menor, com quebra
  if (p.medicamentos)     doc.text(doc.splitTextToSize(p.medicamentos.trim(), 65),     93, 64);
  if (p.outro_problema)   doc.text(doc.splitTextToSize(p.outro_problema.trim(), 42),  163, 64);
  if (p.queixa_principal) doc.text(doc.splitTextToSize(p.queixa_principal.trim(), 42), 210, 64);

  // Assinatura do paciente — campo "Atesto..."
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 260, 60, 34, 9); } catch { /* skip */ }
  }

  // ── Planejamento e Prognóstico / Cobertura ──────────────────────────────
  style(true, 8);
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), 160), 13, 78);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), 110), 182, 78);
  }

  // ── Arcada Superior ─────────────────────────────────────────────────────
  // Os dentes ocupam toda a largura útil (x ≈ 56 → 296), 16 colunas.
  // Ordem: 18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
  const dentesSupX: Record<string, number> = {
    "18":56, "17":73, "16":89, "15":105, "14":122, "13":139, "12":156, "11":172,
    "21":189, "22":206, "23":223, "24":239, "25":256, "26":272, "27":285, "28":296,
  };
  // Linhas de procedimento (centro vertical de cada faixa, mm)
  const procSupY: Record<string, number> = {
    periodontia:116, endodontia:127, clareamento:139,
    dentistica:151,  nucleo:164,     provisoria:177, definitiva:189,
  };
  Object.entries(procSupY).forEach(([proc, yRow]) => {
    Object.keys(dentesSupX).forEach((dente) => {
      if (p.arcada_superior?.[dente]?.[PROC_KEY[proc]]) check(dentesSupX[dente], yRow);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Verso: Arcada Inferior + Odontograma
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  style(true);

  // ── Arcada Inferior ─────────────────────────────────────────────────────
  // Mesma grade de colunas da arcada superior (x ≈ 56 → 296).
  // Ordem: 48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
  const dentesInfX: Record<string, number> = {
    "48":56, "47":73, "46":89, "45":105, "44":122, "43":139, "42":156, "41":172,
    "31":189, "32":206, "33":223, "34":239, "35":256, "36":272, "37":285, "38":296,
  };
  // Linhas de procedimento (centro vertical de cada faixa, mm)
  const procInfY: Record<string, number> = {
    definitiva:33,  provisoria:49,  nucleo:64,
    dentistica:80,  clareamento:96, endodontia:112, periodontia:127,
  };
  Object.entries(procInfY).forEach(([proc, yRow]) => {
    Object.keys(dentesInfX).forEach((dente) => {
      if (p.arcada_inferior?.[dente]?.[PROC_KEY[proc]]) check(dentesInfX[dente], yRow);
    });
  });

  // ── Odontograma ─────────────────────────────────────────────────────────
  // 4 colunas; o nº do dente é impresso à esquerda, a observação vai ao lado.
  style(true, 7);
  [
    { dentes:[18,17,16,15,14,13,12,11], xTxt: 22, yStart:131 },
    { dentes:[21,22,23,24,25,26,27,28], xTxt: 94, yStart:131 },
    { dentes:[38,37,36,35,34,33,32,31], xTxt:164, yStart:131 },
    { dentes:[41,42,43,44,45,46,47,48], xTxt:236, yStart:131 },
  ].forEach(({ dentes, xTxt, yStart }) => {
    dentes.forEach((d, i) => {
      const obs = (p.odontograma?.[d.toString()] ?? "").trim();
      if (obs) doc.text(doc.splitTextToSize(obs, 55)[0], xTxt, yStart + i * 7.4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 3+ — Eventos Efetivamente Realizados
  // ═══════════════════════════════════════════════════════════════════════

  const EV = {
    colData: 6, colDente: 84, colProc: 113, largProc: 118,
    colDentista: 240, yPrimeira: 36, espacamento: 8.5,
  };
  const POR_PAG = 18;
  const totalPags = Math.max(1, Math.ceil(eventos.length / POR_PAG));

  for (let pg = 0; pg < totalPags; pg++) {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    style(true, 7);

    // Header — Nome do paciente · Contrato Nº · Prontuário Nº
    t(p.nome,            152, 22);
    t(p.num_contrato,    220, 22);
    t(p.num_prontuario,  268, 22);

    // Event rows
    const batch = eventos.slice(pg * POR_PAG, (pg + 1) * POR_PAG);
    batch.forEach((ev: any, i: number) => {
      const y = EV.yPrimeira + i * EV.espacamento;
      if (y > H - 20) return;
      t(fmtDate(ev.data),  EV.colData,    y);
      t(ev.dente,          EV.colDente,   y, { align: "center" });
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
