import { useEffect, useRef } from "react";

type ScopeProps = {
  analyser: AnalyserNode | null;
  level: number;
};

export function Scope({ analyser, level }: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0a0f0c";
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "#1a2a20";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = "#2a4034";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (analyser) {
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);
        ctx.strokeStyle = "#3dff9a";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#3dff9a";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const slice = w / data.length;
        for (let i = 0; i < data.length; i++) {
          const v = data[i]! / 128;
          const y = (v * h) / 2;
          const x = i * slice;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [analyser]);

  const pct = Math.round(level * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-border bg-bg">
        <canvas
          ref={canvasRef}
          width={320}
          height={80}
          className="h-16 w-full sm:h-20"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          Level
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-faint/40">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-75"
            style={{
              width: `${pct}%`,
              boxShadow: pct > 5 ? "0 0 8px var(--color-primary-glow)" : "none",
              background:
                pct > 85
                  ? "var(--color-danger)"
                  : pct > 60
                    ? "var(--color-accent)"
                    : "var(--color-primary)",
            }}
          />
        </div>
        <span className="w-8 text-right font-mono text-[10px] tabular-nums text-muted">
          {pct}
        </span>
      </div>
    </div>
  );
}
