/**
 * prontuario-pdf.ts
 *
 * Generates A4 landscape PDF (297 × 210 mm) using the physical form images
 * as backgrounds.
 *
 * --- CALIBRATION WORKFLOW ---
 * 1. Call generateCalibrationPdf() to get a PDF with a red 10mm grid over
 *    each background image.
 * 2. Open the PDF, identify the (xMM, yMM) for every field.
 * 3. Update the CAMPOS_P1 / CAMPOS_EV / ARCADA_* constants below.
 * 4. Delete or ignore generateCalibrationPdf when done.
 */

const FICHA_PLANEJAMENTO_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg";
const FICHA_VERSO_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento-verso.jpg";
const FICHA_EVENTOS_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
  catch { return iso ?? ""; }
}

// ─────────────────────────────────────────────────────────────────────────
// CAMPOS — calibrated coordinates (mm).
// Replace ?? values after running generateCalibrationPdf().
// ─────────────────────────────────────────────────────────────────────────

// Page 1 — Ficha de Planejamento (frente)
const P1 = {
  // Cabeçalho linha 1
  data:          { x: 72,  y: 17 },
  planejadoPor:  { x: 108, y: 17 },
  numProntuario: { x: 222, y: 17 },
  numContrato:   { x: 265, y: 17 },
  // Cabeçalho linha 2
  nome:          { x: 38,  y: 25 },
  dataNasc:      { x: 222, y: 25 },
  rg:            { x: 265, y: 25 },
  // Cabeçalho linha 3
  endereco:      { x: 38,  y: 33 },
  telefone:      { x: 265, y: 33 },
  // Anamnese — col 1 (x≈38–70)
  alergico:      { x: 40,  y: 46 },
  hemorragia:    { x: 40,  y: 54 },
  diabetes:      { x: 40,  y: 62 },
  cardiopatia:   { x: 40,  y: 70 },
  // Anamnese — col 2 (x≈78–110)
  estaGravida:   { x: 80,  y: 46 },
  probResp:      { x: 80,  y: 54 },
  dstAidsSif:    { x: 80,  y: 62 },
  usaDrogas:     { x: 80,  y: 70 },
  // Anamnese — col 3 (x≈118–150)
  fuma:          { x: 120, y: 46 },
  bebe:          { x: 120, y: 54 },
  gastro:        { x: 120, y: 62 },
  cicatrizacao:  { x: 120, y: 70 },
  // Anamnese — col 4 (x≈158–190)
  hepatite:      { x: 160, y: 46 },
  tsTc:          { x: 160, y: 54 },
  convulsivo:    { x: 160, y: 62 },
  pressaoArt:    { x: 160, y: 70 },
  // Coluna direita anamnese
  vigenciaDe:    { x: 198, y: 46 },
  vigenciaAte:   { x: 238, y: 46 },
  medico:        { x: 198, y: 62 },
  foneMedico:    { x: 238, y: 62 },
  // Linha inferior da anamnese
  medicamentos:  { x: 16,  y: 79 },
  outroProblem:  { x: 108, y: 79 },
  queixaPrinc:   { x: 200, y: 79 },
  // Assinatura do paciente ("Atesto...")
  sigPacPlano:   { x: 230, y: 72, w: 50, h: 14 },
  // Planejamento / Cobertura
  plano:         { x: 16,  y: 100, maxW: 145 },
  cobertura:     { x: 170, y: 100, maxW: 80  },
};

// Events page — Ficha de Eventos (IOP043)
const EV = {
  // Header
  nomeHeader:    { x: 55,  y: 17 },
  contratoNum:   { x: 190, y: 17 },
  prontuarioNum: { x: 250, y: 17 },
  // Table — column x positions
  colData:       18,
  colDente:      42,
  colProc:       60,
  colDentista:   195,
  // Table — row positioning
  firstRowY:     30,
  rowSpacing:     7,
  // Footer signatures
  sigDoutor:     { x: 35,  y: 188, w: 70, h: 14 },
  sigPaciente:   { x: 165, y: 188, w: 70, h: 14 },
};

// ─────────────────────────────────────────────────────────────────────────
// Dental arch coordinates
// ─────────────────────────────────────────────────────────────────────────

const UPPER_TEETH = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const LOWER_TEETH = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];
const UPPER_X = [35,48,61,74,87,100,113,126,139,152,165,178,191,204,217,230];
const LOWER_X = [22,36,50,64,78,92,106,120,134,148,162,176,190,204,218,232];

const UPPER_PROCS: Array<{ key: string; y: number }> = [
  { key: "Periodontia", y: 135 }, { key: "Endodontia",  y: 143 },
  { key: "Clareamento", y: 151 }, { key: "Dentística",  y: 159 },
  { key: "Núcleo",      y: 167 }, { key: "Provisória",  y: 175 },
  { key: "Definitiva",  y: 183 },
];
const LOWER_PROCS: Array<{ key: string; y: number }> = [
  { key: "Definitiva",  y: 28 },  { key: "Provisória",  y: 36 },
  { key: "Núcleo",      y: 44 },  { key: "Dentística",  y: 52 },
  { key: "Clareamento", y: 60 },  { key: "Endodontia",  y: 68 },
  { key: "Periodontia", y: 76 },
];

const ODONTOGRAMA_COLS = [
  { dentes: [18,17,16,15,14,13,12,11], xTxt:  18, yStart: 98 },
  { dentes: [21,22,23,24,25,26,27,28], xTxt:  90, yStart: 98 },
  { dentes: [38,37,36,35,34,33,32,31], xTxt: 162, yStart: 98 },
  { dentes: [41,42,43,44,45,46,47,48], xTxt: 234, yStart: 98 },
];

// ─────────────────────────────────────────────────────────────────────────
// CALIBRATION HELPER — generates a PDF with a 10mm red grid over every
// background image so you can read off exact (x,y) for each field.
// ─────────────────────────────────────────────────────────────────────────

export async function generateCalibrationPdf(): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const W = 297, H = 210;

  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(FICHA_PLANEJAMENTO_URL),
    toBase64(FICHA_VERSO_URL),
    toBase64(FICHA_EVENTOS_URL),
  ]);

  const addGrid = (doc: any) => {
    doc.setLineWidth(0.15);
    doc.setDrawColor(255, 0, 0);
    doc.setFontSize(3.5);
    doc.setTextColor(255, 0, 0);
    // Vertical lines every 10mm
    for (let x = 0; x <= W; x += 10) {
      doc.line(x, 0, x, H);
      doc.text(String(x), x + 0.3, 3.5);
    }
    // Horizontal lines every 10mm
    for (let y = 0; y <= H; y += 10) {
      doc.line(0, y, W, y);
      doc.text(String(y), 0.5, y > 0 ? y - 0.5 : 3.5);
    }
  };

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Page 1 — Frente
  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  doc.setFontSize(6); doc.setTextColor(0, 0, 255);
  doc.text("PAGE 1 — Ficha de Planejamento (frente)", 5, 8);
  addGrid(doc);

  // Page 2 — Verso
  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  doc.setFontSize(6); doc.setTextColor(0, 0, 255);
  doc.text("PAGE 2 — Verso (Arcada Inferior + Odontograma)", 5, 8);
  addGrid(doc);

  // Page 3 — Eventos
  doc.addPage();
  if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  doc.setFontSize(6); doc.setTextColor(0, 0, 255);
  doc.text("PAGE 3 — Eventos Efetivamente Realizados", 5, 8);
  addGrid(doc);

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PDF GENERATION
// ─────────────────────────────────────────────────────────────────────────

export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;

  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(FICHA_PLANEJAMENTO_URL),
    toBase64(FICHA_VERSO_URL),
    toBase64(FICHA_EVENTOS_URL),
  ]);

  const style = (size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 80);
  };

  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x, y, opts ?? undefined);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento (frente)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  style(9);

  // Cabeçalho
  t(fmtDate(p.data),    P1.data.x,          P1.data.y);
  t(p.planejado_por,    P1.planejadoPor.x,   P1.planejadoPor.y);
  t(p.num_prontuario,   P1.numProntuario.x,  P1.numProntuario.y);
  t(p.num_contrato,     P1.numContrato.x,    P1.numContrato.y);
  t(p.nome,             P1.nome.x,           P1.nome.y);
  t(fmtDate(p.data_nasc), P1.dataNasc.x,    P1.dataNasc.y);
  t(p.rg,               P1.rg.x,            P1.rg.y);
  t(p.endereco,         P1.endereco.x,       P1.endereco.y);
  t(p.telefone,         P1.telefone.x,       P1.telefone.y);

  // Anamnese
  style(8);
  t(p.alergico,             P1.alergico.x,    P1.alergico.y);
  t(p.hemorragia,           P1.hemorragia.x,  P1.hemorragia.y);
  t(p.diabetes,             P1.diabetes.x,    P1.diabetes.y);
  t(p.cardiopatia,          P1.cardiopatia.x, P1.cardiopatia.y);
  t(p.esta_gravida,         P1.estaGravida.x, P1.estaGravida.y);
  t(p.prob_respiratorio,    P1.probResp.x,    P1.probResp.y);
  t(p.dst_aids_sifilis,     P1.dstAidsSif.x,  P1.dstAidsSif.y);
  t(p.usa_drogas,           P1.usaDrogas.x,   P1.usaDrogas.y);
  t(p.fuma,                 P1.fuma.x,        P1.fuma.y);
  t(p.bebe,                 P1.bebe.x,        P1.bebe.y);
  t(p.gastrointestinal,     P1.gastro.x,      P1.gastro.y);
  t(p.cicatrizacao,         P1.cicatrizacao.x, P1.cicatrizacao.y);
  t(p.hepatite,             P1.hepatite.x,    P1.hepatite.y);
  t(p.ts_tc,                P1.tsTc.x,        P1.tsTc.y);
  t(p.convulsivo,           P1.convulsivo.x,  P1.convulsivo.y);
  t(p.pressao_arterial,     P1.pressaoArt.x,  P1.pressaoArt.y);
  t(fmtDate(p.vigencia_de), P1.vigenciaDe.x,  P1.vigenciaDe.y);
  t(fmtDate(p.vigencia_ate), P1.vigenciaAte.x, P1.vigenciaAte.y);
  t(p.medico,               P1.medico.x,      P1.medico.y);
  t(p.fone_medico,          P1.foneMedico.x,  P1.foneMedico.y);
  t(p.medicamentos,         P1.medicamentos.x, P1.medicamentos.y);
  t(p.outro_problema,       P1.outroProblem.x, P1.outroProblem.y);
  t(p.queixa_principal,     P1.queixaPrinc.x,  P1.queixaPrinc.y);

  // Assinatura do paciente
  if (p.assinatura_paciente_planejamento) {
    try {
      doc.addImage(p.assinatura_paciente_planejamento, "PNG",
        P1.sigPacPlano.x, P1.sigPacPlano.y, P1.sigPacPlano.w, P1.sigPacPlano.h);
    } catch { /* skip */ }
  }

  // Planejamento / Cobertura
  style(8);
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), P1.plano.maxW), P1.plano.x, P1.plano.y);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), P1.cobertura.maxW), P1.cobertura.x, P1.cobertura.y);
  }

  // Arcada Superior
  style(7);
  UPPER_PROCS.forEach(({ key, y }) => {
    UPPER_TEETH.forEach((dente, di) => {
      const x = UPPER_X[di];
      if (x !== undefined)
        doc.text(p.arcada_superior?.[dente]?.[key] ? "✓" : "—", x + 3, y, { align: "center" });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Verso: Arcada Inferior + Odontograma
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  style(7);
  LOWER_PROCS.forEach(({ key, y }) => {
    LOWER_TEETH.forEach((dente, di) => {
      const x = LOWER_X[di];
      if (x !== undefined)
        doc.text(p.arcada_inferior?.[dente]?.[key] ? "✓" : "", x + 3, y, { align: "center" });
    });
  });

  style(8);
  ODONTOGRAMA_COLS.forEach(({ dentes, xTxt, yStart }) => {
    dentes.forEach((dente, i) => {
      const obs = (p.odontograma?.[dente.toString()] ?? "").trim();
      if (obs) doc.text(obs, xTxt, yStart + i * 9, { maxWidth: 60 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 3+ — Eventos Efetivamente Realizados (IOP043)
  // ═══════════════════════════════════════════════════════════════════════

  const MAX_LINES = 18;
  let remaining = [...eventos];
  let firstEvPage = true;

  do {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

    // Header — only on first events page
    if (firstEvPage) {
      style(9);
      t(p.nome,            EV.nomeHeader.x,    EV.nomeHeader.y);
      t(p.num_contrato,    EV.contratoNum.x,   EV.contratoNum.y);
      t(p.num_prontuario,  EV.prontuarioNum.x, EV.prontuarioNum.y);
      firstEvPage = false;
    }

    // Event rows
    style(8);
    const batch = remaining.splice(0, MAX_LINES);
    batch.forEach((ev: any, i: number) => {
      const y = EV.firstRowY + i * EV.rowSpacing;
      if (y > H - 25) return;

      t(fmtDate(ev.data),   EV.colData,     y);
      t(ev.dente,           EV.colDente,    y);
      if (ev.procedimento) {
        const lines = doc.splitTextToSize((ev.procedimento ?? "").trim(), 128);
        doc.text(lines[0] ?? "", EV.colProc, y);
      }
      t(ev.dentista,        EV.colDentista, y);
      // Coluna "Paciente" — vazia (assinatura à mão no papel)
    });
  } while (remaining.length > 0);

  // Footer signatures
  style(7);
  if (p.assinatura_doutor) {
    try {
      doc.addImage(p.assinatura_doutor, "PNG",
        EV.sigDoutor.x, EV.sigDoutor.y, EV.sigDoutor.w, EV.sigDoutor.h);
    } catch { /* skip */ }
  }
  if (p.assinatura_paciente_planejamento) {
    try {
      doc.addImage(p.assinatura_paciente_planejamento, "PNG",
        EV.sigPaciente.x, EV.sigPaciente.y, EV.sigPaciente.w, EV.sigPaciente.h);
    } catch { /* skip */ }
  }

  return doc;
}
