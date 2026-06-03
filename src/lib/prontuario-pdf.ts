/**
 * prontuario-pdf.ts
 *
 * Generates a two-page A4 landscape PDF by placing the physical form images as
 * backgrounds and overlaying filled data at calibrated coordinates.
 *
 * Page 1 — Ficha de Planejamento (IOP046)
 * Page 2 — Eventos Efetivamente Realizados (IOP043)
 *
 * NOTE: All x/y coordinates are in millimetres (jsPDF unit: 'mm').
 * They are calibrated against the physical form images — adjust as needed after
 * generating a test PDF with all fields filled.
 */

const FICHA_PLANEJAMENTO_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg";
const FICHA_EVENTOS_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg";

async function loadImageAsBase64(url: string): Promise<string | null> {
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
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch { return iso ?? ""; }
}

// ── Dental arch configuration ─────────────────────────────────────────────

// IOP046 spec lists 15 upper teeth (note: "24,24" in original spec is likely 24,25)
const UPPER_TEETH = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const LOWER_TEETH = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];

// X positions for each tooth column (mm) — adjust for calibration
const UPPER_X: number[] = [35,48,61,74,87,100,113,126,139,152,165,178,191,204,217,230];
const LOWER_X: number[] = [35,48,61,74,87,100,113,126,139,152,165,178,191,204,217,230];

const PROCEDURES = ["Periodontia","Endodontia","Clareamento","Dentística","Núcleo","Provisória","Definitiva"];

// Y positions per procedure row in upper arch
const UPPER_PROC_Y: Record<string, number> = {
  Periodontia: 135, Endodontia: 143, Clareamento: 151,
  Dentística: 159, Núcleo: 167, Provisória: 175, Definitiva: 183,
};
// Y positions per procedure row in lower arch (same page, shifted down)
const LOWER_PROC_Y: Record<string, number> = {
  Periodontia: 197, Endodontia: 205, Clareamento: 213,
  Dentística: 221, Núcleo: 229, Provisória: 237, Definitiva: 245,
};

// ── Main export ───────────────────────────────────────────────────────────

export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297; // page width mm
  const H = 210; // page height mm

  // Load both form backgrounds in parallel
  const [bg1, bg2] = await Promise.all([
    loadImageAsBase64(FICHA_PLANEJAMENTO_URL),
    loadImageAsBase64(FICHA_EVENTOS_URL),
  ]);

  // Helper: set standard text style
  const setStyle = (size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(26, 58, 107); // #1a3a6b — matches physical form ink
  };

  // Helper: render text only if value is truthy
  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x, y, opts);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento (IOP046)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) {
    try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip if fails */ }
  }

  setStyle(9);

  // ── Cabeçalho ─────────────────────────────────────────────────────────
  t(fmtDate(p.data),       60,  18);
  t(p.planejado_por,      105,  18);
  t(p.num_prontuario,     238,  18);
  t(p.num_contrato,       272,  18);
  t(p.nome,                60,  26);
  t(fmtDate(p.data_nasc), 238,  26);
  t(p.rg,                 272,  26);
  t(p.endereco,            60,  34);
  t(p.telefone,           272,  34);

  // ── Anamnese ──────────────────────────────────────────────────────────
  setStyle(8);
  t(p.alergico,            22,  47);
  t(p.hemorragia,          22,  54);
  t(p.diabetes,            22,  61);
  t(p.cardiopatia,         22,  68);

  t(p.esta_gravida,        75,  47);
  t(p.prob_respiratorio,   75,  54);
  t(p.dst_aids_sifilis,    75,  61);
  t(p.usa_drogas,          75,  68);

  t(p.fuma,               128,  47);
  t(p.bebe,               128,  54);
  t(p.gastrointestinal,   128,  61);
  t(p.cicatrizacao,       128,  68);

  t(p.hepatite,           181,  47);
  t(p.ts_tc,              181,  54);
  t(p.convulsivo,         181,  61);
  t(p.pressao_arterial,   181,  68);

  t(fmtDate(p.vigencia_de),  228, 47);
  t(fmtDate(p.vigencia_ate), 258, 47);
  t(p.medico,             228,  61);
  t(p.fone_medico,        258,  61);

  t(p.medicamentos,        22,  76);
  t(p.outro_problema,     110,  76);
  t(p.queixa_principal,   185,  76);

  // ── Assinatura do paciente (campo "Atesto...") ─────────────────────────
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 228, 72, 60, 18); } catch { /* skip */ }
  }

  // ── Planejamento e Prognóstico / Cobertura ─────────────────────────────
  setStyle(8);
  if (p.planejamento_prognostico) {
    const lines = doc.splitTextToSize(p.planejamento_prognostico.trim(), 130);
    doc.text(lines, 22, 92);
  }
  if (p.cobertura) {
    const lines = doc.splitTextToSize(p.cobertura.trim(), 100);
    doc.text(lines, 185, 92);
  }

  // ── Arcada Superior ────────────────────────────────────────────────────
  setStyle(7);
  PROCEDURES.forEach((proc) => {
    const yRow = UPPER_PROC_Y[proc];
    if (!yRow) return;
    UPPER_TEETH.forEach((dente, di) => {
      const xCol = UPPER_X[di];
      if (xCol === undefined) return;
      const checked = p.arcada_superior?.[dente]?.[proc];
      doc.text(checked ? "✓" : "—", xCol + 3, yRow, { align: "center" });
    });
  });

  // ── Arcada Inferior ────────────────────────────────────────────────────
  // Rows go past 210mm — add a new page with the same background
  doc.addPage();
  if (bg1) {
    try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ }
  }
  setStyle(7);
  PROCEDURES.forEach((proc) => {
    // Reuse LOWER_PROC_Y relative positions shifted to top of the new page
    const yRowShifted = (LOWER_PROC_Y[proc] ?? 0) - 190; // shift to ~7-55mm range
    LOWER_TEETH.forEach((dente, di) => {
      const xCol = LOWER_X[di];
      if (xCol === undefined) return;
      const checked = p.arcada_inferior?.[dente]?.[proc];
      doc.text(checked ? "✓" : "—", xCol + 3, yRowShifted + 10, { align: "center" });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Eventos Efetivamente Realizados (IOP043)
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bg2) {
    try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ }
  }

  setStyle(9);
  t(p.nome,           60,  22);
  t(p.num_contrato,  185,  22);
  t(p.num_prontuario, 245, 22);

  setStyle(8);
  const LINE_Y_START = 38;
  const LINE_SPACING = 8;
  const MAX_LINES_PER_PAGE = 18;

  let pageEvents = eventos.slice();
  let lineIdx = 0;
  let isFirstEvPage = true;

  while (pageEvents.length > 0) {
    if (!isFirstEvPage) {
      doc.addPage();
      if (bg2) {
        try { doc.addImage(bg2, "JPEG", 0, 0, W, H); } catch { /* skip */ }
      }
      setStyle(8);
      lineIdx = 0;
    }
    isFirstEvPage = false;

    const batch = pageEvents.splice(0, MAX_LINES_PER_PAGE);
    batch.forEach((ev: any) => {
      const y = LINE_Y_START + lineIdx * LINE_SPACING;
      if (y > H - 15) return;

      t(fmtDate(ev.data),        18, y);
      t(ev.dente,                42, y);
      if (ev.procedimento) {
        const procLines = doc.splitTextToSize((ev.procedimento ?? "").trim(), 148);
        doc.text(procLines[0] ?? "", 55, y);
      }
      t(ev.dentista,            210, y);
      if (ev.assinatura_paciente) {
        try { doc.addImage(ev.assinatura_paciente, "PNG", 248, y - 6, 40, 8); } catch { /* skip */ }
      }
      lineIdx++;
    });
  }

  // ── Rodapé de assinaturas ─────────────────────────────────────────────
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
