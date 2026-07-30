import { useCallback, useId, useRef } from "react";

type KnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function safeCapture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* ignore */
  }
}

export function Knob({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = "",
  onChange,
  format,
}: KnobProps) {
  const id = useId();
  const drag = useRef<{ y: number; v: number } | null>(null);
  const pct = ((value - min) / (max - min)) * 100;
  const display = format
    ? format(value)
    : Number.isInteger(step)
      ? String(Math.round(value))
      : value.toFixed(step < 0.01 ? 3 : 2);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      safeCapture(e.target as HTMLElement, e.pointerId);
      drag.current = { y: e.clientY, v: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      const dy = drag.current.y - e.clientY;
      const range = max - min;
      const sensitivity = e.shiftKey ? 0.15 : 1;
      let next = drag.current.v + (dy / 120) * range * sensitivity;
      next = Math.min(max, Math.max(min, next));
      if (step >= 1) next = Math.round(next / step) * step;
      else next = Math.round(next / step) * step;
      onChange(next);
    },
    [max, min, onChange, step],
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        id={id}
        className="knob-ring relative size-12 rounded-full p-[3px] touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{ ["--knob-pct" as string]: `${pct * 0.75}%` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          const delta = e.shiftKey ? step * 10 : step;
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            onChange(Math.min(max, value + delta));
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            onChange(Math.max(min, value - delta));
          }
        }}
      >
        <div className="flex size-full items-center justify-center rounded-full bg-panel-raised shadow-inner">
          <div
            className="absolute inset-[5px] rounded-full border border-border"
            style={{
              transform: `rotate(${-135 + (pct / 100) * 270}deg)`,
            }}
          >
            <div className="absolute left-1/2 top-0.5 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
          </div>
        </div>
      </div>
      <label
        htmlFor={id}
        className="text-[10px] font-medium uppercase tracking-wider text-muted"
      >
        {label}
      </label>
      <span className="font-mono text-[10px] tabular-nums text-primary">
        {display}
        {unit}
      </span>
    </div>
  );
}
