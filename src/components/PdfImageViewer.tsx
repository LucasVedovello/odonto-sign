import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
// Worker do pdf.js — `?url` devolve apenas a URL do asset (seguro para SSR).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type PdfDoc = { title: string; url: string };
type RenderedPage = { docIndex: number; title: string; page: number; src: string };

/**
 * Renderiza cada página de cada PDF como imagem (canvas -> dataURL) e empilha
 * verticalmente, simulando a leitura de um documento físico.
 * Não usa iframe/embed/object — exclusivamente pdfjs-dist.
 */
export function PdfImageViewer({ docs }: { docs: PdfDoc[] }) {
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
        const targetWidth = 1000; // largura de renderização (nitidez); exibido responsivo

        for (let d = 0; d < docs.length; d++) {
          const doc = docs[d];
          const pdf = await pdfjs.getDocument({ url: doc.url }).promise;
          for (let p = 1; p <= pdf.numPages; p++) {
            if (cancelled) return;
            const page = await pdf.getPage(p);
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(Math.max(targetWidth / base.width, 1), 3) * dpr;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
            const src = canvas.toDataURL("image/png");
            // libera memória do canvas
            canvas.width = 0;
            canvas.height = 0;
            if (cancelled) return;
            setPages((prev) => [...prev, { docIndex: d, title: doc.title, page: p, src }]);
          }
        }
        if (!cancelled) setStatus("done");
      } catch (e) {
        console.error("[PdfImageViewer] falha ao renderizar PDF", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.map((d) => d.url).join("|")]);

  return (
    <div className="space-y-6">
      {pages.map((pg, i) => {
        const first = i === 0 || pages[i - 1].docIndex !== pg.docIndex;
        return (
          <div key={`${pg.docIndex}-${pg.page}`}>
            {first && (
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
                {pg.title}
              </p>
            )}
            <img
              src={pg.src}
              alt={`${pg.title} — página ${pg.page}`}
              className="w-full rounded-lg border border-border shadow-sm"
            />
          </div>
        );
      })}

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos...
        </div>
      )}
      {status === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar os documentos. Tente recarregar a página.
        </div>
      )}
    </div>
  );
}
