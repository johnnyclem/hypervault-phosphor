import { useEffect, useRef } from "react";
import type { VideoMode } from "@/lib/synth/types";

type VideoSynthProps = {
  analyser: AnalyserNode | null;
  mode: VideoMode;
  intensity: number;
  activeNotes: number;
};

/** VGA 16-color-ish palette (EGA/VGA classic) */
const VGA16 = [
  [0, 0, 0],
  [0, 0, 170],
  [0, 170, 0],
  [0, 170, 170],
  [170, 0, 0],
  [170, 0, 170],
  [170, 85, 0],
  [170, 170, 170],
  [85, 85, 85],
  [85, 85, 255],
  [85, 255, 85],
  [85, 255, 255],
  [255, 85, 85],
  [255, 85, 255],
  [255, 255, 85],
  [255, 255, 255],
] as const;

/** 8-bit-ish extended green/cyan phosphor set */
const BIT8 = [
  [0, 0, 0],
  [0, 40, 20],
  [0, 80, 40],
  [0, 140, 70],
  [20, 200, 90],
  [60, 255, 120],
  [0, 100, 160],
  [40, 220, 255],
  [255, 60, 120],
  [255, 180, 40],
  [255, 255, 255],
  [80, 40, 120],
  [200, 40, 200],
  [40, 40, 40],
  [120, 120, 120],
  [200, 200, 200],
] as const;

function nearestPalette(
  r: number,
  g: number,
  b: number,
  pal: readonly (readonly [number, number, number])[],
) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i]!;
    const d =
      (r - p[0]) * (r - p[0]) +
      (g - p[1]) * (g - p[1]) +
      (b - p[2]) * (b - p[2]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return pal[best]!;
}

function quantize5(v: number) {
  // 5-bit channel (16-bit RGB555 style)
  return Math.round(v / 8) * 8;
}

export function VideoSynth({
  analyser,
  mode,
  intensity,
  activeNotes,
}: VideoSynthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const tRef = useRef(0);
  const freqRef = useRef(new Uint8Array(128));
  const waveRef = useRef(new Uint8Array(256));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Internal low-res buffer for authentic pixel look
    const W = 160;
    const H = 100;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const px = img.data;

    // Scratch for glitch slice offsets
    const slices = new Int16Array(H);

    const draw = (now: number) => {
      tRef.current = now * 0.001;
      const t = tRef.current;
      const I = intensity;

      let bass = 0;
      let mid = 0;
      let treble = 0;
      let energy = 0;

      if (analyser) {
        analyser.getByteFrequencyData(freqRef.current);
        analyser.getByteTimeDomainData(waveRef.current);
        const f = freqRef.current;
        const third = Math.floor(f.length / 3);
        for (let i = 0; i < f.length; i++) {
          const v = f[i]! / 255;
          energy += v;
          if (i < third) bass += v;
          else if (i < third * 2) mid += v;
          else treble += v;
        }
        bass /= third || 1;
        mid /= third || 1;
        treble /= third || 1;
        energy /= f.length;
      }

      // Glitch slice table
      for (let y = 0; y < H; y++) {
        slices[y] = 0;
        if (mode === "glitch" || mode === "combo") {
          const g =
            Math.sin(y * 0.35 + t * 8 + bass * 12) *
            bass *
            18 *
            I *
            (activeNotes > 0 ? 1 : 0.15);
          slices[y] = Math.round(g + (Math.random() < bass * 0.08 * I ? (Math.random() - 0.5) * 30 : 0));
        }
      }

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const sx = (x + (slices[y] ?? 0) + W * 4) % W;
          const i = (y * W + x) * 4;

          // Plasma / interference field driven by audio
          const nx = sx / W;
          const ny = y / H;
          const wave =
            analyser && waveRef.current.length
              ? (waveRef.current[Math.floor(nx * waveRef.current.length)]! - 128) /
                128
              : 0;

          let v =
            Math.sin(nx * 12 + t * 1.4 + bass * 6) *
              Math.cos(ny * 10 - t * 0.9 + mid * 4) +
            Math.sin((nx + ny) * 8 + t * 2 + treble * 5) * 0.5 +
            wave * 1.2 * I +
            Math.sin(nx * 40 + energy * 20) * bass * 0.6;

          // Vertical bars (VGA demo vibe)
          v += Math.sin(sx * 0.4 + t * 3) * mid * 0.5;

          // Note count pulses
          v += Math.sin(t * 6 + activeNotes) * activeNotes * 0.04;

          // Map to RGB base (phosphor triad)
          let r = 0;
          let g = 0;
          let b = 0;

          const n = (v + 2) / 4; // ~0..1
          const pulse = Math.max(0, n);

          if (mode === "vga" || mode === "combo") {
            r = pulse * 40 + bass * 220 * I;
            g = pulse * 180 + mid * 120 * I + 20;
            b = pulse * 60 + treble * 255 * I;
          }
          if (mode === "bit8") {
            r = pulse * 30;
            g = 40 + pulse * 215 + bass * 80;
            b = pulse * 80 + mid * 100;
          }
          if (mode === "bit16") {
            r = 20 + pulse * 100 + treble * 80;
            g = 30 + pulse * 160 + mid * 60;
            b = 50 + pulse * 200 + bass * 40;
          }
          if (mode === "glitch") {
            r = 80 + pulse * 175 + bass * 100;
            g = pulse * 60;
            b = 100 + pulse * 120 + treble * 80;
            // RGB shift
            if (x + 2 < W && Math.random() < bass * 0.3 * I) {
              /* applied after via palette */
            }
          }
          if (mode === "combo") {
            // Blend glitch magenta flecks
            if ((x + y + Math.floor(t * 20)) % 17 === 0 && bass > 0.2) {
              r = 255;
              b = 200;
            }
          }

          // Scanline darken
          if (y % 2 === 0) {
            r *= 0.75;
            g *= 0.78;
            b *= 0.75;
          }

          // Soft vignette
          const dx = nx - 0.5;
          const dy = ny - 0.5;
          const vig = 1 - (dx * dx + dy * dy) * 1.6;
          r *= vig;
          g *= vig;
          b *= vig;

          r = Math.max(0, Math.min(255, r));
          g = Math.max(0, Math.min(255, g));
          b = Math.max(0, Math.min(255, b));

          // Quantize by mode
          if (mode === "vga" || mode === "combo") {
            const p = nearestPalette(r, g, b, VGA16);
            r = p[0];
            g = p[1];
            b = p[2];
          } else if (mode === "bit8") {
            const p = nearestPalette(r, g, b, BIT8);
            r = p[0];
            g = p[1];
            b = p[2];
          } else if (mode === "bit16") {
            r = quantize5(r);
            g = quantize5(g);
            b = quantize5(b);
          } else if (mode === "glitch") {
            // Harsh posterize
            r = Math.round(r / 32) * 32;
            g = Math.round(g / 32) * 32;
            b = Math.round(b / 32) * 32;
          }

          px[i] = r;
          px[i + 1] = g;
          px[i + 2] = b;
          px[i + 3] = 255;
        }
      }

      // Occasional full-row glitch copy
      if ((mode === "glitch" || mode === "combo") && bass > 0.35 * (1.2 - I * 0.2)) {
        const row = Math.floor(Math.random() * H);
        const srcRow = Math.floor(Math.random() * H);
        for (let x = 0; x < W; x++) {
          const di = (row * W + x) * 4;
          const si = (srcRow * W + x) * 4;
          px[di] = px[si]!;
          px[di + 1] = px[si + 1]!;
          px[di + 2] = px[si + 2]!;
        }
      }

      ctx.putImageData(img, 0, 0);
      raf.current = requestAnimationFrame(draw);
    };

    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [analyser, mode, intensity, activeNotes]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-bg shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]">
      <canvas
        ref={canvasRef}
        className="pixel-scale aspect-[16/10] w-full"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="crt-overlay absolute inset-0" />
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-bg/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
        VID · {mode}
      </div>
    </div>
  );
}
