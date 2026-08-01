import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Check,
  CircuitBoard,
  Cpu,
  EthernetPort,
  Film,
  Gauge,
  Layers,
  Minus,
  Radio,
  Shield,
  Video,
  X,
  Zap,
} from "lucide-react";

type TabId = "pick" | "pi" | "rp" | "io" | "bringup";
type PathId = "pi5" | "rp2350" | "rp2040" | "zero2" | "teensy";

const TABS: { id: TabId; label: string }[] = [
  { id: "pick", label: "Pick one" },
  { id: "pi", label: "Pi 5 path" },
  { id: "rp", label: "RP + DVI path" },
  { id: "io", label: "Shared I/O" },
  { id: "bringup", label: "Bring-up" },
];

const PATHS: {
  id: PathId;
  title: string;
  board: string;
  tag: string;
  recommend?: boolean;
  summary: string;
  good: string[];
  weak: string[];
}[] = [
  {
    id: "pi5",
    title: "SBC only",
    board: "Raspberry Pi 5",
    tag: "Full instrument",
    recommend: true,
    summary:
      "One board for camera, USB video, IP streams, HDMI, and CV/GATE via a cheap ADC + protected GPIO. No MCU required.",
    good: [
      "CSI / UVC camera",
      "RTSP · WebRTC · SRT",
      "USB composite capture",
      "1080p shader graph",
      "Native HDMI",
    ],
    weak: [
      "GATE is software-timed (fine if poller is prioritized)",
      "Needs ADC breakout for multi-CV",
    ],
  },
  {
    id: "rp2350",
    title: "MCU only",
    board: "RP2350 + DVI Feather",
    tag: "Eurorack generative",
    recommend: true,
    summary:
      "Hard realtime CV/GATE and classic VGA/glitch/8–16bit looks over DVI. No Linux, no IP — pure module.",
    good: [
      "Microsecond GATE",
      "DVI/HDMI Feather you own",
      "Low power · small PCB",
      "Web PHOSPHOR aesthetic",
    ],
    weak: ["No IP streams", "No camera without big external silicon"],
  },
  {
    id: "rp2040",
    title: "MCU only",
    board: "RP2040 + DVI Feather",
    tag: "Fastest first light",
    summary:
      "Same architecture as RP2350 at lower resolution. Best “blink a glitch raster this weekend” board.",
    good: ["Known PicoDVI path", "CV/GATE hard realtime", "Your Feather works"],
    weak: ["Tighter RAM/CPU", "Stick to 320×240–360×240 for complex FX"],
  },
  {
    id: "zero2",
    title: "SBC light",
    board: "Pi Zero 2 W",
    tag: "Pocket node",
    summary:
      "Generative + one light camera or low-bitrate stream. Not the dual-source 1080p machine.",
    good: ["Small", "Wi‑Fi IP experiments", "Same software family as Pi 5"],
    weak: ["Drop dual HD sources", "Thermals / CPU headroom"],
  },
  {
    id: "teensy",
    title: "MCU control",
    board: "Teensy 4.1",
    tag: "CV king · not DVI",
    summary:
      "Best ADC and USB host in your drawer. Use for a CV utility — or later as a sensor dongle — not as the DVI video brain (Feathers are RP-side).",
    good: ["Excellent multi-CV", "USB host", "Audio shield friendly"],
    weak: [
      "No native DVI Feather path",
      "Video needs different display hardware",
    ],
  },
];

const CV_JACKS = [
  { id: "CV1", map: "Intensity", range: "±5 V" },
  { id: "CV2", map: "Mode / palette morph", range: "±5 V" },
  { id: "CV3", map: "Glitch slice", range: "±5 V" },
  { id: "CV4", map: "Hue / phosphor tint", range: "±5 V" },
  { id: "CV5", map: "Zoom / scale", range: "±5 V" },
  { id: "CV6", map: "Feedback / trail", range: "±5 V" },
  { id: "CV7", map: "A↔B mix / layer mix", range: "0–10 V*" },
  { id: "CV8", map: "Master FX depth", range: "±5 V" },
];

const GATE_JACKS = [
  { id: "G1", map: "Freeze / hard cut" },
  { id: "G2", map: "Glitch burst" },
  { id: "G3", map: "Mode / palette step" },
  { id: "G4", map: "Source / seed" },
];

const FEATURE_ROWS: {
  feature: string;
  pi5: "yes" | "partial" | "no";
  rp: "yes" | "partial" | "no";
}[] = [
  { feature: "CV modulators ×8", pi5: "yes", rp: "yes" },
  { feature: "GATE triggers ×4", pi5: "partial", rp: "yes" },
  { feature: "VGA / glitch / 8 / 16 modes", pi5: "yes", rp: "yes" },
  { feature: "HDMI / DVI out", pi5: "yes", rp: "yes" },
  { feature: "Camera (CSI / UVC)", pi5: "yes", rp: "no" },
  { feature: "IP stream (RTSP etc.)", pi5: "yes", rp: "no" },
  { feature: "Analog CVBS in", pi5: "partial", rp: "no" },
  { feature: "Eurorack depth / power", pi5: "partial", rp: "yes" },
  { feature: "Hard realtime feel", pi5: "partial", rp: "yes" },
];

function Flag({ v }: { v: "yes" | "partial" | "no" }) {
  if (v === "yes")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-primary">
        <Check className="h-3.5 w-3.5" /> yes
      </span>
    );
  if (v === "partial")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-accent">
        <Minus className="h-3.5 w-3.5" /> ok*
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted">
      <X className="h-3.5 w-3.5" /> no
    </span>
  );
}

function Jack({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
          accent
            ? "border-accent bg-accent/10"
            : "border-primary/50 bg-primary/5"
        }`}
      >
        <div
          className={`h-3.5 w-3.5 rounded-full ${
            accent ? "bg-accent/80" : "bg-primary/70"
          }`}
        />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
        {label}
      </span>
    </div>
  );
}

function PiDiagram() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
      <svg
        viewBox="0 0 880 260"
        className="mx-auto h-auto w-full min-w-[560px] max-w-3xl"
        role="img"
        aria-label="Pi 5 only architecture"
      >
        <rect
          x="300"
          y="30"
          width="280"
          height="200"
          rx="12"
          fill="#1a9a5822"
          stroke="#3dff9a"
          strokeWidth="1.5"
        />
        <text
          x="440"
          y="58"
          textAnchor="middle"
          fill="#3dff9a"
          fontSize="14"
          fontFamily="Syne, sans-serif"
          fontWeight="700"
        >
          Raspberry Pi 5 ONLY
        </text>
        <text
          x="440"
          y="82"
          textAnchor="middle"
          fill="#e4f0e8"
          fontSize="11"
          fontFamily="monospace"
        >
          ADC thread + GLES / GStreamer
        </text>
        <text
          x="440"
          y="110"
          textAnchor="middle"
          fill="#7a9184"
          fontSize="11"
          fontFamily="monospace"
        >
          no second MCU required
        </text>
        {[
          ["CSI / UVC", 40, 50],
          ["RTSP / IP", 40, 100],
          ["USB CVBS", 40, 150],
          ["CV via ADC", 40, 200],
        ].map(([t, x, y]) => (
          <g key={t as string}>
            <rect
              x={x as number}
              y={(y as number) - 14}
              width="100"
              height="28"
              rx="6"
              fill="#141a17"
              stroke="#ffb84d"
            />
            <text
              x={(x as number) + 50}
              y={(y as number) + 4}
              textAnchor="middle"
              fill="#ffb84d"
              fontSize="11"
              fontFamily="monospace"
            >
              {t as string}
            </text>
            <line
              x1={(x as number) + 100}
              y1={y as number}
              x2="300"
              y2={y as number}
              stroke="#ffb84d"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
          </g>
        ))}
        <rect
          x="40"
          y="230"
          width="100"
          height="0"
          fill="none"
        />
        <g>
          <rect
            x="40"
            y="218"
            width="100"
            height="28"
            rx="6"
            fill="#141a17"
            stroke="#3dff9a"
          />
          <text
            x="90"
            y="236"
            textAnchor="middle"
            fill="#3dff9a"
            fontSize="11"
            fontFamily="monospace"
          >
            GATE GPIO
          </text>
          <line
            x1="140"
            y1="232"
            x2="300"
            y2="200"
            stroke="#3dff9a"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
        </g>
        <rect
          x="640"
          y="90"
          width="120"
          height="80"
          rx="10"
          fill="#141a17"
          stroke="#3dff9a"
        />
        <text
          x="700"
          y="125"
          textAnchor="middle"
          fill="#3dff9a"
          fontSize="12"
          fontFamily="monospace"
        >
          HDMI
        </text>
        <text
          x="700"
          y="148"
          textAnchor="middle"
          fill="#7a9184"
          fontSize="10"
          fontFamily="monospace"
        >
          + web preview
        </text>
        <line
          x1="580"
          y1="130"
          x2="640"
          y2="130"
          stroke="#3dff9a"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function RpDiagram() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
      <svg
        viewBox="0 0 880 240"
        className="mx-auto h-auto w-full min-w-[560px] max-w-3xl"
        role="img"
        aria-label="RP plus DVI Feather only architecture"
      >
        <rect
          x="280"
          y="40"
          width="300"
          height="160"
          rx="12"
          fill="#b87a2022"
          stroke="#ffb84d"
          strokeWidth="1.5"
        />
        <text
          x="430"
          y="72"
          textAnchor="middle"
          fill="#ffb84d"
          fontSize="14"
          fontFamily="Syne, sans-serif"
          fontWeight="700"
        >
          RP2040 / RP2350 ONLY
        </text>
        <text
          x="430"
          y="96"
          textAnchor="middle"
          fill="#e4f0e8"
          fontSize="11"
          fontFamily="monospace"
        >
          + DVI / HDMI Feather
        </text>
        <text
          x="430"
          y="124"
          textAnchor="middle"
          fill="#7a9184"
          fontSize="11"
          fontFamily="monospace"
        >
          generative framebuffer · scanline FX
        </text>
        <text
          x="430"
          y="148"
          textAnchor="middle"
          fill="#7a9184"
          fontSize="11"
          fontFamily="monospace"
        >
          hard CV/GATE · no Linux
        </text>
        <text
          x="430"
          y="176"
          textAnchor="middle"
          fill="#3dff9a"
          fontSize="11"
          fontFamily="monospace"
        >
          vga · glitch · bit8 · bit16 · combo
        </text>
        {[
          ["CV ×8 ADC", 40, 70],
          ["GATE ×4", 40, 130],
        ].map(([t, x, y]) => (
          <g key={t as string}>
            <rect
              x={x as number}
              y={(y as number) - 14}
              width="100"
              height="28"
              rx="6"
              fill="#141a17"
              stroke="#3dff9a"
            />
            <text
              x={(x as number) + 50}
              y={(y as number) + 4}
              textAnchor="middle"
              fill="#3dff9a"
              fontSize="11"
              fontFamily="monospace"
            >
              {t as string}
            </text>
            <line
              x1={(x as number) + 100}
              y1={y as number}
              x2="280"
              y2={y as number}
              stroke="#3dff9a"
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
          </g>
        ))}
        <rect
          x="640"
          y="80"
          width="140"
          height="80"
          rx="10"
          fill="#141a17"
          stroke="#ffb84d"
        />
        <text
          x="710"
          y="115"
          textAnchor="middle"
          fill="#ffb84d"
          fontSize="12"
          fontFamily="monospace"
        >
          DVI / HDMI
        </text>
        <text
          x="710"
          y="138"
          textAnchor="middle"
          fill="#7a9184"
          fontSize="10"
          fontFamily="monospace"
        >
          320–640p class
        </text>
        <line
          x1="580"
          y1="120"
          x2="640"
          y2="120"
          stroke="#ffb84d"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export function HardwareDesign() {
  const [tab, setTab] = useState<TabId>("pick");
  const [path, setPath] = useState<PathId>("pi5");

  const selected = PATHS.find((p) => p.id === path) ?? PATHS[0]!;

  const tabBody = useMemo(() => {
    switch (tab) {
      case "pick":
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-5">
              <p className="font-sans text-base font-semibold text-fg md:text-lg">
                Yes — use either an SBC <span className="text-muted">or</span>{" "}
                an MCU. Not both.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                From your shelf:{" "}
                <span className="text-fg">Pi 5</span> for multi-source video, or{" "}
                <span className="text-fg">RP2350/RP2040 + DVI Feather</span> for
                a pure generative Eurorack video module. Teensy 4.1 is excellent
                CV hardware, not the DVI path. Pi Zero 2 is a light sibling; Zero
                1 is too small for this.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {PATHS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPath(p.id);
                    if (p.id === "pi5" || p.id === "zero2") setTab("pi");
                    else if (p.id === "rp2350" || p.id === "rp2040")
                      setTab("rp");
                  }}
                  className={`rounded-lg border p-4 text-left transition ${
                    path === p.id
                      ? "border-primary/50 bg-panel-raised"
                      : "border-border bg-panel hover:border-border-bright"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-sans text-sm font-semibold text-fg">
                      {p.title}
                    </span>
                    {p.recommend && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-primary">
                        recommend
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-muted">
                      {p.tag}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-accent">{p.board}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {p.summary}
                  </p>
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-panel-raised px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-primary">
                Feature coverage — Pi 5 vs RP + DVI
              </div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase text-muted">
                <span>Feature</span>
                <span className="w-16 text-center">Pi 5</span>
                <span className="w-16 text-center">RP+DVI</span>
              </div>
              <div className="divide-y divide-border">
                {FEATURE_ROWS.map((row) => (
                  <div
                    key={row.feature}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-3 py-2 text-xs"
                  >
                    <span className="text-fg">{row.feature}</span>
                    <span className="flex w-16 justify-center">
                      <Flag v={row.pi5} />
                    </span>
                    <span className="flex w-16 justify-center">
                      <Flag v={row.rp} />
                    </span>
                  </div>
                ))}
              </div>
              <p className="border-t border-border px-3 py-2 text-[10px] text-muted">
                *ok = works with caveats (software GATE on Pi; USB capture for
                CVBS; Pi depth/power for rack).
              </p>
            </div>
          </div>
        );

      case "pi":
        return (
          <div className="space-y-6">
            <PiDiagram />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Cpu className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold text-fg">
                    Single brain
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  Pi 5 runs capture, decode, shaders,{" "}
                  <span className="text-fg">and</span> CV/GATE. Thread A polls
                  ADS1115/MCP3008 + GPIO @ 1–4 kHz; Thread B runs GStreamer /
                  GLES @ 30–60 fps. Params are shared atomics — no SPI slave MCU.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-accent">
                  <Zap className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold text-fg">
                    GATE on Linux
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  Video gates don’t need audio-rate precision. Use{" "}
                  <span className="text-fg">pigpio / libgpiod</span>, optional{" "}
                  <span className="text-fg">SCHED_FIFO</span> poller,{" "}
                  <span className="text-fg">isolcpus</span> only if RTSP load
                  ever softens edges. Good enough for freeze/glitch/mode step.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: Camera,
                  t: "Camera",
                  d: "CSI Module 3 or any UVC webcam via V4L2",
                },
                {
                  icon: EthernetPort,
                  t: "IP stream",
                  d: "GStreamer rtspsrc / webrtcbin / SRT on eth or Wi‑Fi",
                },
                {
                  icon: Film,
                  t: "Analog in",
                  d: "USB CVBS capture stick first; CSI decoder later if needed",
                },
              ].map(({ icon: Icon, t, d }) => (
                <div
                  key={t}
                  className="rounded-lg border border-border bg-panel p-4"
                >
                  <div className="mb-2 flex items-center gap-2 text-accent">
                    <Icon className="h-4 w-4" />
                    <h3 className="font-sans text-sm font-semibold text-fg">
                      {t}
                    </h3>
                  </div>
                  <p className="text-xs text-muted">{d}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-panel p-4">
              <h3 className="mb-2 font-sans text-sm font-semibold text-fg">
                Buy list (you already have the Pi)
              </h3>
              <ul className="grid gap-1.5 text-xs text-muted sm:grid-cols-2">
                <li>
                  <span className="text-fg">ADS1115 or MCP3008</span> — 4–8 CV
                  channels
                </li>
                <li>
                  <span className="text-fg">Op-amps + TVS + jacks</span> —
                  Eurorack frontend
                </li>
                <li>
                  <span className="text-fg">Camera or USB cam</span> — optional
                  day one
                </li>
                <li>
                  <span className="text-fg">USB composite capture</span> — analog
                  path without CSI decoder
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-2 flex items-center gap-2 text-muted">
                <CircuitBoard className="h-4 w-4" />
                <h3 className="font-sans text-sm font-semibold text-fg">
                  Zero 2 / Zero 1
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                <span className="text-fg">Zero 2 W</span> — same software family,
                generative + one light source. Skip dual HD and heavy RTSP.{" "}
                <span className="text-fg">Zero 1</span> — not for this instrument.
              </p>
            </div>
          </div>
        );

      case "rp":
        return (
          <div className="space-y-6">
            <RpDiagram />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-accent">
                  <Video className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold text-fg">
                    DVI Feather path
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  Your RP2040/RP2350 Feathers with DVI/HDMI are ideal. Framebuffer
                  → DVI serializer → monitor. Looks closer to the web PHOSPHOR
                  VGA/glitch palette world than fighting 1080p on an MCU.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Gauge className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold text-fg">
                    Resolution targets
                  </h3>
                </div>
                <ul className="space-y-1 text-xs text-muted">
                  <li>
                    <span className="text-fg">RP2040</span> — 320×240 / 360×240
                    comfort; simple 640×480 stretch
                  </li>
                  <li>
                    <span className="text-fg">RP2350</span> — 640×480 / 720×400;
                    multi-layer feedback
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Layers className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold text-fg">
                    Firmware
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-muted">
                  <li>Pico SDK (max DVI bandwidth) or Arduino</li>
                  <li>Double-buffered FB + scanline “shaders”</li>
                  <li>MCP3208/ADS SPI for 8× CV</li>
                  <li>GPIO IRQ for GATE freeze / mode / glitch</li>
                  <li>Modes: vga · glitch · bit8 · bit16 · combo</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-muted">
                  <Shield className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold text-fg">
                    Explicitly out of scope
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  No IP decode, no CSI camera, no clean CVBS without a video
                  decoder IC and line memory. If you need those, use the{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setTab("pi")}
                  >
                    Pi 5 path
                  </button>
                  — still a single board.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-panel p-4">
              <h3 className="mb-2 font-sans text-sm font-semibold text-fg">
                Teensy 4.1 role
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                Keep Teensy for CV-heavy utilities or a future USB-CDC sensor
                dongle. It does not drive your RP DVI Feathers. For MCU video
                with hardware you already own,{" "}
                <span className="text-fg">RP + Feather</span> is the straight
                line.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-panel p-4">
              <h3 className="mb-2 font-sans text-sm font-semibold text-fg">
                Buy list (you have RP + Feather)
              </h3>
              <ul className="grid gap-1.5 text-xs text-muted sm:grid-cols-2">
                <li>
                  <span className="text-fg">MCP3208</span> (or similar) — 8ch CV
                </li>
                <li>
                  <span className="text-fg">Op-amps + protection + jacks</span>
                </li>
                <li>
                  <span className="text-fg">Panel + 5 V</span> — Eurorack or USB-C
                </li>
                <li>
                  <span className="text-fg">Optional OLED</span> — mode / CV meter
                </li>
              </ul>
            </div>
          </div>
        );

      case "io":
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Same jack map and analog frontend whether the brain is Pi 5 or RP.
              Only the digitizer changes (I²C/SPI ADC + GPIO vs MCU ADC/SPI).
            </p>
            <div className="rounded-lg border border-border bg-panel p-4">
              <h3 className="mb-3 font-sans text-sm font-semibold text-fg">
                Panel sketch
              </h3>
              <div className="flex flex-wrap items-end justify-center gap-3 border-b border-border pb-4">
                {CV_JACKS.map((j) => (
                  <Jack key={j.id} label={j.id} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-center gap-4">
                {GATE_JACKS.map((j) => (
                  <Jack key={j.id} label={j.id} accent />
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-panel-raised px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-primary">
                  CV ×8
                </div>
                <div className="divide-y divide-border">
                  {CV_JACKS.map((j) => (
                    <div
                      key={j.id}
                      className="grid grid-cols-[3rem_1fr_auto] gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-primary">{j.id}</span>
                      <span className="text-fg">{j.map}</span>
                      <span className="font-mono text-muted">{j.range}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-panel-raised px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-accent">
                  GATE ×4
                </div>
                <div className="divide-y divide-border">
                  {GATE_JACKS.map((j) => (
                    <div
                      key={j.id}
                      className="grid grid-cols-[3rem_1fr] gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-accent">{j.id}</span>
                      <span className="text-fg">{j.map}</span>
                    </div>
                  ))}
                </div>
                <p className="border-t border-border px-3 py-2 text-[10px] text-muted">
                  Frontend: 100kΩ, attenuverter or digital scale, clamp to 0–3.3
                  V, TVS + schmitt on gates. Identical for both paths.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-panel p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Radio className="h-4 w-4" />
                <h3 className="font-sans text-sm font-semibold text-fg">
                  Optional later — not required
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                If Pi 5 GATE ever feels soft under dual heavy streams: RP2040 as
                a USB-CDC / SPI <span className="text-fg">sensor dongle</span>{" "}
                only. Still not a dual-brain product — start single board.
              </p>
            </div>
          </div>
        );

      case "bringup":
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-sans text-sm font-semibold text-primary">
                  Track A · Pi 5
                </h3>
                <ol className="space-y-2">
                  {[
                    "GLES test pattern + keyboard params",
                    "ADS1115 CV meters on overlay",
                    "GATE freeze / glitch / mode step",
                    "CSI or UVC live source",
                    "RTSP + CV7 crossfade",
                    "USB composite capture (optional)",
                  ].map((s, i) => (
                    <li
                      key={s}
                      className="flex gap-2 rounded-lg border border-border bg-panel p-2.5 text-xs text-muted"
                    >
                      <span className="font-mono text-primary">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="mb-3 font-sans text-sm font-semibold text-accent">
                  Track B · RP + DVI
                </h3>
                <ol className="space-y-2">
                  {[
                    "Solid raster over DVI Feather",
                    "Palette quantize (VGA16 + phosphor)",
                    "Scanline glitch + feedback buffer",
                    "ADC CV → frame uniforms",
                    "GATE IRQ → freeze / mode",
                    "Panelize + power",
                  ].map((s, i) => (
                    <li
                      key={s}
                      className="flex gap-2 rounded-lg border border-border bg-panel p-2.5 text-xs text-muted"
                    >
                      <span className="font-mono text-accent">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm text-fg">
                Selected focus:{" "}
                <span className="font-mono text-accent">{selected.board}</span>
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                <li>
                  <span className="text-primary">Good · </span>
                  {selected.good.join(" · ")}
                </li>
                <li>
                  <span className="text-accent">Watch · </span>
                  {selected.weak.join(" · ")}
                </li>
              </ul>
            </div>
          </div>
        );
    }
  }, [tab, path, selected]);

  return (
    <div className="min-h-full bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition hover:border-primary/40 hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Synth
            </Link>
            <div>
              <p className="font-sans text-sm font-bold tracking-wide text-primary">
                PHOSPHOR VIDEO
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Single-board design · A1
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] text-muted">
            Your kit · Pi 5 · Zero · RP · Teensy · Feathers
          </span>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition ${
                tab === t.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-panel hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="rounded-xl border border-border bg-panel p-5 md:p-6">
          <h1 className="font-sans text-xl font-bold tracking-tight text-fg md:text-2xl">
            One brain: Pi 5 <span className="text-muted">or</span> RP + DVI
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Dual MCU+SBC was the luxury architecture. With your inventory, the
            honest product is simpler:{" "}
            <span className="text-fg">Pi 5 only</span> for camera/IP/analog
            capture, or <span className="text-fg">RP + DVI Feather only</span>{" "}
            for a hard-CV generative module.
          </p>
        </section>

        {tabBody}

        <footer className="border-t border-border pt-4 pb-8 text-center font-mono text-[10px] text-faint">
          docs/hardware/phosphor-video-mcu-sbc.md · Hypervault A1
        </footer>
      </main>
    </div>
  );
}
