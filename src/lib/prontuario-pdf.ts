// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

const LOGO_URL =
  "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/image_Pippit_202606022141.png";

async function fetchLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function addHeader(doc: Doc, pageW: number, margin: number, title: string, subtitle: string, logoB64: string | null) {
  doc.setFillColor(38, 99, 176);
  doc.rect(0, 0, pageW, 56, "F");

  if (logoB64) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 8, 40, 40, 5, 5, "F");
    try { doc.addImage(logoB64, "PNG", margin + 2, 10, 36, 36); } catch { /* skip */ }
  }

  const tx = logoB64 ? margin + 50 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(title, tx, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, tx, 43);
}

function kv(doc: Doc, margin: number, y: number, label: string, value: string, labelW = 120) {
  doc.setFont("helvetica", "bold");
  doc.setTextColor(90, 100, 120);
  doc.setFontSize(9);
  doc.text(label, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 35, 50);
  doc.text(value || "—", margin + labelW, y);
}

function sectionTitle(doc: Doc, margin: number, pageW: number, y: number, title: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(38, 99, 176);
  doc.text(title, margin, y);
  doc.setDrawColor(38, 99, 176);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  doc.setLineWidth(0.2);
  doc.setDrawColor(200, 208, 220);
  return y + 14;
}

const DENTES_SUPERIOR = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const DENTES_INFERIOR = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];
const PROCEDIMENTOS = ["Periodontia","Endodontia","Clareamento","Dentística","Núcleo","Provisória","Definitiva"];

function drawArcadaTable(doc: Doc, margin: number, pageW: number, y: number, arcada: Record<string, any>, dentes: string[]) {
  const colW = (pageW - margin * 2 - 70) / dentes.length;
  const rowH = 11;

  // Header
  doc.setFillColor(240, 244, 252);
  doc.rect(margin, y, pageW - margin * 2, rowH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(50, 60, 80);
  doc.text("Procedimento", margin + 2, y + 7.5);
  dentes.forEach((d, i) => {
    doc.text(d, margin + 70 + i * colW + colW / 2, y + 7.5, { align: "center" });
  });
  y += rowH;

  PROCEDIMENTOS.forEach((proc, pi) => {
    if (pi % 2 === 0) {
      doc.setFillColor(250, 252, 255);
      doc.rect(margin, y, pageW - margin * 2, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(50, 60, 80);
    doc.text(proc, margin + 2, y + 7.5);
    dentes.forEach((d, i) => {
      const checked = arcada?.[d]?.[proc];
      const cx = margin + 70 + i * colW + colW / 2;
      const cy = y + 5;
      doc.setDrawColor(180, 190, 210);
      doc.rect(cx - 4, cy - 3.5, 8, 8);
      if (checked) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(38, 99, 176);
        doc.setFontSize(8);
        doc.text("✓", cx, cy + 4.5, { align: "center" });
      }
    });
    doc.setDrawColor(220, 228, 240);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);
    y += rowH;
  });
  return y + 4;
}

export async function generateProntuarioPdf(p: any, eventos: any[]): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const logoB64 = await fetchLogoBase64();

  // ──────────────────────────────────────────────────
  // PAGE 1 — Ficha de Planejamento (IOP046)
  // ──────────────────────────────────────────────────
  addHeader(doc, pageW, margin, "FICHA DE PLANEJAMENTO", "Mod. IOP046 — OdontoClinic", logoB64);
  let y = 70;

  // Patient header
  y = sectionTitle(doc, margin, pageW, y, "Dados do Paciente");
  const half = (pageW - margin * 2) / 2;
  kv(doc, margin, y, "Data:", fmtDate(p.data)); kv(doc, margin + half, y, "Planejado por:", p.planejado_por || "—"); y += 14;
  kv(doc, margin, y, "Nº Prontuário:", p.num_prontuario || "—"); kv(doc, margin + half, y, "Nº Contrato:", p.num_contrato || "—"); y += 14;
  kv(doc, margin, y, "Nome:", p.nome || "—", 50); y += 14;
  kv(doc, margin, y, "Dt. Nasc.:", fmtDate(p.data_nasc)); kv(doc, margin + half, y, "RG:", p.rg || "—"); y += 14;
  kv(doc, margin, y, "Endereço:", p.endereco || "—", 50); y += 14;
  kv(doc, margin, y, "Telefone:", p.telefone || "—", 60); y += 18;

  // Anamnese
  y = sectionTitle(doc, margin, pageW, y, "Anamnese");
  const anaFields: [string, string][] = [
    ["Alérgico", p.alergico], ["Hemorragia", p.hemorragia], ["Diabetes", p.diabetes], ["Cardiopatia", p.cardiopatia],
    ["Grávida?", p.esta_gravida], ["Probl. Resp.", p.prob_respiratorio], ["DST/AIDS/Síf.", p.dst_aids_sifilis], ["Usa drogas?", p.usa_drogas],
    ["Fuma?", p.fuma], ["Bebe?", p.bebe], ["Gastrointestinal", p.gastrointestinal], ["Cicatrização", p.cicatrizacao],
    ["Hepatite", p.hepatite], ["TS/TC", p.ts_tc], ["Convulsivo", p.convulsivo], ["Pressão Art.", p.pressao_arterial],
  ];
  const cols = 4;
  const colWAna = (pageW - margin * 2) / cols;
  for (let i = 0; i < anaFields.length; i += cols) {
    const row = anaFields.slice(i, i + cols);
    row.forEach(([label, val], ci) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(90, 100, 120);
      doc.text(label + ":", margin + ci * colWAna, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(30, 35, 50);
      doc.text(val || "—", margin + ci * colWAna + 55, y);
    });
    y += 13;
  }
  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(30, 35, 50);
  kv(doc, margin, y, "Vigência:", `${fmtDate(p.vigencia_de)} a ${fmtDate(p.vigencia_ate)}`);
  kv(doc, margin + half, y, "Médico:", `${p.medico || "—"}  Tel: ${p.fone_medico || "—"}`); y += 13;
  kv(doc, margin, y, "Medicamentos:", p.medicamentos || "—", 70); y += 13;
  kv(doc, margin, y, "Outro problema:", p.outro_problema || "—", 80); y += 13;
  kv(doc, margin, y, "Queixa principal:", p.queixa_principal || "—", 85); y += 20;

  // Patient attestation + signature
  y = sectionTitle(doc, margin, pageW, y, "Declaração do Paciente");
  doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(60, 70, 90);
  doc.text("Atesto serem verdadeiras as informações que prestei quanto ao meu estado geral de saúde.", margin, y); y += 16;
  if (p.assinatura_paciente_planejamento) {
    try { doc.addImage(p.assinatura_paciente_planejamento, "PNG", margin, y, 160, 40); } catch { /* skip */ }
    y += 44;
  } else {
    doc.setDrawColor(180, 190, 210); doc.line(margin, y + 10, margin + 180, y + 10); y += 22;
  }

  // Planning
  y = sectionTitle(doc, margin, pageW, y, "Planejamento e Prognóstico / Cobertura");
  if (p.planejamento_prognostico) {
    const lines = doc.splitTextToSize(p.planejamento_prognostico, half - 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(30, 35, 50);
    lines.forEach((l: string) => { doc.text(l, margin, y); y += 11; });
  }
  if (p.cobertura) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(90, 100, 120);
    doc.text("Cobertura:", margin + half, y - (p.planejamento_prognostico ? ((doc.splitTextToSize(p.planejamento_prognostico, half - 10).length) * 11) : 0));
    doc.setFont("helvetica", "normal"); doc.setTextColor(30, 35, 50);
    const lines2 = doc.splitTextToSize(p.cobertura, half - 10);
    lines2.forEach((l: string, li: number) => doc.text(l, margin + half, y - (p.planejamento_prognostico ? ((doc.splitTextToSize(p.planejamento_prognostico, half - 10).length - lines2.length + li) * 11) : 0)));
  }
  y += 16;

  // Arcadas
  if (y > 560) { doc.addPage(); y = margin; }
  y = sectionTitle(doc, margin, pageW, y, "Arcada Superior");
  y = drawArcadaTable(doc, margin, pageW, y, p.arcada_superior ?? {}, DENTES_SUPERIOR);
  if (y > 680) { doc.addPage(); y = margin; }
  y = sectionTitle(doc, margin, pageW, y, "Arcada Inferior");
  drawArcadaTable(doc, margin, pageW, y, p.arcada_inferior ?? {}, DENTES_INFERIOR);

  // ──────────────────────────────────────────────────
  // PAGE 2 — Eventos Efetivamente Realizados (IOP043)
  // ──────────────────────────────────────────────────
  doc.addPage();
  addHeader(doc, pageW, margin, "EVENTOS EFETIVAMENTE REALIZADOS", "Mod. IOP043 — OdontoClinic", logoB64);
  y = 70;

  y = sectionTitle(doc, margin, pageW, y, "Identificação");
  kv(doc, margin, y, "Paciente:", p.nome || "—", 60);
  kv(doc, margin + pageW / 2, y, "Prontuário:", `${p.num_prontuario || "—"}  ·  Contrato: ${p.num_contrato || "—"}`, 70);
  y += 20;

  // Events table
  const colWidths = [60, 35, 200, 110, 80];
  const headers = ["Data", "Dente", "Procedimento", "Dentista", "Paciente"];
  const rowH2 = 24;

  // Header row
  doc.setFillColor(240, 244, 252);
  doc.rect(margin, y, pageW - margin * 2, rowH2 - 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(50, 60, 80);
  let cx = margin + 3;
  headers.forEach((h, i) => {
    doc.text(h, cx, y + 13);
    cx += colWidths[i];
  });
  y += rowH2;

  eventos.forEach((ev: any, ei: number) => {
    if (y > 760) { doc.addPage(); y = margin; }
    if (ei % 2 === 1) { doc.setFillColor(250, 252, 255); doc.rect(margin, y, pageW - margin * 2, rowH2 - 2, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(30, 35, 50);
    cx = margin + 3;
    const cells = [fmtDate(ev.data), ev.dente || "—", ev.procedimento || "—", ev.dentista || "—"];
    cells.forEach((cell, i) => {
      const lines = doc.splitTextToSize(cell, colWidths[i] - 4);
      doc.text(lines[0], cx, y + 14);
      cx += colWidths[i];
    });
    if (ev.assinatura_paciente) {
      try { doc.addImage(ev.assinatura_paciente, "PNG", cx, y + 2, 70, 20); } catch { /* skip */ }
    }
    doc.setDrawColor(220, 228, 240);
    doc.line(margin, y + rowH2 - 2, pageW - margin, y + rowH2 - 2);
    y += rowH2;
  });

  if (eventos.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(130, 140, 160);
    doc.text("Nenhum evento registrado.", margin + 4, y + 14);
    y += rowH2;
  }

  // Doctor signature
  y += 20;
  if (y > 700) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(60, 70, 90);
  doc.text("Assinatura do responsável pelo atendimento:", margin, y); y += 14;
  if (p.assinatura_doutor) {
    try { doc.addImage(p.assinatura_doutor, "PNG", margin, y, 180, 50); } catch { /* skip */ }
    y += 54;
  } else {
    doc.setDrawColor(180, 190, 210); doc.line(margin, y + 10, margin + 200, y + 10); y += 22;
  }

  return doc;
}
