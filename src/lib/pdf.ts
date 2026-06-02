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
  signed_at: string | null;
  creator_name?: string | null;
  created_at?: string | null;
}

export const CONTRACT_TEXT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS

Pelo presente instrumento particular, de um lado a OdontoClinic, doravante denominada CONTRATADA, e de outro lado o paciente identificado neste cadastro, doravante denominado CONTRATANTE, têm entre si justo e contratado o seguinte:

1. OBJETO — A CONTRATADA prestará serviços odontológicos conforme plano de tratamento apresentado e acordado com o CONTRATANTE.

2. OBRIGAÇÕES — O CONTRATANTE compromete-se a comparecer às consultas agendadas, seguir as orientações clínicas e efetuar os pagamentos conforme combinado.

3. SIGILO — A CONTRATADA se compromete a manter sigilo absoluto sobre as informações clínicas e pessoais do CONTRATANTE, conforme a LGPD.

4. CANCELAMENTO — Em caso de desistência, o CONTRATANTE deverá comunicar a CONTRATADA com antecedência mínima de 24 horas.

5. ACEITE — Ao assinar digitalmente este documento, o CONTRATANTE declara ter lido, compreendido e aceito os termos aqui descritos.

Este contrato é firmado em meio digital e possui validade jurídica nos termos da legislação vigente.`;

export async function generatePatientPdf(p: PatientPdfData): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  doc.setFillColor(38, 99, 176);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("OdontoClinic", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Cadastro Digital de Paciente", margin, 50);
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

  if (p.signature_data) {
    try { doc.addImage(p.signature_data, "PNG", margin, y, 240, 90); } catch (e) { console.error(e); }
  }
  y += 100;
  doc.setDrawColor(34, 40, 60);
  doc.line(margin, y, margin + 260, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 120);
  doc.text(p.nome || "Paciente", margin, y);
  if (p.signed_at) {
    doc.text(`Assinado em ${new Date(p.signed_at).toLocaleString("pt-BR")}`, margin, y + 12);
  }

  return doc;
}
