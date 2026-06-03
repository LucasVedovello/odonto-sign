/**
 * prontuario-pdf.ts
 *
 * Generates a three-page A4 landscape PDF using the physical form images
 * as backgrounds, with filled data overlaid at calibrated coordinates.
 *
 * Page 1 — Ficha de Planejamento frente (IOP046)
 * Page 2 — Verso: Arcada Inferior + Odontograma Atual
 * Page 3+ — Eventos Efetivamente Realizados (IOP043)
 *
 * All x/y values are in millimetres. Calibrate after generating a test PDF.
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

// ── Dental arch constants ─────────────────────────────────────────────────

const UPPER_TEETH = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const LOWER_TEETH = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];

// X positions per tooth column (mm) — adjust for calibration
const UPPER_X = [35,48,61,74,87,100,113,126,139,152,165,178,191,204,217,230];
const LOWER_X = [22,36,50,64,78,92,106,120,134,148,162,176,190,204,218,232];

// Procedures — upper arch (top-to-bottom order on form)
const UPPER_PROCS: Array<{ key: string; y: number }> = [
  { key: "Periodontia", y: 135 },
  { key: "Endodontia",  y: 143 },
  { key: "Clareamento", y: 151 },
  { key: "Dentística",  y: 159 },
  { key: "Núcleo",      y: 167 },
  { key: "Provisória",  y: 175 },
  { key: "Definitiva",  y: 183 },
];

// Procedures — lower arch on the VERSO page (order is reversed: Definitiva at top)
const LOWER_PROCS: Array<{ key: string; y: number }> = [
  { key: "Definitiva",  y: 28 },
  { key: "Provisória",  y: 36 },
  { key: "Núcleo",      y: 44 },
  { key: "Dentística",  y: 52 },
  { key: "Clareamento", y: 60 },
  { key: "Endodontia",  y: 68 },
  { key: "Periodontia", y: 76 },
];

// Odontograma layout — 4 columns of 8 teeth each
const ODONTOGRAMA_COLS = [
  { dentes: [18,17,16,15,14,13,12,11], xNum:  8, xTxt:  18, yStart: 98 },
  { dentes: [21,22,23,24,25,26,27,28], xNum: 80, xTxt:  90, yStart: 98 },
  { dentes: [38,37,36,35,34,33,32,31], xNum:152, xTxt: 162, yStart: 98 },
  { dentes: [41,42,43,44,45,46,47,48], xNum:224, xTxt: 234, yStart: 98 },
];

// ── Main export ───────────────────────────────────────────────────────────

export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  // Load all backgrounds in parallel
  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(FICHA_PLANEJAMENTO_URL),
    toBase64(FICHA_VERSO_URL),
    toBase64(FICHA_EVENTOS_URL),
  ]);

  const setStyle = (size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(26, 58, 107);
  };

  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x, y, opts ?? undefined);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento — frente (IOP046)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  setStyle(9);

  // Cabeçalho
  t(fmtDate(p.data),       60,  18);
  t(p.planejado_por,      105,  18);
  t(p.num_prontuario,     238,  18);
  t(p.num_contrato,       272,  18);
  t(p.nome,                60,  26);
  t(fmtDate(p.data_nasc), 238,  26);
  t(p.rg,                 272,  26);
  t(p.endereco,            60,  34);
  t(p.telefone,           272,  34);

  // Anamnese
  setStyle(8);
  t(p.alergico,            22,  47); t(p.hemorragia,       22,  54);
  t(p.diabetes,            22,  61); t(p.cardiopatia,      22,  68);
  t(p.esta_gravida,        75,  47); t(p.prob_respiratorio, 75,  54);
  t(p.dst_aids_sifilis,    75,  61); t(p.usa_drogas,        75,  68);
  t(p.fuma,               128,  47); t(p.bebe,             128,  54);
  t(p.gastrointestinal,   128,  61); t(p.cicatrizacao,     128,  68);
  t(p.hepatite,           181,  47); t(p.ts_tc,            181,  54);
  t(p.convulsivo,         181,  61); t(p.pressao_arterial,  181,  68);
  t(fmtDate(p.vigencia_de),  228, 47); t(fmtDate(p.vigencia_ate), 258, 47);
  t(p.medico,             228,  61); t(p.fone_medico,      258,  61);
  t(p.medicamentos,        22,  76); t(p.outro_problema,   110,  76);
  t(p.queixa_principal,   185,  76);

  // Assinatura do paciente — campo "Atesto..."
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 228, 72, 60, 18); } catch { /* skip */ }
  }

  // Planejamento e Prognóstico / Cobertura
  setStyle(8);
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), 130), 22, 92);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), 100), 185, 92);
  }

  // Arcada Superior
  setStyle(7);
  UPPER_PROCS.forEach(({ key, y }) => {
    UPPER_TEETH.forEach((dente, di) => {
      const x = UPPER_X[di];
      if (x === undefined) return;
      doc.text(p.arcada_superior?.[dente]?.[key] ? "✓" : "—", x + 3, y, { align: "center" });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Verso: Arcada Inferior + Odontograma Atual
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
  setStyle(7);

  // Arcada Inferior (reversed procedure order on verso)
  LOWER_PROCS.forEach(({ key, y }) => {
    LOWER_TEETH.forEach((dente, di) => {
      const x = LOWER_X[di];
      if (x === undefined) return;
      doc.text(p.arcada_inferior?.[dente]?.[key] ? "✓" : "", x + 3, y, { align: "center" });
    });
  });

  // Odontograma Atual — Odontologia Legal
  setStyle(8);
  ODONTOGRAMA_COLS.forEach(({ dentes, xTxt, yStart }) => {
    dentes.forEach((dente, i) => {
      const obs = (p.odontograma?.[dente.toString()] ?? "").trim();
      if (obs) doc.text(obs, xTxt, yStart + i * 9, { maxWidth: 60 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 3+ — Eventos Efetivamente Realizados (IOP043)
  // ═══════════════════════════════════════════════════════════════════════

  const LINE_Y_START = 38;
  const LINE_SPACING = 8;
  const MAX_LINES = 18;

  let remaining = [...eventos];
  let firstEvPage = true;

  do {
    doc.addPage();
    if (bg2) { try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ } }
    setStyle(9);
    if (firstEvPage) {
      t(p.nome,          60,  22);
      t(p.num_contrato,  185, 22);
      t(p.num_prontuario, 245, 22);
      firstEvPage = false;
    }
    setStyle(8);
    const batch = remaining.splice(0, MAX_LINES);
    batch.forEach((ev: any, i: number) => {
      const y = LINE_Y_START + i * LINE_SPACING;
      if (y > H - 15) return;
      t(fmtDate(ev.data),        18, y);
      t(ev.dente,                42, y);
      if (ev.procedimento) {
        const lines = doc.splitTextToSize((ev.procedimento ?? "").trim(), 148);
        doc.text(lines[0] ?? "", 55, y);
      }
      t(ev.dentista,            210, y);
      if (ev.assinatura_paciente) {
        try { doc.addImage(ev.assinatura_paciente, "PNG", 248, y - 6, 40, 8); } catch { /* skip */ }
      }
    });
  } while (remaining.length > 0);

  // Rodapé — assinaturas
  setStyle(7);
  if (p.assinatura_doutor) {
    try { doc.addImage(p.assinatura_doutor, "PNG", 40, 192, 80, 14); } catch { /* skip */ }
  }
  doc.text("Assinatura do Responsável pelo Atendimento", 40, 208);
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 170, 192, 80, 14); } catch { /* skip */ }
  }
  doc.text("Assinatura do Paciente", 170, 208);

  return doc;
}
