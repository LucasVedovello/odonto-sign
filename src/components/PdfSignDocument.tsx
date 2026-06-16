import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { SignaturePos } from "@/lib/signed-docs";
// Worker do pdf.js — `?url` devolve apenas a URL do asset (seguro para SSR).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type SigOverlay = {
  pos: SignaturePos; // razões (0..1) relativas à página
  imageUrl?: string | null; // PNG da assinatura, se já assinada
  label?: string; // texto do placeholder quando ainda não assinada
  variant?: "clinic" | "patient";
};

type RenderedPage = { page: number; src: string };

const VARIANT_CLS: Record<NonNullable<SigOverlay["variant"]>, string> = {
  clinic: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  patient: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

/**
 * Renderiza cada página de um PDF como imagem (pdf.js → canvas → dataURL) e
 * empilha verticalmente — exatamente como na leitura do prontuário. Sobre cada
 * página, desenha os campos de assinatura (`overlays`) em coordenadas
 * proporcionais. Se `onPlace` for fornecido, clicar numa página devolve a
 * posição (centralizada no clique) para posicionar o campo ativo.
 */
export function PdfSignDocument({
  url,
  overlays = [],
  onPlace,
  placing,
  boxSize = { w: 0.3, h: 0.09 },
}: {
  url: string;
  overlays?: SigOverlay[];
  onPlace?: (page: number, x: number, y: number) => void;
  placing?: boolean; // habilita o cursor/ação de posicionar
  boxSize?: { w: number; h: number };
}) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setStatus("loading");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        const targetWidth = 1000;

        const buf = await (await fetch(url, { cache: "no-store" })).arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const b = page.getViewport({ scale: 1 });
          const scale = Math.min(Math.max(targetWidth / b.width, 1), 3) * dpr;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          const src = canvas.toDataURL("image/png");
          canvas.width = 0;
          canvas.height = 0;
          if (cancelled) return;
          setPages((prev) => [...prev, { page: p, src }]);
        }
        if (!cancelled) setStatus("done");
      } catch (e) {
        console.error("[PdfSignDocument] falha ao renderizar PDF", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleClick = (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPlace || !placing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // Centraliza o campo no clique e mantém dentro dos limites da página.
    const x = Math.min(Math.max(px - boxSize.w / 2, 0), 1 - boxSize.w);
    const y = Math.min(Math.max(py - boxSize.h / 2, 0), 1 - boxSize.h);
    onPlace(pageNum, x, y);
  };

  return (
    <div className="space-y-4">
      {pages.map((pg) => (
        <div
          key={pg.page}
          className={`relative w-full ${placing ? "cursor-crosshair" : ""}`}
          onClick={(e) => handleClick(pg.page, e)}
        >
          <img
            src={pg.src}
            alt={`Página ${pg.page}`}
            className="w-full rounded-lg border border-border shadow-sm select-none"
            draggable={false}
          />
          {overlays
            .filter((o) => o.pos.page === pg.page)
            .map((o, i) => (
              <div
                key={i}
                className={`absolute flex items-center justify-center overflow-hidden rounded-md border-2 ${
                  o.imageUrl
                    ? "border-transparent"
                    : `border-dashed ${VARIANT_CLS[o.variant ?? "clinic"]}`
                }`}
                style={{
                  left: `${o.pos.x * 100}%`,
                  top: `${o.pos.y * 100}%`,
                  width: `${o.pos.w * 100}%`,
                  height: `${o.pos.h * 100}%`,
                }}
              >
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt="assinatura" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-1 text-center text-[10px] font-semibold uppercase leading-tight sm:text-xs">
                    {o.label}
                  </span>
                )}
              </div>
            ))}
        </div>
      ))}

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando documento...
        </div>
      )}
      {status === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar o documento. Tente recarregar a página.
        </div>
      )}
    </div>
  );
}
