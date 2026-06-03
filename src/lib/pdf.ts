import type { jsPDF } from "jspdf";
import { dateISOtoBR } from "./masks";

export interface PatientPdfData {
  prontuario: string | null;
  nome: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  estado_civil?: string | null;
  estado_nascimento?: string | null;
  cep?: string | null;
  rua?: string | null;
  bairro?: string | null;
  numero?: string | null;
  endereco?: string | null;
  profissao?: string | null;
  escolaridade?: string | null;
  telefone: string | null;
  email: string | null;
  signature_data: string | null;
  assinatura?: string | null;
  signed_at: string | null;
  creator_name?: string | null;
  created_at?: string | null;
  procedimentos?: string[] | null;
}

export const CONTRACT_TEXT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS

Pelo presente instrumento particular, de um lado a OdontoClinic, doravante denominada CONTRATADA, e de outro lado o paciente identificado neste cadastro, doravante denominado CONTRATANTE, têm entre si justo e contratado o seguinte:

1. OBJETO — A CONTRATADA prestará serviços odontológicos conforme plano de tratamento apresentado e acordado com o CONTRATANTE.

2. OBRIGAÇÕES — O CONTRATANTE compromete-se a comparecer às consultas agendadas, seguir as orientações clínicas e efetuar os pagamentos conforme combinado.

3. SIGILO — A CONTRATADA se compromete a manter sigilo absoluto sobre as informações clínicas e pessoais do CONTRATANTE, conforme a LGPD.

4. CANCELAMENTO — Em caso de desistência, o CONTRATANTE deverá comunicar a CONTRATADA com antecedência mínima de 24 horas.

5. ACEITE — Ao assinar digitalmente este documento, o CONTRATANTE declara ter lido, compreendido e aceito os termos aqui descritos.

Este contrato é firmado em meio digital e possui validade jurídica nos termos da legislação vigente.`;

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
  } catch {
    return null;
  }
}

export async function generatePatientPdf(p: PatientPdfData): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Fetch logo before drawing (jsPDF cannot load remote URLs directly)
  const logoBase64 = await fetchLogoBase64();

  doc.setFillColor(38, 99, 176);
  doc.rect(0, 0, pageW, 70, "F");

  // Logo (white background pill so it contrasts with the blue header)
  if (logoBase64) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 11, 48, 48, 6, 6, "F");
    try { doc.addImage(logoBase64, "PNG", margin + 4, 15, 40, 40); } catch { /* skip if image fails */ }
  }

  const textX = logoBase64 ? margin + 58 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("OdontoClinic", textX, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Cadastro Digital de Paciente", textX, 50);
  if (p.prontuario) doc.text(p.prontuario, pageW - margin, 50, { align: "right" });

  y = 110;
  doc.setTextColor(34, 40, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Dados do Paciente", margin, y);
  y += 6;
  doc.setDrawColor(220, 228, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // Build full address string
  const fullAddress = p.rua
    ? `${p.rua}, ${p.numero || "s/n"} - ${p.bairro || ""} (CEP: ${p.cep || "—"})`
    : (p.endereco || "—");

  const rows: [string, string][] = [
    ["Nome completo",      p.nome             || "—"],
    ["CPF",               p.cpf              || "—"],
    ["RG",                p.rg               || "—"],
    ["Data de nascimento", dateISOtoBR(p.data_nascimento) || "—"],
    ["Estado civil",      p.estado_civil      || "—"],
    ["Estado de nascimento", p.estado_nascimento || "—"],
    ["Profissão",         p.profissao         || "—"],
    ["Escolaridade",      p.escolaridade      || "—"],
    ["Telefone",          p.telefone          || "—"],
    ["Email",             p.email             || "—"],
    ["Endereço",          fullAddress],
  ];

  doc.setFontSize(10);
  rows.forEach(([k, v]) => {
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(90, 100, 120);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(34, 40, 60);
    const lines = doc.splitTextToSize(v, pageW - margin * 2 - 140);
    doc.text(lines, margin + 140, y);
    y += Math.max(16, lines.length * 14);
  });

  // ── Serviços Contratados ─────────────────────────────────────────────────
  const PROC_NAMES: Record<string, string> = {
    protese:  "Prótese Dentária",
    implante: "Implante Dentário",
    ortho:    "Ortodontia",
  };
  const procList = (p.procedimentos ?? []).filter((k) => k in PROC_NAMES);
  y += 6;
  if (y > 720) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(34, 40, 60);
  doc.text("Serviços Contratados", margin, y);
  y += 6;
  doc.setDrawColor(220, 228, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (procList.length === 0) {
    doc.setTextColor(120, 130, 150);
    doc.text("Nenhum procedimento adicional contratado.", margin, y);
    y += 16;
  } else {
    doc.setTextColor(34, 40, 60);
    procList.forEach((k) => {
      if (y > 720) { doc.addPage(); y = margin; }
      doc.text(`✓  ${PROC_NAMES[k]}`, margin, y);
      y += 16;
    });
  }
  y += 4;

  if (p.creator_name || p.created_at) {
    y += 8;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 120, 140);
    const parts: string[] = [];
    if (p.creator_name) parts.push(`Criado por ${p.creator_name}`);
    if (p.created_at) parts.push(new Date(p.created_at).toLocaleString("pt-BR"));
    doc.text(parts.join(" • "), margin, y);
  }

  y += 16;
  if (y > 720) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(34, 40, 60);
  doc.text("Contrato", margin, y);
  y += 6;
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const contractLines = doc.splitTextToSize(CONTRACT_TEXT, pageW - margin * 2);
  contractLines.forEach((line: string) => {
    if (y > 740) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += 12;
  });

  if (y > 600) { doc.addPage(); y = margin; }
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Assinatura Digital", margin, y);
  y += 6;
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Signature image: prefer new `assinatura` field, fall back to legacy `signature_data`
  const sigImg = p.assinatura || p.signature_data || "";

  // Date string for all signature blocks
  const refDate = p.signed_at || p.created_at || new Date().toISOString();
  const d = new Date(refDate);
  const dateStr = `${String(d.getDate()).padStart(2, "0")} / ${String(d.getMonth() + 1).padStart(2, "0")} / ${d.getFullYear()}`;

  // Main contract signature block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(34, 40, 60);
  if (sigImg) {
    try { doc.addImage(sigImg, "PNG", margin, y, 200, 55); } catch { /* skip if image fails */ }
    y += 60;
  } else {
    doc.text("Assinatura do Paciente: _________________________________", margin, y);
    y += 22;
  }
  doc.text(`Data: ${dateStr}`, margin, y);

  // ── Seções de contrato por procedimento ──────────────────────────────────
  const procs = p.procedimentos ?? [];

  if (procs.includes("protese")) {
    addProcedureSection(doc, margin, pageW, CONTRATO_PROTESE, dateStr, sigImg);
  }
  if (procs.includes("implante")) {
    addProcedureSection(doc, margin, pageW, CONTRATO_IMPLANTE, dateStr, sigImg);
  }
  if (procs.includes("ortho")) {
    addProcedureSection(doc, margin, pageW, CONTRATO_ORTODONTIA, dateStr, sigImg);
  }

  return doc;
}

// ── Texts for each procedure contract section ──────────────────────────────

const CONTRATO_PROTESE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — PRÓTESE DENTÁRIA

O presente contrato regula a prestação de serviços odontológicos referentes à confecção e instalação de prótese dentária, celebrado entre a clínica e o paciente identificado neste documento.

CLÁUSULA 1 — DO OBJETO
A clínica se compromete a realizar o procedimento de prótese dentária conforme planejamento clínico previamente apresentado e aceito pelo paciente, utilizando materiais de qualidade compatíveis com o procedimento indicado.

CLÁUSULA 2 — DO PRAZO
O prazo estimado para conclusão do tratamento será informado pelo profissional responsável na consulta de avaliação, podendo ser alterado em razão de fatores clínicos supervenientes, como necessidade de cicatrização ou ajustes oclusais.

CLÁUSULA 3 — DA GARANTIA
A prótese instalada possui garantia de 12 (doze) meses contra defeitos de fabricação, desde que o paciente siga as orientações de higiene e conservação fornecidas pela equipe clínica. Danos causados por mau uso, queda ou acidente não estão cobertos pela garantia.

CLÁUSULA 4 — DAS OBRIGAÇÕES DO PACIENTE
O paciente se compromete a comparecer a todas as consultas agendadas, comunicar imediatamente qualquer desconforto ou intercorrência, e seguir rigorosamente as orientações pós-instalação fornecidas pelo profissional.

CLÁUSULA 5 — DO PAGAMENTO
Os valores e condições de pagamento foram acordados previamente e constam em documento financeiro separado. O não pagamento nas datas acordadas poderá implicar na suspensão do tratamento.

Declaro ter lido, compreendido e concordado com todas as cláusulas acima.`;

const CONTRATO_IMPLANTE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — IMPLANTE DENTÁRIO

O presente contrato regula a prestação de serviços odontológicos referentes à instalação de implante dentário osseointegrado, celebrado entre a clínica e o paciente identificado neste documento.

CLÁUSULA 1 — DO OBJETO
A clínica se compromete a realizar o procedimento de implante dentário conforme planejamento cirúrgico aprovado, utilizando implantes de titânio certificados e seguindo os protocolos clínicos vigentes.

CLÁUSULA 2 — DOS RISCOS E LIMITAÇÕES
O paciente declara estar ciente de que o sucesso do implante depende de fatores biológicos individuais, incluindo qualidade óssea, higiene bucal e ausência de doenças sistêmicas não controladas. A taxa de sucesso é elevada, porém não pode ser garantida em 100% dos casos.

CLÁUSULA 3 — DO PERÍODO DE OSSEOINTEGRAÇÃO
Após a instalação do implante, será necessário aguardar o período de osseointegração, que varia entre 3 e 6 meses conforme avaliação clínica. Durante esse período, o paciente deverá seguir todas as orientações fornecidas e comparecer às consultas de acompanhamento.

CLÁUSULA 4 — DA GARANTIA
O implante possui garantia de 5 (cinco) anos contra falha de osseointegração primária, desde que o paciente não apresente histórico de tabagismo, diabetes descontrolada ou outras condições que comprometam a cicatrização, e que siga todas as orientações pós-operatórias.

CLÁUSULA 5 — DAS OBRIGAÇÕES DO PACIENTE
O paciente se compromete a não fumar durante o período de osseointegração, manter higiene bucal rigorosa, comparecer a todas as consultas de acompanhamento e comunicar imediatamente qualquer sintoma como dor intensa, sangramento ou mobilidade do implante.

CLÁUSULA 6 — DO PAGAMENTO
Os valores e condições de pagamento foram acordados previamente e constam em documento financeiro separado.

Declaro ter lido, compreendido e concordado com todas as cláusulas acima.`;

const CONTRATO_ORTODONTIA = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — ORTODONTIA

O presente contrato regula a prestação de serviços odontológicos referentes ao tratamento ortodôntico, celebrado entre a clínica e o paciente identificado neste documento.

CLÁUSULA 1 — DO OBJETO
A clínica se compromete a realizar o tratamento ortodôntico conforme planejamento apresentado ao paciente, utilizando aparelhos e materiais adequados ao caso clínico.

CLÁUSULA 2 — DO PRAZO DE TRATAMENTO
O prazo estimado para o tratamento ortodôntico será informado pelo profissional responsável, podendo variar em função da resposta biológica do paciente, da colaboração nos comparecimentos e do uso correto dos dispositivos prescritos.

CLÁUSULA 3 — DAS OBRIGAÇÕES DO PACIENTE
O paciente se compromete a comparecer às consultas mensais de manutenção, usar os elásticos e demais dispositivos conforme orientado, evitar alimentos que possam danificar o aparelho, e manter higiene bucal rigorosa para prevenir desmineralização e cáries durante o tratamento.

CLÁUSULA 4 — DA CONTENÇÃO PÓS-TRATAMENTO
Ao término do tratamento ativo, o paciente deverá utilizar contenção (fixa ou removível) pelo período indicado pelo profissional. O não uso da contenção pode resultar em recidiva do apinhamento, não sendo a clínica responsável por tais resultados.

CLÁUSULA 5 — DA GARANTIA E RESPONSABILIDADE
A clínica se responsabiliza pela qualidade técnica do tratamento. Quebras de braquetes decorrentes do consumo de alimentos inadequados ou trauma poderão gerar custos adicionais de manutenção.

CLÁUSULA 6 — DO PAGAMENTO
Os valores e condições de pagamento foram acordados previamente e constam em documento financeiro separado. A inadimplência por mais de 30 dias poderá resultar na suspensão das manutenções até regularização.

Declaro ter lido, compreendido e concordado com todas as cláusulas acima.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addProcedureSection(doc: any, margin: number, pageW: number, text: string, dateStr = "", sigImg = "") {
  // Always start on a new page
  doc.addPage();
  let y = margin;

  // Blue header bar
  doc.setFillColor(38, 99, 176);
  doc.rect(0, 0, pageW, 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  // Extract title from first line of text
  const firstLine = text.split("\n")[0];
  doc.text(firstLine, margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("OdontoClinic — Cadastro Digital de Paciente", margin, 47);
  y = 78;

  // Contract body (skip the first title line)
  doc.setTextColor(34, 40, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const body = text.split("\n").slice(1).join("\n").trim();
  const lines = doc.splitTextToSize(body, pageW - margin * 2);
  lines.forEach((line: string) => {
    if (y > 740) { doc.addPage(); y = margin; }
    // Bold for clause headings
    if (/^CLÁUSULA/.test(line)) {
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }
    doc.text(line, margin, y);
    y += 13;
  });

  // Signature block
  if (y > 640) { doc.addPage(); y = margin; }
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(34, 40, 60);

  if (sigImg) {
    try { doc.addImage(sigImg, "PNG", margin, y, 200, 55); } catch { /* skip if image fails */ }
    y += 60;
  } else {
    doc.text("Assinatura do Paciente: _________________________________", margin, y);
    y += 22;
  }
  doc.text(`Data: ${dateStr || "_____ / _____ / _________"}`, margin, y);
}
