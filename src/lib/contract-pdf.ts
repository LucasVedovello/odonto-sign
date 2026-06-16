// Geração do PDF final do contrato (jsPDF + autotable).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { dateISOtoBR } from "./masks";
import {
  formatBRL,
  PAYMENT_ANNEX_OPTIONS,
  TREATMENT_LABEL,
  type Contract,
  type MaterialExtra,
  type Procedimento,
  type TreatmentType,
} from "./contracts";

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

const CONDICOES_GERAIS = `1. OBJETO — A CONTRATADA (OdontoClinic) prestará ao CONTRATANTE os serviços odontológicos descritos neste contrato, conforme plano de tratamento previamente apresentado e aceito.

2. OBRIGAÇÕES DO CONTRATANTE — Comparecer às consultas agendadas, seguir as orientações clínicas e efetuar os pagamentos nas datas acordadas.

3. VALORES E PAGAMENTO — Os valores, entrada, sinal e parcelamento constam na seção "Forma de Pagamento" deste documento e são parte integrante do contrato. A inadimplência poderá implicar na suspensão do tratamento.

4. SIGILO (LGPD) — A CONTRATADA manterá sigilo sobre as informações pessoais e clínicas do CONTRATANTE, tratando-as conforme a Lei Geral de Proteção de Dados.

5. ACEITE — Ao assinar digitalmente este documento, as partes declaram ter lido, compreendido e aceito todos os termos, anexos e condições aqui descritos.`;

const TREATMENT_TERM_TEXT: Record<TreatmentType, string> = {
  protese: `TERMO — PRÓTESE DENTÁRIA
A CONTRATADA se compromete à confecção e instalação da prótese conforme planejamento clínico. Garantia de 12 meses contra defeitos de fabricação, condicionada às orientações de higiene e conservação. Danos por mau uso não estão cobertos.`,
  implante: `TERMO — IMPLANTE DENTÁRIO
O sucesso do implante depende de fatores biológicos individuais. Período de osseointegração de 3 a 6 meses, com acompanhamento. Garantia de 5 anos contra falha de osseointegração primária, condicionada ao cumprimento das orientações pós-operatórias.`,
  ortodontia: `TERMO — ORTODONTIA
Tratamento ortodôntico conforme planejamento, com manutenções periódicas. O paciente deve usar os dispositivos conforme orientado e utilizar contenção ao final, sob pena de recidiva sem responsabilidade da clínica.`,
  alinhador_transparente: `TERMO — ALINHADOR TRANSPARENTE
O tratamento depende do uso disciplinado dos alinhadores (recomendado 22h/dia). A troca de alinhadores e o comparecimento às consultas são obrigatórios para o resultado planejado.`,
  lente_contato_facetas: `TERMO — LENTE DE CONTATO / FACETAS
Procedimento estético-restaurador com lentes/facetas. Resultados dependem das condições dentárias do paciente. Cuidados de higiene e a não exposição a esforços excessivos são indispensáveis para a durabilidade.`,
};

const ANNEX_TEXT: Record<string, string> = {
  has_parcela_facil:
    "ANEXO — PARCELA FÁCIL\nCondições especiais de parcelamento conforme termo anexo, integrando este contrato.",
  has_compra_programada:
    "ANEXO — COMPRA PROGRAMADA\nModalidade de compra programada conforme termo anexo, integrando este contrato.",
  has_pagamento_recorrente:
    "TERMO — PAGAMENTO RECORRENTE\nAutorização de cobrança recorrente conforme termo anexo, integrando este contrato.",
};

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

const MARGIN = 48;
const PAGE_BOTTOM = 760;

export async function generateContractPdf(c: Contract): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" }) as Doc;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  const logo = await fetchLogoBase64();

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  doc.setFillColor(38, 99, 176);
  doc.rect(0, 0, pageW, 70, "F");
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, 11, 48, 48, 6, 6, "F");
    try {
      doc.addImage(logo, "PNG", MARGIN + 4, 15, 40, 40);
    } catch {
      /* ignore */
    }
  }
  const textX = logo ? MARGIN + 58 : MARGIN;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("OdontoClinic", textX, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Contrato de Prestação de Serviços Odontológicos", textX, 50);
  doc.text(`Nº ${String(c.contract_number).padStart(4, "0")}`, pageW - MARGIN, 32, {
    align: "right",
  });
  doc.text(
    TREATMENT_LABEL[c.treatment_type as TreatmentType] ?? c.treatment_type,
    pageW - MARGIN,
    50,
    { align: "right" },
  );

  let y = 100;

  const ensure = (space: number) => {
    if (y + space > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const sectionTitle = (title: string) => {
    ensure(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(34, 40, 60);
    doc.text(title, MARGIN, y);
    y += 6;
    doc.setDrawColor(220, 228, 240);
    doc.line(MARGIN, y, pageW - MARGIN, y);
    y += 16;
  };

  const kvRows = (rows: [string, string][]) => {
    doc.setFontSize(10);
    rows.forEach(([k, v]) => {
      ensure(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(90, 100, 120);
      doc.text(k, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(34, 40, 60);
      const lines = doc.splitTextToSize(v || "—", contentW - 150) as string[];
      doc.text(lines, MARGIN + 150, y);
      y += Math.max(16, lines.length * 13);
    });
  };

  const paragraph = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(34, 40, 60);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    lines.forEach((line) => {
      ensure(14);
      // Títulos de termo (ex.: "TERMO — ...") em negrito; demais em normal.
      doc.setFont("helvetica", /—/.test(line) && line === line.toUpperCase() ? "bold" : "normal");
      doc.text(line, MARGIN, y);
      y += 13;
    });
    y += 6;
  };

  // ── Dados do Contratante ──────────────────────────────────────────────────
  sectionTitle("Dados do Contratante");
  kvRows([
    ["Nome", c.contratante_nome || "—"],
    ["Nascimento", dateISOtoBR(c.contratante_nascimento) || "—"],
    ["CPF", c.contratante_cpf || "—"],
    ["RG", c.contratante_rg || "—"],
    ["Profissão", c.contratante_profissao || "—"],
    ["Sexo", c.contratante_sexo || "—"],
    ["Endereço", c.contratante_endereco || "—"],
    ["Telefone", c.contratante_telefone || "—"],
    ["Celular", c.contratante_celular || "—"],
    ["Email", c.contratante_email || "—"],
  ]);
  y += 6;

  // ── Dados do Paciente ─────────────────────────────────────────────────────
  sectionTitle("Dados do Paciente");
  kvRows([
    ["Nome", c.paciente_nome || "—"],
    ["Nascimento", dateISOtoBR(c.paciente_nascimento) || "—"],
    ["CPF", c.paciente_cpf || "—"],
    ["RG", c.paciente_rg || "—"],
    ["Profissão", c.paciente_profissao || "—"],
    ["Sexo", c.paciente_sexo || "—"],
    ["Endereço", c.paciente_endereco || "—"],
    ["Telefone", c.paciente_telefone || "—"],
    ["Celular", c.paciente_celular || "—"],
    ["Email", c.paciente_email || "—"],
  ]);
  y += 6;

  // ── Referências ───────────────────────────────────────────────────────────
  if (c.referencia_1_nome || c.referencia_2_nome) {
    sectionTitle("Referências Pessoais");
    kvRows([
      [
        "Referência 1",
        c.referencia_1_nome
          ? `${c.referencia_1_nome}${c.referencia_1_telefone ? ` — ${c.referencia_1_telefone}` : ""}`
          : "—",
      ],
      [
        "Referência 2",
        c.referencia_2_nome
          ? `${c.referencia_2_nome}${c.referencia_2_telefone ? ` — ${c.referencia_2_telefone}` : ""}`
          : "—",
      ],
    ]);
    y += 6;
  }

  // ── Procedimentos ─────────────────────────────────────────────────────────
  const procs = (c.procedimentos as Procedimento[]) ?? [];
  if (procs.length) {
    sectionTitle("Procedimentos Contratados");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Nº", "Tratamento", "Dentes/Arcadas", "Qtd", "Valor"]],
      body: procs.map((p, i) => [
        String(i + 1),
        p.tratamento || "—",
        p.dentes || "—",
        String(p.qtd ?? 0),
        formatBRL(p.valor),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [38, 99, 176] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  // ── Materiais extras ──────────────────────────────────────────────────────
  const mats = (c.materiais_extras as MaterialExtra[]) ?? [];
  if (mats.length) {
    sectionTitle("Procedimentos / Materiais Extras");
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Tipo", "Valor"]],
      body: mats.map((m) => [m.tipo || "—", formatBRL(m.valor)]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [38, 99, 176] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  // ── Forma de pagamento ────────────────────────────────────────────────────
  sectionTitle("Forma de Pagamento");
  const payRows: [string, string][] = [
    ["Valor ortodôntico", formatBRL(c.valor_ortodontico)],
    ["Valor não ortodôntico", formatBRL(c.valor_nao_ortodontico)],
    ["Valor total", formatBRL(c.valor_total)],
    ["Desconto", formatBRL(c.desconto)],
    ["Valor final", formatBRL(c.valor_final)],
  ];
  if (c.documentacao_ortodontica)
    payRows.push(["Documentação ortodôntica", formatBRL(c.documentacao_ortodontica)]);
  if (c.entrada_tipo || c.entrada_valor)
    payRows.push([
      "Entrada",
      `${c.entrada_tipo ? `${c.entrada_tipo} — ` : ""}${formatBRL(c.entrada_valor)}`,
    ]);
  if (c.sinal_valor) payRows.push(["Sinal", formatBRL(c.sinal_valor)]);
  if (c.parcelamento_qtd || c.parcelamento_tipo)
    payRows.push([
      "Parcelamento",
      `${c.parcelamento_tipo ? `${c.parcelamento_tipo} — ` : ""}${c.parcelamento_qtd ?? 0}x de ${formatBRL(c.parcelamento_valor)}`,
    ]);
  if (c.vencimento_dia) payRows.push(["Dia de vencimento", `Dia ${c.vencimento_dia}`]);
  if (c.venc_primeira_parcela)
    payRows.push(["1ª parcela em", dateISOtoBR(c.venc_primeira_parcela)]);
  kvRows(payRows);
  y += 10;

  // ── Condições gerais ──────────────────────────────────────────────────────
  sectionTitle("Condições Gerais do Contrato");
  paragraph(CONDICOES_GERAIS);

  // ── Termo específico ──────────────────────────────────────────────────────
  const termText = TREATMENT_TERM_TEXT[c.treatment_type as TreatmentType];
  if (termText) {
    sectionTitle("Termo Específico do Tratamento");
    paragraph(termText);
  }

  // ── Anexos selecionados ───────────────────────────────────────────────────
  const annexKeys = PAYMENT_ANNEX_OPTIONS.filter((a) => {
    if (a.column === "has_parcela_facil") return c.has_parcela_facil;
    if (a.column === "has_compra_programada") return c.has_compra_programada;
    return c.has_pagamento_recorrente;
  });
  if (annexKeys.length) {
    sectionTitle("Anexos de Pagamento");
    annexKeys.forEach((a) => paragraph(ANNEX_TEXT[a.column]));
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 130, 150);
  ensure(20);
  doc.text(
    "Os documentos oficiais completos (contrato geral, termos e anexos) integram este contrato.",
    MARGIN,
    y,
  );
  y += 24;

  // ── Assinaturas ───────────────────────────────────────────────────────────
  ensure(120);
  sectionTitle("Assinaturas");
  const colW = contentW / 2;
  const sigY = y;
  const drawSig = (x: number, title: string, img: string | null, date: string | null) => {
    if (img) {
      try {
        doc.addImage(img, "PNG", x, sigY, 180, 55);
      } catch {
        /* ignore */
      }
    }
    const lineY = sigY + 62;
    doc.setDrawColor(120, 130, 150);
    doc.line(x, lineY, x + 200, lineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(34, 40, 60);
    doc.text(title, x, lineY + 14);
    if (date) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 120, 140);
      doc.text(new Date(date).toLocaleString("pt-BR"), x, lineY + 26);
    }
  };
  drawSig(MARGIN, "OdontoClinic (Contratada)", c.clinic_signature, c.clinic_signed_at);
  drawSig(MARGIN + colW, "Paciente / Contratante", c.patient_signature, c.signed_at);

  return doc;
}
