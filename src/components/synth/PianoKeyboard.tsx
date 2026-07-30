import { useMemo } from "react";
import { PIANO_KEYS, type KeyDef } from "@/lib/synth/types";

type PianoKeyboardProps = {
  activeMidis: Set<number>;
  baseOctave: number;
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
};

function toMidi(octave: number, offset: number) {
  return 12 * (octave + 1) + offset;
}

export function PianoKeyboard({
  activeMidis,
  baseOctave,
  onNoteOn,
  onNoteOff,
}: PianoKeyboardProps) {
  const whites = useMemo(() => PIANO_KEYS.filter((k) => !k.isBlack), []);
  const blacks = useMemo(() => PIANO_KEYS.filter((k) => k.isBlack), []);

  const blackPositions = useMemo(() => {
    const whiteOffsets = whites.map((w) => w.midiOffset);
    return blacks.map((b) => {
      let leftIdx = 0;
      for (let i = 0; i < whiteOffsets.length; i++) {
        if (whiteOffsets[i]! < b.midiOffset) leftIdx = i;
      }
      return { key: b, leftIdx };
    });
  }, [whites, blacks]);

  return (
    <div className="relative w-full select-none">
      <div className="relative mx-auto flex h-36 w-full max-w-4xl touch-none sm:h-44">
        {whites.map((k) => {
          const midi = toMidi(baseOctave, k.midiOffset);
          const active = activeMidis.has(midi);
          return (
            <KeyButton
              key={`w-${k.midiOffset}`}
              def={k}
              midi={midi}
              active={active}
              isBlack={false}
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
            />
          );
        })}

        <div className="pointer-events-none absolute inset-0 flex">
          {whites.map((_, i) => (
            <div key={`slot-${i}`} className="relative h-full flex-1">
              {blackPositions
                .filter((bp) => bp.leftIdx === i)
                .map(({ key: k }) => {
                  const midi = toMidi(baseOctave, k.midiOffset);
                  const active = activeMidis.has(midi);
                  return (
                    <div
                      key={`b-${k.midiOffset}`}
                      className="pointer-events-auto absolute left-[58%] top-0 z-10 h-[58%] w-[70%]"
                    >
                      <KeyButton
                        def={k}
                        midi={midi}
                        active={active}
                        isBlack
                        onNoteOn={onNoteOn}
                        onNoteOff={onNoteOff}
                      />
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function safeCapture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* synthetic events / lost pointer */
  }
}

function KeyButton({
  def,
  midi,
  active,
  isBlack,
  onNoteOn,
  onNoteOff,
}: {
  def: KeyDef;
  midi: number;
  active: boolean;
  isBlack: boolean;
  onNoteOn: (m: number) => void;
  onNoteOff: (m: number) => void;
}) {
  const pointer = (down: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (down) {
      safeCapture(e.currentTarget as HTMLElement, e.pointerId);
      onNoteOn(midi);
    } else {
      onNoteOff(midi);
    }
  };

  if (isBlack) {
    return (
      <button
        type="button"
        aria-label={`${def.note}${def.key ? ` (${def.key})` : ""}`}
        className={[
          "relative h-full w-full rounded-b-md border border-border-bright transition-colors duration-75",
          active
            ? "bg-key-black-active key-glow-black"
            : "bg-key-black hover:bg-panel-raised",
        ].join(" ")}
        onPointerDown={pointer(true)}
        onPointerUp={pointer(false)}
        onPointerCancel={pointer(false)}
        onLostPointerCapture={() => onNoteOff(midi)}
      >
        {def.key && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] uppercase text-muted">
            {def.key}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${def.note}${def.key ? ` (${def.key})` : ""}`}
      className={[
        "relative h-full flex-1 border border-border first:rounded-l-lg last:rounded-r-lg transition-colors duration-75",
        active
          ? "bg-key-white-active key-glow-white text-bg"
          : "bg-key-white text-faint hover:bg-fg/90",
      ].join(" ")}
      onPointerDown={pointer(true)}
      onPointerUp={pointer(false)}
      onPointerCancel={pointer(false)}
      onLostPointerCapture={() => onNoteOff(midi)}
    >
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase">
        {def.note}
        {def.key && (
          <span className="mt-0.5 block text-[9px] opacity-60">{def.key}</span>
        )}
      </span>
    </button>
  );
}
