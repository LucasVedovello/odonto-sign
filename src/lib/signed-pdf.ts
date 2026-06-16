// Geração do PDF final assinado.
//
// REGRA CRÍTICA: o PDF final deve ser VISUALMENTE IDÊNTICO ao PDF original
// enviado pela clínica. A única alteração são as assinaturas sobrepostas nos
// campos corretos. A técnica é a MESMA do prontuário:
//   1. renderiza cada página do PDF original como imagem (pdf.js → canvas);
//   2. desenha essa imagem como FUNDO de uma página de mesmo tamanho (jsPDF);
//   3. sobrepõe as assinaturas (PNG transparente) nas coordenadas dos campos.
//
// As coordenadas das assinaturas são razões (0..1) relativas à página — assim
// independem da resolução de renderização (ver SignaturePos em signed-docs.ts).

import type { SignaturePos } from "./signed-docs";
// Worker do pdf.js — `?url` devolve apenas a URL do asset (seguro para SSR).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type RenderedPage = {
  dataUrl: string; // imagem PNG da página renderizada
  width: number; // largura da página em pontos PDF (viewport scale 1)
  height: number; // altura da página em pontos PDF
};

export type PlacedSignature = {
  dataUrl: string; // PNG (transparente) da assinatura
  pos: SignaturePos;
};

export type PlacedText = {
  text: string; // texto a gravar (data/local)
  pos: SignaturePos;
};

// Busca o binário do PDF, com 1 nova tentativa (evita falha por rede instável).
async function fetchPdfBytes(url: string, attempt = 0): Promise<ArrayBuffer> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  } catch (e) {
    if (attempt < 1) return fetchPdfBytes(url, attempt + 1);
    throw e;
  }
}

/**
 * Renderiza todas as páginas de um PDF como imagens PNG, preservando as
 * dimensões originais (em pontos) para reconstruir um PDF de tamanho idêntico.
 */
export async function renderPdfToImages(url: string): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await fetchPdfBytes(url);

  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const targetWidth = 1400; // alta resolução para nitidez do documento final

  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: RenderedPage[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 }); // dimensões em pontos PDF
    const scale = Math.min(Math.max(targetWidth / base.width, 1.5), 3) * dpr;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    canvas.width = 0;
    canvas.height = 0;
    pages.push({ dataUrl, width: base.width, height: base.height });
  }
  return pages;
}

/**
 * Monta o PDF final: cada página original como fundo + assinaturas sobrepostas.
 * Devolve a instância jsPDF (use .output('blob') para salvar/baixar).
 */
export async function generateSignedPdf(
  originalUrl: string,
  signatures: PlacedSignature[],
  texts: PlacedText[] = [],
): Promise<import("jspdf").jsPDF> {
  const { jsPDF } = await import("jspdf");
  const pages = await renderPdfToImages(originalUrl);
  if (pages.length === 0) throw new Error("PDF original sem páginas renderizáveis");

  const orient = (w: number, h: number) => (h >= w ? "p" : "l");

  const first = pages[0];
  const doc = new jsPDF({
    unit: "pt",
    format: [first.width, first.height],
    orientation: orient(first.width, first.height),
  });

  // Grava um texto (data/local) ajustando a fonte para caber na caixa.
  const drawText = (t: PlacedText, W: number, H: number) => {
    const value = (t.text ?? "").trim();
    if (!value) return;
    const boxX = t.pos.x * W;
    const boxY = t.pos.y * H;
    const boxW = t.pos.w * W;
    const boxH = t.pos.h * H;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    let size = Math.min(Math.max(boxH * 0.85, 6), 13);
    doc.setFontSize(size);
    while (doc.getTextWidth(value) > boxW && size > 6) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    // baseline próximo da base da caixa
    doc.text(value, boxX, boxY + boxH * 0.78);
  };

  pages.forEach((pg, i) => {
    if (i > 0) {
      doc.addPage([pg.width, pg.height], orient(pg.width, pg.height));
    }
    // Fundo: página original em escala 1:1 (idêntica ao original).
    try {
      doc.addImage(pg.dataUrl, "JPEG", 0, 0, pg.width, pg.height);
    } catch {
      /* se a imagem falhar, mantém a página em branco do mesmo tamanho */
    }
    // Textos automáticos (data/local) desta página.
    texts.filter((t) => t.pos.page === i + 1).forEach((t) => drawText(t, pg.width, pg.height));
    // Assinaturas desta página (sem fundo branco — overlay transparente).
    signatures
      .filter((s) => s.pos.page === i + 1)
      .forEach((s) => {
        const x = s.pos.x * pg.width;
        const y = s.pos.y * pg.height;
        const w = s.pos.w * pg.width;
        const h = s.pos.h * pg.height;
        try {
          doc.addImage(s.dataUrl, "PNG", x, y, w, h);
        } catch {
          /* ignora assinatura que falhe ao desenhar */
        }
      });
  });

  return doc;
}

/** Gera o PDF final e devolve como Blob (para upload no Storage). */
export async function generateSignedPdfBlob(
  originalUrl: string,
  signatures: PlacedSignature[],
  texts: PlacedText[] = [],
): Promise<Blob> {
  const doc = await generateSignedPdf(originalUrl, signatures, texts);
  return doc.output("blob");
}
