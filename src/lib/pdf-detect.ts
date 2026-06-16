// Detecção automática de campos de assinatura e de data/local em qualquer PDF.
//
// Usa pdf.js para extrair o texto de cada página (com posição) e classifica os
// rótulos de assinatura por proximidade. Funciona genericamente para qualquer
// layout — não é hardcoded para um PDF específico. A classificação é CIENTE DO
// TIPO porque "Contratante" tem papéis diferentes em contratos x termos:
//   - Contrato: clínica = {Contratada, Contratante}; paciente = {Paciente e/ou
//     seu representante legal}.
//   - Termo:    clínica = {Contratada, Assinatura Clínica/Profissional};
//     paciente = {Contratante/Resp Legal, Assinatura Paciente}.

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { AutoTextField, AutoTextKind, DocKind, SignaturePos } from "./signed-docs";

export type DetectResult = {
  clinic: SignaturePos[];
  patient: SignaturePos[];
  texts: AutoTextField[];
};

// Normaliza: minúsculas, sem acentos, pontuação → espaço, espaços colapsados.
// Assim "e/ou" → "e ou", "CONTRATANTE/RESP. LEGAL" → "contratante resp legal".
// Faixa Unicode de marcas de acento combinantes (U+0300–U+036F).
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Line = {
  raw: string;
  norm: string;
  xL: number;
  xR: number;
  baseline: number; // y em pontos PDF (origem inferior-esquerda)
  height: number;
  W: number;
  H: number;
  page: number;
};

// Rótulos por tipo de documento (já normalizados pelo formato do `norm`).
function labelsFor(kind: DocKind): { clinic: string[]; patient: string[] } {
  if (kind === "contract") {
    return {
      clinic: [
        "contratada",
        "contratante",
        "assinatura clinica profissional",
        "assinatura clinica",
      ],
      patient: [
        "paciente e ou seu representante legal",
        "representante legal",
        "assinatura paciente",
      ],
    };
  }
  return {
    clinic: ["contratada", "assinatura clinica profissional", "assinatura clinica"],
    patient: [
      "contratante resp legal",
      "assinatura paciente",
      "paciente e ou seu representante legal",
      "contratante",
    ],
  };
}

// Uma linha é um RÓTULO (e não texto de corpo) quando é curta e o rótulo domina.
function isLabelLine(lineNorm: string, label: string): boolean {
  if (!lineNorm.includes(label)) return false;
  return lineNorm.length <= 55 && label.length / lineNorm.length >= 0.45;
}

// Caixa de assinatura ACIMA do rótulo (no padrão da franquia o rótulo é impresso
// abaixo da linha de assinatura).
function sigBox(ln: Line): SignaturePos {
  const labelTop = (ln.H - (ln.baseline + ln.height)) / ln.H;
  const left = ln.xL / ln.W;
  const right = ln.xR / ln.W;
  const wLab = Math.max(right - left, 0.12);
  const w = Math.min(Math.max(wLab * 1.15, 0.17), 0.34);
  const h = 0.06;
  const cx = (left + right) / 2;
  const x = Math.min(Math.max(cx - w / 2, 0.02), 0.98 - w);
  const y = Math.min(Math.max(labelTop - h - 0.012, 0.02), 0.95);
  return { page: ln.page, x, y, w, h };
}

// Caixa de texto à DIREITA do rótulo (ex.: "Local e data: ____").
function textBoxRightOf(ln: Line, kind: AutoTextKind, label: string): AutoTextField {
  const top = (ln.H - (ln.baseline + ln.height)) / ln.H;
  const x = Math.min(ln.xR / ln.W + 0.01, 0.9);
  const w = Math.min(0.96 - x, 0.5);
  const h = Math.min(Math.max((ln.height / ln.H) * 1.5, 0.018), 0.05);
  return { page: ln.page, x, y: Math.max(top, 0.02), w, h, kind, label };
}

// Caixa de texto SOBRE a linha (ex.: padrão "__ de ____ de __").
function textBoxOnLine(ln: Line, kind: AutoTextKind, label: string): AutoTextField {
  const top = (ln.H - (ln.baseline + ln.height)) / ln.H;
  const x = ln.xL / ln.W;
  const w = Math.min((ln.xR - ln.xL) / ln.W, 0.6);
  const h = Math.min(Math.max((ln.height / ln.H) * 1.5, 0.018), 0.05);
  return { page: ln.page, x, y: Math.max(top, 0.02), w, h, kind, label };
}

// Limpa o rótulo bruto para exibição (remove ":" e lacunas).
function cleanLabel(raw: string): string {
  return raw
    .replace(/[_:.]+\s*$/g, "")
    .replace(/\s*:\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const dedupe = <T extends SignaturePos>(arr: T[]): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of arr) {
    const k = `${p.page}:${p.x.toFixed(2)}:${p.y.toFixed(2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
};

/** Extrai linhas de texto (agrupadas por baseline) de todas as páginas. */
async function extractLines(data: ArrayBuffer): Promise<Line[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data }).promise;
  const lines: Line[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const W = vp.width;
    const H = vp.height;
    const tc = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (tc.items as any[])
      .filter((it) => it && typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str as string,
        x: it.transform[4] as number,
        y: it.transform[5] as number,
        w: (it.width as number) || 0,
        h: (it.height as number) || Math.hypot(it.transform[2], it.transform[3]) || 10,
      }));

    const used = new Array(items.length).fill(false);
    const order = items
      .map((_, i) => i)
      .sort((a, b) => items[b].y - items[a].y || items[a].x - items[b].x);

    for (const i of order) {
      if (used[i]) continue;
      const base = items[i];
      const grp = [base];
      used[i] = true;
      for (const j of order) {
        if (used[j]) continue;
        if (Math.abs(items[j].y - base.y) <= Math.max(2, base.h * 0.6)) {
          grp.push(items[j]);
          used[j] = true;
        }
      }
      grp.sort((a, b) => a.x - b.x);
      const xL = Math.min(...grp.map((g) => g.x));
      const xR = Math.max(...grp.map((g) => g.x + g.w));
      const height = Math.max(...grp.map((g) => g.h));
      const raw = grp.map((g) => g.str).join(" ");
      lines.push({ raw, norm: norm(raw), xL, xR, baseline: base.y, height, W, H, page: p });
    }
  }
  return lines;
}

/**
 * Detecta os campos de assinatura (clínica/paciente) e de texto (data/local).
 * `input` pode ser os bytes do PDF ou uma URL.
 */
export async function detectSignatureFields(
  input: ArrayBuffer | string,
  kind: DocKind,
): Promise<DetectResult> {
  const data =
    typeof input === "string"
      ? await (await fetch(input, { cache: "no-store" })).arrayBuffer()
      : input;

  let lines: Line[] = [];
  try {
    lines = await extractLines(data);
  } catch (e) {
    console.error("[pdf-detect] falha ao extrair texto", e);
    return { clinic: [], patient: [], texts: [] };
  }

  const labels = labelsFor(kind);
  const clinic: SignaturePos[] = [];
  const patient: SignaturePos[] = [];
  const texts: AutoTextField[] = [];
  const sigLineIdx = new Set<number>();

  // ── Passo 1: rótulos de ASSINATURA (somente faixa inferior das páginas).
  lines.forEach((ln, idx) => {
    const topRatio = (ln.H - ln.baseline) / ln.H; // 0 = topo, 1 = base
    if (topRatio < 0.45) return;
    const isPatient = labels.patient.some((l) => isLabelLine(ln.norm, l));
    const isClinic = labels.clinic.some((l) => isLabelLine(ln.norm, l));
    const isWitness = isLabelLine(ln.norm, "testemunha"); // opcional → ignorado
    if (isWitness) {
      sigLineIdx.add(idx);
      return;
    }
    if (isPatient && !isClinic) {
      patient.push(sigBox(ln));
      sigLineIdx.add(idx);
    } else if (isClinic && !isPatient) {
      clinic.push(sigBox(ln));
      sigLineIdx.add(idx);
    }
  });

  // Páginas que contêm o bloco de assinaturas. Os campos de texto são detectados
  // SOMENTE aqui, evitando que "data"/"local" do corpo (ex.: "data de
  // nascimento", numa página intermediária) seja transformado em campo de data.
  const sigPages = new Set<number>([...clinic, ...patient].map((f) => f.page));

  // ── Passo 2: campos de TEXTO (data/local/CPF/...) no bloco de assinaturas.
  lines.forEach((ln, idx) => {
    if (sigLineIdx.has(idx)) return; // já é rótulo de assinatura
    if (!sigPages.has(ln.page)) return; // fora da(s) página(s) de assinatura
    const topRatio = (ln.H - ln.baseline) / ln.H;
    if (topRatio < 0.5) return; // só a faixa inferior (bloco de assinaturas)
    if (ln.norm.length > 60) return; // evita parágrafos do corpo
    // Exclusões: linhas de corpo que contêm "data"/"local".
    if (
      /nascimento|pagamento|vencimento|emissao|validade|vigencia|inicio|termino|reajuste/.test(
        ln.norm,
      )
    )
      return;

    if (/\blocal e data\b/.test(ln.norm)) {
      texts.push(textBoxRightOf(ln, "local_date", "Local e data"));
      return;
    }
    // Padrão de data com lacunas: "__ de ____ de __" ou "__/__/__".
    if (
      (/_{2,}/.test(ln.norm) && /\bde\b/.test(ln.norm)) ||
      /_{2,}\s*\/\s*_{2,}\s*\/\s*_{2,}/.test(ln.norm)
    ) {
      texts.push(textBoxOnLine(ln, "date", "Data"));
      return;
    }
    const idm = ln.norm.match(/\b(cpf|cnpj|rg)\b/);
    if (idm) {
      texts.push(textBoxRightOf(ln, "other", idm[1].toUpperCase()));
      return;
    }
    if (/^local\b/.test(ln.norm)) {
      texts.push(textBoxRightOf(ln, "local", "Local"));
      return;
    }
    if (/^data\b/.test(ln.norm)) {
      texts.push(textBoxRightOf(ln, "date", "Data"));
      return;
    }
    // Genérico: "<rótulo>: ____" curto com lacuna (ex.: "Profissão: ___").
    const gen = ln.raw.match(/^\s*([A-Za-zÀ-ú][A-Za-zÀ-ú ./]{1,18}?)\s*:\s*_{2,}/);
    if (gen) {
      texts.push(textBoxRightOf(ln, "other", cleanLabel(gen[1])));
      return;
    }
  });

  // Limita para evitar explosão por falsos positivos.
  return {
    clinic: dedupe(clinic).slice(0, 6),
    patient: dedupe(patient).slice(0, 6),
    texts: dedupe(texts).slice(0, 8),
  };
}
