import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Disc,
  Keyboard,
  Mic,
  MicOff,
  Power,
  Trash2,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { SynthEngine, type MidiStatus, type SampleStatus } from "@/lib/synth/engine";
import {
  DEFAULT_PARAMS,
  KEYBOARD_MAP,
  type SynthParams,
  type VideoMode,
  type Waveform,
} from "@/lib/synth/types";
import { Knob } from "./Knob";
import { PianoKeyboard } from "./PianoKeyboard";
import { Scope } from "./Scope";
import { VideoSynth } from "./VideoSynth";

const WAVEFORMS: Waveform[] = ["sawtooth", "square", "triangle", "sine", "noise"];
const VIDEO_MODES: { id: VideoMode; label: string }[] = [
  { id: "combo", label: "COMBO" },
  { id: "vga", label: "VGA" },
  { id: "glitch", label: "GLITCH" },
  { id: "bit8", label: "8-BIT" },
  { id: "bit16", label: "16-BIT" },
];

export function SynthApp() {
  const engineRef = useRef<SynthEngine | null>(null);
  const octaveRef = useRef(DEFAULT_PARAMS.octave);
  const keyMidiRef = useRef(new Map<string, number>());
  const [ready, setReady] = useState(false);
  const [params, setParams] = useState<SynthParams>({ ...DEFAULT_PARAMS });
  const [activeMidis, setActiveMidis] = useState<number[]>([]);
  const [level, setLevel] = useState(0);
  const [midi, setMidi] = useState<MidiStatus>({
    supported: false,
    connected: false,
    inputs: [],
  });
  const [sample, setSample] = useState<SampleStatus>({
    hasSample: false,
    duration: 0,
    recording: false,
    sampleRate: 1,
  });
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    const eng = new SynthEngine();
    engineRef.current = eng;
    eng.setListeners({
      onActiveNotes: setActiveMidis,
      onLevel: setLevel,
      onMidi: setMidi,
      onSample: setSample,
    });
    return () => eng.dispose();
  }, []);

  useEffect(() => {
    octaveRef.current = params.octave;
  }, [params.octave]);

  const activeSet = useMemo(() => new Set(activeMidis), [activeMidis]);

  const updateParam = useCallback(
    <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
      setParams((p) => ({ ...p, [key]: value }));
      engineRef.current?.setParam(key, value);
    },
    [],
  );

  const boot = useCallback(async () => {
    try {
      setBootError(null);
      const eng = engineRef.current;
      if (!eng) return;
      await eng.start();
      for (const [k, v] of Object.entries(params) as [
        keyof SynthParams,
        SynthParams[keyof SynthParams],
      ][]) {
        eng.setParam(k, v);
      }
      setAnalyser(eng.getAnalyser());
      setReady(true);
    } catch (e) {
      setBootError(e instanceof Error ? e.message : "Failed to start audio");
    }
  }, [params]);

  const noteOn = useCallback((m: number) => {
    engineRef.current?.noteOn(m);
  }, []);

  const noteOff = useCallback((m: number) => {
    engineRef.current?.noteOff(m);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const eng = engineRef.current;
    if (!eng) return;

    const codeToOffset = new Map(
      KEYBOARD_MAP.filter((k) => k.key).map((k) => [k.key!, k.midiOffset]),
    );

    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();

      if (key === "[") {
        e.preventDefault();
        updateParam("octave", Math.max(1, octaveRef.current - 1));
        return;
      }
      if (key === "]") {
        e.preventDefault();
        updateParam("octave", Math.min(7, octaveRef.current + 1));
        return;
      }

      const offset = codeToOffset.get(key);
      if (offset === undefined) return;
      if (eng.isComputerKeyHeld(key)) return;
      e.preventDefault();
      eng.holdComputerKey(key);
      const m = 12 * (octaveRef.current + 1) + offset;
      keyMidiRef.current.set(key, m);
      eng.noteOn(m);
    };

    const onUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const offset = codeToOffset.get(key);
      if (offset === undefined) return;
      eng.releaseComputerKey(key);
      const m =
        keyMidiRef.current.get(key) ?? 12 * (octaveRef.current + 1) + offset;
      keyMidiRef.current.delete(key);
      eng.noteOff(m);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [ready, updateParam]);

  useEffect(() => {
    if (!ready) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void engineRef.current?.resumeIfNeeded();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready]);

  const toggleRecord = async () => {
    const eng = engineRef.current;
    if (!eng || !ready) return;
    setRecError(null);
    if (sample.recording) {
      eng.stopRecording();
      updateParam("useSample", true);
    } else {
      try {
        await eng.startRecording();
      } catch {
        setRecError("Mic access denied — allow microphone to sample.");
      }
    }
  };

  return (
    <div className="relative min-h-full bg-bg">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at 50% 20%, black 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              Web Audio · MIDI · Sample · Video
            </p>
            <h1 className="font-sans text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              PHOSPHOR
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              Synth keyboard + VGA/glitch video synth
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              ok={midi.connected}
              on={midi.supported}
              icon={midi.connected ? Wifi : WifiOff}
              label={
                !midi.supported
                  ? "No MIDI API"
                  : midi.connected
                    ? midi.inputs[0] || "MIDI"
                    : "MIDI idle"
              }
            />
            <StatusPill
              ok={sample.hasSample}
              on={ready}
              icon={Disc}
              label={
                sample.recording
                  ? "REC…"
                  : sample.hasSample
                    ? `Sample ${sample.duration.toFixed(1)}s`
                    : "No sample"
              }
            />
            <StatusPill
              ok={ready}
              on
              icon={Power}
              label={ready ? "Audio on" : "Audio off"}
            />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface/80 p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-sans text-sm font-bold tracking-wide text-fg">
                Video Synth
              </h2>
              <div className="flex flex-wrap gap-1">
                {VIDEO_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateParam("videoMode", m.id)}
                    className={[
                      "rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors",
                      params.videoMode === m.id
                        ? "bg-primary text-bg"
                        : "bg-panel text-muted hover:text-fg",
                    ].join(" ")}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <VideoSynth
              analyser={analyser}
              mode={params.videoMode}
              intensity={params.videoIntensity}
              activeNotes={activeMidis.length}
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Scope analyser={analyser} level={level} />
              <Knob
                label="VID FX"
                value={params.videoIntensity}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateParam("videoIntensity", v)}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface/80 p-3 sm:p-4">
            <div>
              <h2 className="mb-2 font-sans text-sm font-bold tracking-wide">
                Oscillator
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {WAVEFORMS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    disabled={!ready}
                    onClick={() => {
                      updateParam("waveform", w);
                      if (params.useSample) updateParam("useSample", false);
                    }}
                    className={[
                      "rounded-md border px-3 py-2 font-mono text-xs capitalize transition-colors",
                      params.waveform === w && !params.useSample
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-panel text-muted hover:border-border-bright hover:text-fg",
                    ].join(" ")}
                  >
                    {w}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!ready || !sample.hasSample}
                  onClick={() => updateParam("useSample", true)}
                  className={[
                    "rounded-md border px-3 py-2 font-mono text-xs transition-colors",
                    params.useSample
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-panel text-muted hover:border-border-bright hover:text-fg",
                  ].join(" ")}
                >
                  sample
                </button>
              </div>
            </div>

            <div>
              <h2 className="mb-3 font-sans text-sm font-bold tracking-wide">
                Filter & Envelope
              </h2>
              <div className="grid grid-cols-4 gap-y-4 gap-x-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
                <Knob
                  label="Cutoff"
                  value={params.filterCutoff}
                  min={80}
                  max={12000}
                  step={10}
                  unit="Hz"
                  onChange={(v) => updateParam("filterCutoff", v)}
                  format={(v) =>
                    v >= 1000
                      ? `${(v / 1000).toFixed(1)}k`
                      : String(Math.round(v))
                  }
                />
                <Knob
                  label="Reso"
                  value={params.filterRes}
                  min={0.1}
                  max={22}
                  step={0.1}
                  onChange={(v) => updateParam("filterRes", v)}
                />
                <Knob
                  label="Attack"
                  value={params.attack}
                  min={0.001}
                  max={2}
                  step={0.001}
                  unit="s"
                  onChange={(v) => updateParam("attack", v)}
                  format={(v) => v.toFixed(2)}
                />
                <Knob
                  label="Decay"
                  value={params.decay}
                  min={0.01}
                  max={2}
                  step={0.01}
                  unit="s"
                  onChange={(v) => updateParam("decay", v)}
                  format={(v) => v.toFixed(2)}
                />
                <Knob
                  label="Sustain"
                  value={params.sustain}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateParam("sustain", v)}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
                <Knob
                  label="Release"
                  value={params.release}
                  min={0.01}
                  max={3}
                  step={0.01}
                  unit="s"
                  onChange={(v) => updateParam("release", v)}
                  format={(v) => v.toFixed(2)}
                />
                <Knob
                  label="Detune"
                  value={params.detune}
                  min={0}
                  max={40}
                  step={1}
                  unit="¢"
                  onChange={(v) => updateParam("detune", v)}
                  format={(v) => String(Math.round(v))}
                />
                <Knob
                  label="Volume"
                  value={params.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateParam("volume", v)}
                  format={(v) => `${Math.round(v * 100)}`}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-3">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                  <Keyboard className="size-3.5" />
                  Octave
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!ready}
                    className="size-10 rounded-md border border-border bg-panel-raised text-lg text-fg hover:border-primary hover:text-primary"
                    onClick={() =>
                      updateParam("octave", Math.max(1, params.octave - 1))
                    }
                    aria-label="Octave down"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <div className="font-sans text-2xl font-bold text-primary">
                      {params.octave}
                    </div>
                    <div className="font-mono text-[10px] text-muted">
                      [ ] keys
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    className="size-10 rounded-md border border-border bg-panel-raised text-lg text-fg hover:border-primary hover:text-primary"
                    onClick={() =>
                      updateParam("octave", Math.min(7, params.octave + 1))
                    }
                    aria-label="Octave up"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-panel p-3">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                  <Activity className="size-3.5" />
                  Live Sample
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => void toggleRecord()}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      sample.recording
                        ? "border-danger bg-danger/15 text-danger"
                        : "border-border bg-panel-raised text-fg hover:border-primary",
                    ].join(" ")}
                  >
                    {sample.recording ? (
                      <>
                        <MicOff className="size-3.5" /> Stop
                      </>
                    ) : (
                      <>
                        <Mic className="size-3.5" /> Record
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!ready || !sample.hasSample}
                    onClick={() => {
                      void engineRef.current
                        ?.resampleSample(params.sampleRate || 1.5)
                        .then(() => updateParam("sampleRate", 1));
                    }}
                    className="rounded-md border border-border bg-panel-raised px-3 py-2 text-xs text-fg hover:border-accent disabled:opacity-40"
                  >
                    Resample
                  </button>
                  <button
                    type="button"
                    disabled={!ready || !sample.hasSample}
                    onClick={() => {
                      engineRef.current?.clearSample();
                      updateParam("useSample", false);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-panel-raised px-2 py-2 text-xs text-muted hover:text-danger"
                    aria-label="Clear sample"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex justify-center">
                  <Knob
                    label="Rate"
                    value={params.sampleRate}
                    min={0.25}
                    max={4}
                    step={0.05}
                    onChange={(v) => updateParam("sampleRate", v)}
                    format={(v) => `${v.toFixed(2)}×`}
                  />
                </div>
                {recError && (
                  <p className="mt-2 text-[11px] text-danger">{recError}</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-surface/80 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-sm font-bold tracking-wide">
              Keyboard
            </h2>
            <p className="font-mono text-[10px] text-muted sm:text-[11px]">
              Z–M / Q–I · black: S D G H J · 2 3 5 6 7 · [ ] octave
            </p>
          </div>
          <PianoKeyboard
            activeMidis={activeSet}
            baseOctave={params.octave}
            onNoteOn={noteOn}
            onNoteOff={noteOff}
          />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Volume2 className="size-3" /> Dual-osc poly · lowpass · ADSR · Web
            MIDI · live sample/resample
          </span>
          <span>Audio unlocks on your first gesture</span>
        </footer>
      </div>

      {!ready && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/92 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-bright bg-panel p-8 text-center shadow-[0_0_60px_var(--color-primary-glow)]">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
              <Power className="size-7 text-primary" />
            </div>
            <h2 className="font-sans text-2xl font-extrabold text-fg">
              Power on PHOSPHOR
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Browsers block audio until you interact. Tap below to start the
              Web Audio engine, enable MIDI, and open the video synth.
            </p>
            <button
              type="button"
              onClick={() => void boot()}
              className="mt-6 w-full rounded-xl bg-primary px-6 py-3.5 font-sans text-base font-bold text-bg transition hover:brightness-110 active:scale-[0.98]"
            >
              Enable Audio & Play
            </button>
            {bootError && (
              <p className="mt-3 text-xs text-danger">{bootError}</p>
            )}
            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-faint">
              Requires a modern browser · Chrome best for Web MIDI
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({
  ok,
  on,
  icon: Icon,
  label,
}: {
  ok: boolean;
  on: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span
      className={[
        "inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-full border px-2.5 py-1 font-mono text-[10px]",
        !on
          ? "border-border text-faint"
          : ok
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-panel text-muted",
      ].join(" ")}
      title={label}
    >
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
