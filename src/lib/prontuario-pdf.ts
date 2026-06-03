/**
 * prontuario-pdf.ts
 *
 * Generates a three-page A4 landscape PDF (297×210 mm) using the physical
 * form images as backgrounds and overlaying filled data at calibrated
 * coordinates.
 *
 * Page 1 — Ficha de Planejamento frente (IOP046)
 * Page 2 — Verso: Arcada Inferior + Odontograma Atual
 * Page 3+ — Eventos Efetivamente Realizados (IOP043)
 *
 * NOTE: All coordinates are in millimetres. Calibrate by generating a test
 * PDF and comparing side-by-side with the physical form photo.
 * Adjust values using the OFFSET constants below for global shifts.
 */

const FICHA_PLANEJAMENTO_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento.jpg";
const FICHA_VERSO_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-planejamento-verso.jpg";
const FICHA_EVENTOS_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-eventos.jpg";

// ── Global offset for quick re-calibration ────────────────────────────────
// Change these to shift ALL fields at once if the whole PDF is offset.
const OFF = { x: 0, y: 0 };

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

// ── Main export ───────────────────────────────────────────────────────────
export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  const [bg1, bgVerso, bg2] = await Promise.all([
    toBase64(FICHA_PLANEJAMENTO_URL),
    toBase64(FICHA_VERSO_URL),
    toBase64(FICHA_EVENTOS_URL),
  ]);

  const style = (size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 80); // strong dark blue — more legible than #1a3a6b
  };

  // Place text only if there's a non-empty value
  const t = (val: string | null | undefined, x: number, y: number, opts?: any) => {
    const v = (val ?? "").toString().trim();
    if (v) doc.text(v, x + OFF.x, y + OFF.y, opts ?? undefined);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Ficha de Planejamento — frente (IOP046)
  // ═══════════════════════════════════════════════════════════════════════

  if (bg1) { try { doc.addImage(bg1, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  style(9);

  // ── Cabeçalho ──────────────────────────────────────────────────────────
  t(fmtDate(p.data),        72,  62);
  t(p.planejado_por,       108,  62);
  t(p.num_prontuario,      222,  62);
  t(p.num_contrato,        258,  62);
  t(p.nome,                 80,  78);
  t(fmtDate(p.data_nasc),  222,  78);
  t(p.rg,                  260,  78);
  t(p.endereco,             80,  92);
  t(p.telefone,            260,  92);

  // ── Anamnese ───────────────────────────────────────────────────────────
  style(8);
  // Col 1 (x=62)
  t(p.alergico,             62, 110); t(p.hemorragia,       62, 122);
  t(p.diabetes,             62, 134); t(p.cardiopatia,      62, 146);
  // Col 2 (x=128)
  t(p.esta_gravida,        128, 110); t(p.prob_respiratorio, 128, 122);
  t(p.dst_aids_sifilis,    128, 134); t(p.usa_drogas,        128, 146);
  // Col 3 (x=186)
  t(p.fuma,                186, 110); t(p.bebe,             186, 122);
  t(p.gastrointestinal,    186, 134); t(p.cicatrizacao,     186, 146);
  // Col 4 (x=245)
  t(p.hepatite,            245, 110); t(p.ts_tc,            245, 122);
  t(p.convulsivo,          245, 134); t(p.pressao_arterial,  245, 146);
  // Vigência / Médico — right column (capped to page width)
  t(fmtDate(p.vigencia_de),  230, 122); t(fmtDate(p.vigencia_ate), 260, 122);
  t(p.medico,               230, 146); t(p.fone_medico,           260, 146);
  // Full-width bottom rows
  t(p.medicamentos,          30, 175); t(p.outro_problema,       150, 175);
  t(p.queixa_principal,     250, 175);

  // ── Assinatura do paciente — campo "Atesto..." ─────────────────────────
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", 248, 160, 45, 16); } catch { /* skip */ }
  }

  // ── Planejamento e Prognóstico / Cobertura ─────────────────────────────
  style(8);
  if (p.planejamento_prognostico) {
    doc.text(doc.splitTextToSize(p.planejamento_prognostico.trim(), 160), 30, 210);
  }
  if (p.cobertura) {
    doc.text(doc.splitTextToSize(p.cobertura.trim(), 90), 250, 200);
  }

  // ── Arcada Superior ────────────────────────────────────────────────────
  style(7);
  UPPER_PROCS.forEach(({ key, y }) => {
    UPPER_TEETH.forEach((dente, di) => {
      const x = UPPER_X[di];
      if (x !== undefined)
        doc.text(p.arcada_superior?.[dente]?.[key] ? "✓" : "—", x + 3 + OFF.x, y + OFF.y, { align: "center" });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2 — Verso: Arcada Inferior + Odontograma Atual
  // ═══════════════════════════════════════════════════════════════════════

  doc.addPage();
  if (bgVerso) { try { doc.addImage(bgVerso, "JPEG", 0, 0, W, H); } catch { /* skip */ } }

  style(7);
  LOWER_PROCS.forEach(({ key, y }) => {
    LOWER_TEETH.forEach((dente, di) => {
      const x = LOWER_X[di];
      if (x !== undefined)
        doc.text(p.arcada_inferior?.[dente]?.[key] ? "✓" : "", x + 3 + OFF.x, y + OFF.y, { align: "center" });
    });
  });

  style(8);
  ODONTOGRAMA_COLS.forEach(({ dentes, xTxt, yStart }) => {
    dentes.forEach((dente, i) => {
      const obs = (p.odontograma?.[dente.toString()] ?? "").trim();
      if (obs) doc.text(obs, xTxt + OFF.x, yStart + i * 9 + OFF.y, { maxWidth: 60 });
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

    style(9);
    if (firstEvPage) {
      t(p.nome,           90, 55);
      t(p.num_contrato,  220, 55);
      t(p.num_prontuario, 270, 55);
      firstEvPage = false;
    }

    style(8);
    const batch = remaining.splice(0, MAX_LINES);
    batch.forEach((ev: any, i: number) => {
      const y = LINE_Y_START + i * LINE_SPACING;
      if (y > H - 20) return;
      t(fmtDate(ev.data),    18, y);
      t(ev.dente,            42, y);
      if (ev.procedimento) {
        const lines = doc.splitTextToSize((ev.procedimento ?? "").trim(), 148);
        doc.text(lines[0] ?? "", 55 + OFF.x, y + OFF.y);
      }
      t(ev.dentista,        210, y);
      // Coluna "Paciente" — deixar vazia para assinatura à mão no papel
    });
  } while (remaining.length > 0);

  // ── Rodapé — assinaturas digitais nos campos da ficha ─────────────────
  // Calibrar xResponsavel e xPaciente com a ficha física
  const xResponsavel = 40;
  const xPaciente    = 170;
  const yRodapeSig   = 192;

  style(7);
  if (p.assinatura_doutor) {
    try { doc.addImage(p.assinatura_doutor, "PNG", xResponsavel, yRodapeSig, 60, 14); } catch { /* skip */ }
  }
  doc.text("Assinatura do Responsável pelo Atendimento", xResponsavel, 208);

  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", xPaciente, yRodapeSig, 60, 14); } catch { /* skip */ }
  }
  doc.text("Assinatura do Paciente", xPaciente, 208);

  return doc;
}
