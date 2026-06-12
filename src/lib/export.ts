// Exportação de dados para PDF (jsPDF + autotable) e Excel (SheetJS).
// Usado pelas listagens (pacientes, consultas, logs) e dashboards.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ExportColumn<T> = {
  header: string;
  /** chave do objeto ou função de extração */
  value: keyof T | ((row: T) => string | number | null | undefined);
};

function cellValue<T>(row: T, col: ExportColumn<T>): string {
  const raw = typeof col.value === "function" ? col.value(row) : row[col.value];
  if (raw == null) return "";
  return String(raw);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Exporta uma listagem tabular para PDF (paisagem para muitas colunas). */
export function exportTablePdf<T>(opts: {
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  fileName: string;
}) {
  const landscape = opts.columns.length > 6;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait" });

  doc.setFontSize(16);
  doc.text(opts.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  const sub = [opts.subtitle, `Gerado em ${new Date().toLocaleString("pt-BR")}`]
    .filter(Boolean)
    .join(" — ");
  doc.text(sub, 14, 23);

  autoTable(doc, {
    startY: 28,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => cellValue(r, c))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${opts.fileName}-${stamp()}.pdf`);
}

/** Exporta uma listagem tabular para Excel (.xlsx). */
export function exportTableExcel<T>(opts: {
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  fileName: string;
}) {
  const data = opts.rows.map((r) =>
    Object.fromEntries(opts.columns.map((c) => [c.header, cellValue(r, c)])),
  );
  const ws = XLSX.utils.json_to_sheet(data);
  // largura automática aproximada por coluna
  ws["!cols"] = opts.columns.map((c, i) => ({
    wch: Math.min(
      50,
      Math.max(c.header.length, ...data.map((row) => String(row[c.header] ?? "").length), 8),
    ),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (opts.sheetName ?? "Dados").slice(0, 31));
  XLSX.writeFile(wb, `${opts.fileName}-${stamp()}.xlsx`);
}

/** Exporta um resumo de dashboard (cards + tabelas) para PDF. */
export function exportDashboardPdf(opts: {
  title: string;
  period?: string;
  cards: [string, string][];
  tables?: { title: string; head: string[]; body: string[][] }[];
  fileName: string;
}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(opts.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    [
      opts.period ? `Período: ${opts.period}` : null,
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    ]
      .filter(Boolean)
      .join(" — "),
    14,
    23,
  );

  autoTable(doc, {
    startY: 28,
    head: [["Indicador", "Valor"]],
    body: opts.cards,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  for (const table of opts.tables ?? []) {
    const lastY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 28;
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(table.title, 14, lastY + 10);
    autoTable(doc, {
      startY: lastY + 13,
      head: [table.head],
      body: table.body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
    });
  }

  doc.save(`${opts.fileName}-${stamp()}.pdf`);
}
