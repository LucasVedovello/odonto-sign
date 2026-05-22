import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const lastRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(ratio, ratio);
          ctx.lineWidth = 2.2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#1f2a44";
        }
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    const getPos = (e: PointerEvent | React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
    };

    const onDown = (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = getPos(e);
    };
    const onMove = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current!.getContext("2d")!;
      const p = getPos(e);
      const last = lastRef.current!;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      emptyRef.current = false;
    };
    const onUp = () => { drawingRef.current = false; lastRef.current = null; };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        emptyRef.current = true;
      },
      isEmpty: () => emptyRef.current,
      toDataURL: () => canvasRef.current!.toDataURL("image/png"),
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className={className}
        style={{ touchAction: "none" }}
      />
    );
  }
);
