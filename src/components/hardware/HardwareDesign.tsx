import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  CircuitBoard,
  Cpu,
  EthernetPort,
  Film,
  Gauge,
  Layers,
  Radio,
  Shield,
  Video,
  Zap,
} from "lucide-react";

type TabId = "overview" | "io" | "pipeline" | "bom" | "bringup";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Architecture" },
  { id: "io", label: "I/O Map" },
  { id: "pipeline", label: "Pipeline" },
  { id: "bom", label: "BOM" },
  { id: "bringup", label: "Bring-up" },
];

const CV_JACKS = [
  { id: "CV1", map: "Intensity", range: "±5 V", rate: "4 kHz" },
  { id: "CV2", map: "Mode / palette morph", range: "±5 V", rate: "4 kHz" },
  { id: "CV3", map: "Glitch slice", range: "±5 V", rate: "4 kHz" },
  { id: "CV4", map: "Hue / phosphor tint", range: "±5 V", rate: "4 kHz" },
  { id: "CV5", map: "Zoom / crop", range: "±5 V", rate: "1 kHz" },
  { id: "CV6", map: "Feedback / trail", range: "±5 V", rate: "1 kHz" },
  { id: "CV7", map: "Source A↔B crossfade", range: "0–10 V*", rate: "1 kHz" },
  { id: "CV8", map: "Master FX depth", range: "±5 V", rate: "4 kHz" },
];

const GATE_JACKS = [
  { id: "G1", map: "Freeze / hard cut", edge: "Rising" },
  { id: "G2", map: "Glitch burst", edge: "Rise/Fall" },
  { id: "G3", map: "Palette / mode step", edge: "Rising" },
  { id: "G4", map: "Source switch / seed", edge: "Rising" },
];

const VIDEO_IN = [
  {
    title: "Analog (CVBS)",
    icon: Film,
    hw: "ADV7280A-M → CSI-2",
    formats: "NTSC / PAL / SECAM composite",
    note: "VCR, camera, modular video",
  },
  {
    title: "Camera",
    icon: Camera,
    hw: "MIPI CSI or USB UVC",
    formats: "720p–1080p",
    note: "IMX219/477 or UVC webcam",
  },
  {
    title: "IP stream",
    icon: EthernetPort,
    hw: "eth0 / wlan0 + GStreamer",
    formats: "RTSP · WebRTC · SRT · HLS",
    note: "Decode H.264/H.265 on SBC",
  },
];

const BOM = [
  { item: "STM32H723 (or RP2350 + external ADC)", qty: "1", est: "$12–25" },
  { item: "Rock 5B 8GB / Raspberry Pi 5 8GB", qty: "1", est: "$80–120" },
  { item: "ADV7280A-M composite→CSI module", qty: "1", est: "$25–40" },
  { item: "ADV7393 composite out (optional)", qty: "1", est: "$15–25" },
  { item: "CV/GATE frontend + jacks + protection", qty: "12 ch", est: "$30" },
  { item: "OLED 128×64 + encoder + LEDs", qty: "1", est: "$15" },
  { item: "42HP panel + PCB fab", qty: "1", est: "$40–80" },
  { item: "Misc (TVS, fuses, connectors, heatsink)", qty: "—", est: "$20" },
];

function Jack({
  label,
  accent = false,
}: {
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
          accent
            ? "border-accent bg-accent/10 text-accent"
            : "border-primary/50 bg-primary/5 text-primary"
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

function ArchitectureDiagram() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4 md:p-6">
      <svg
        viewBox="0 0 920 340"
        className="mx-auto h-auto w-full min-w-[640px] max-w-4xl"
        role="img"
        aria-label="MCU and SBC architecture block diagram"
      >
        <defs>
          <linearGradient id="mcuGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1a9a58" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0e1210" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="sbcGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b87a20" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0e1210" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* CV/GATE sources */}
        <text x="20" y="36" fill="#7a9184" fontSize="11" fontFamily="monospace">
          EURORACK
        </text>
        {[
          [28, 60, "CV ×8"],
          [28, 100, "GATE ×4"],
        ].map(([x, y, t], i) => (
          <g key={i}>
            <rect
              x={x as number}
              y={(y as number) - 14}
              width="72"
              height="28"
              rx="6"
              fill="#141a17"
              stroke="#3dff9a"
              strokeWidth="1.2"
            />
            <text
              x={(x as number) + 36}
              y={(y as number) + 4}
              textAnchor="middle"
              fill="#3dff9a"
              fontSize="11"
              fontFamily="monospace"
            >
              {t as string}
            </text>
            <line
              x1={(x as number) + 72}
              y1={y as number}
              x2="140"
              y2={y as number}
              stroke="#3dff9a"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </g>
        ))}

        {/* MCU block */}
        <rect
          x="140"
          y="30"
          width="260"
          height="150"
          rx="12"
          fill="url(#mcuGrad)"
          stroke="#3dff9a"
          strokeWidth="1.5"
        />
        <text x="156" y="54" fill="#3dff9a" fontSize="13" fontFamily="Syne, sans-serif" fontWeight="700">
          MCU · REALTIME
        </text>
        <text x="156" y="76" fill="#e4f0e8" fontSize="12" fontFamily="monospace">
          STM32H723 / RP2350
        </text>
        <text x="156" y="100" fill="#7a9184" fontSize="11" fontFamily="monospace">
          ADC DMA · Schmitt GATE
        </text>
        <text x="156" y="120" fill="#7a9184" fontSize="11" fontFamily="monospace">
          Attenuverters · OLED UI
        </text>
        <text x="156" y="140" fill="#7a9184" fontSize="11" fontFamily="monospace">
          SPI param bus · IRQ
        </text>
        <text x="156" y="162" fill="#ffb84d" fontSize="10" fontFamily="monospace">
          {'<200 µs gate latency'}
        </text>

        {/* SPI arrow */}
        <line
          x1="400"
          y1="105"
          x2="480"
          y2="105"
          stroke="#ffb84d"
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
        <text x="418" y="92" fill="#ffb84d" fontSize="10" fontFamily="monospace">
          SPI + IRQ
        </text>

        {/* Video sources left bottom */}
        <text x="20" y="220" fill="#7a9184" fontSize="11" fontFamily="monospace">
          PICTURE
        </text>
        {[
          [28, 244, "CVBS"],
          [28, 280, "CSI/UVC"],
          [28, 316, "RTSP"],
        ].map(([x, y, t], i) => (
          <g key={i}>
            <rect
              x={x as number}
              y={(y as number) - 12}
              width="72"
              height="24"
              rx="6"
              fill="#141a17"
              stroke="#ffb84d"
              strokeWidth="1.2"
            />
            <text
              x={(x as number) + 36}
              y={(y as number) + 4}
              textAnchor="middle"
              fill="#ffb84d"
              fontSize="10"
              fontFamily="monospace"
            >
              {t as string}
            </text>
            <line
              x1={(x as number) + 72}
              y1={y as number}
              x2="480"
              y2={210 + i * 28}
              stroke="#ffb84d"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
          </g>
        ))}

        {/* SBC block */}
        <rect
          x="480"
          y="30"
          width="300"
          height="280"
          rx="12"
          fill="url(#sbcGrad)"
          stroke="#ffb84d"
          strokeWidth="1.5"
        />
        <text x="496" y="54" fill="#ffb84d" fontSize="13" fontFamily="Syne, sans-serif" fontWeight="700">
          SBC · VIDEO
        </text>
        <text x="496" y="76" fill="#e4f0e8" fontSize="12" fontFamily="monospace">
          RK3588 / Raspberry Pi 5
        </text>
        <text x="496" y="104" fill="#7a9184" fontSize="11" fontFamily="monospace">
          V4L2 · libcamera · GStreamer
        </text>
        <text x="496" y="124" fill="#7a9184" fontSize="11" fontFamily="monospace">
          GLES/Vulkan effect graph
        </text>
        <text x="496" y="144" fill="#7a9184" fontSize="11" fontFamily="monospace">
          IP decode · WebRTC preview
        </text>
        <text x="496" y="180" fill="#e4f0e8" fontSize="11" fontFamily="monospace">
          MODES
        </text>
        {["vga", "glitch", "bit8", "bit16", "combo"].map((m, i) => (
          <rect
            key={m}
            x={496 + (i % 3) * 88}
            y={192 + Math.floor(i / 3) * 32}
            width="80"
            height="24"
            rx="4"
            fill="#141a17"
            stroke="#3a5044"
          />
        ))}
        {["vga", "glitch", "bit8", "bit16", "combo"].map((m, i) => (
          <text
            key={`t-${m}`}
            x={536 + (i % 3) * 88}
            y={208 + Math.floor(i / 3) * 32}
            textAnchor="middle"
            fill="#3dff9a"
            fontSize="11"
            fontFamily="monospace"
          >
            {m}
          </text>
        ))}
        <text x="496" y="280" fill="#7a9184" fontSize="11" fontFamily="monospace">
          OUT → HDMI + composite (ADV7393)
        </text>

        {/* Output */}
        <rect
          x="800"
          y="120"
          width="100"
          height="100"
          rx="10"
          fill="#141a17"
          stroke="#3dff9a"
          strokeWidth="1.5"
        />
        <text x="850" y="155" textAnchor="middle" fill="#3dff9a" fontSize="12" fontFamily="monospace">
          HDMI
        </text>
        <text x="850" y="178" textAnchor="middle" fill="#ffb84d" fontSize="12" fontFamily="monospace">
          CVBS
        </text>
        <text x="850" y="200" textAnchor="middle" fill="#7a9184" fontSize="10" fontFamily="monospace">
          preview
        </text>
        <line x1="780" y1="170" x2="800" y2="170" stroke="#3dff9a" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function HardwareDesign() {
  const [tab, setTab] = useState<TabId>("overview");

  const tabBody = useMemo(() => {
    switch (tab) {
      case "overview":
        return (
          <div className="space-y-6">
            <ArchitectureDiagram />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Cpu,
                  title: "MCU hard realtime",
                  body: "CV/GATE sampling, edge IRQ, OLED, SPI param stream — no Linux jitter on modular edges.",
                },
                {
                  icon: CircuitBoard,
                  title: "SBC video brain",
                  body: "RK3588 or Pi 5 runs capture, decode, GLES shaders, and network preview.",
                },
                {
                  icon: Zap,
                  title: "CV as uniforms",
                  body: "Every frame, shader params come from the latest ParamFrame over SPI.",
                },
                {
                  icon: Shield,
                  title: "Eurorack-safe",
                  body: "Clamps, TVS, polyfuses, isolated 5 V compute rail from ±12 V modular power.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-panel p-4"
                >
                  <div className="mb-2 flex items-center gap-2 text-primary">
                    <Icon className="h-4 w-4" />
                    <h3 className="font-sans text-sm font-semibold text-fg">
                      {title}
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-panel p-4">
              <h3 className="mb-2 font-sans text-sm font-semibold text-fg">
                Why split MCU + SBC?
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                Video synthesis needs GPU bandwidth and network stacks. Modular
                CV/GATE needs microsecond determinism. Putting both on one Linux
                SoC forces compromises (missed gates under load, ADC noise, or
                weak video). A small MCU owns the patch bay; the SBC owns the
                picture. Same mental model as the web PHOSPHOR synth —{" "}
                <span className="text-primary">params drive modes</span> — but
                params arrive as volts.
              </p>
            </div>
          </div>
        );

      case "io":
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-panel p-4">
              <h3 className="mb-3 font-sans text-sm font-semibold text-fg">
                Panel — CV & GATE (42HP sketch)
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
                  CV modulators ×8
                </div>
                <div className="divide-y divide-border">
                  {CV_JACKS.map((j) => (
                    <div
                      key={j.id}
                      className="grid grid-cols-[3rem_1fr_auto] gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-primary">{j.id}</span>
                      <span className="text-fg">{j.map}</span>
                      <span className="font-mono text-muted">
                        {j.range} · {j.rate}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="border-t border-border px-3 py-2 text-[10px] text-muted">
                  *CV7 can be switched unipolar 0–10 V for crossfade-style control.
                  All channels: 100kΩ, DC-coupled, attenuverter, ADC clamp.
                </p>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-panel-raised px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-accent">
                  GATE / TRIG ×4
                </div>
                <div className="divide-y divide-border">
                  {GATE_JACKS.map((j) => (
                    <div
                      key={j.id}
                      className="grid grid-cols-[3rem_1fr_auto] gap-2 px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-accent">{j.id}</span>
                      <span className="text-fg">{j.map}</span>
                      <span className="font-mono text-muted">{j.edge}</span>
                    </div>
                  ))}
                </div>
                <p className="border-t border-border px-3 py-2 text-[10px] text-muted">
                  0–10 V tolerant Schmitt · hardware RC debounce · digital re-arm
                  · target edge→effect {'<'} 200 µs via MCU IRQ.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {VIDEO_IN.map(({ title, icon: Icon, hw, formats, note }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-panel p-4"
                >
                  <div className="mb-2 flex items-center gap-2 text-accent">
                    <Icon className="h-4 w-4" />
                    <h3 className="font-sans text-sm font-semibold text-fg">
                      {title}
                    </h3>
                  </div>
                  <p className="mb-1 font-mono text-[11px] text-primary">{hw}</p>
                  <p className="mb-1 text-xs text-fg">{formats}</p>
                  <p className="text-[11px] text-muted">{note}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Video className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold">Outputs</h3>
                </div>
                <ul className="space-y-1 text-xs text-muted">
                  <li>
                    <span className="text-fg">HDMI</span> — primary monitor /
                    capture
                  </li>
                  <li>
                    <span className="text-fg">Composite (ADV7393)</span> — CRT /
                    modular video
                  </li>
                  <li>
                    <span className="text-fg">WebRTC / MJPEG</span> — phone
                    preview
                  </li>
                  <li>
                    <span className="text-fg">CV OUT ×2 (opt.)</span> — luma
                    follower + motion energy
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Radio className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold">
                    ParamFrame (SPI)
                  </h3>
                </div>
                <pre className="overflow-x-auto rounded bg-bg p-3 font-mono text-[10px] leading-relaxed text-crt-green">
{`u16 sequence
u16 gate_mask     // edges since last
i16 cv[8]         // ±5V → int16
u8  flags
u8  reserved[5]
u32 timestamp_us`}
                </pre>
              </div>
            </div>
          </div>
        );

      case "pipeline":
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                {[
                  "Source select",
                  "Capture / decode",
                  "Normalize",
                  "Effect graph",
                  "HDMI · CVBS",
                ].map((step, i, arr) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[11px] text-primary">
                      {step}
                    </div>
                    {i < arr.length - 1 && (
                      <span className="hidden text-faint md:inline">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-muted">
                CV/GATE bus injects uniforms every frame · GATE can hard-interrupt
                freeze/glitch outside the frame loop
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-panel-raised px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-primary">
                Effect graph ↔ control
              </div>
              <div className="divide-y divide-border text-xs">
                {[
                  ["Input crop / scale", "CV5"],
                  ["Feedback delay / trail", "CV6"],
                  ["Palette quantize (VGA · 8 · 16)", "CV2 + G3"],
                  ["Glitch row slice", "CV3 + G2"],
                  ["Scanline / CRT mask", "CV8"],
                  ["Plasma / interference field", "CV1 intensity"],
                  ["Freeze / hard cut", "G1"],
                  ["Source A↔B crossfade", "CV7"],
                ].map(([node, ctrl]) => (
                  <div
                    key={node}
                    className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-2"
                  >
                    <span className="text-fg">{node}</span>
                    <span className="font-mono text-accent sm:text-right">
                      {ctrl}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Layers className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold">
                    SBC software
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-muted">
                  <li>
                    <span className="text-fg">Capture:</span> V4L2 + libcamera /
                    GStreamer
                  </li>
                  <li>
                    <span className="text-fg">IP:</span> rtspsrc · webrtcbin ·
                    SRT
                  </li>
                  <li>
                    <span className="text-fg">FX:</span> OpenGL ES 3.1 / Vulkan
                    compute
                  </li>
                  <li>
                    <span className="text-fg">Daemon:</span> phosphor-video
                    (SPI + JSON API)
                  </li>
                  <li>
                    <span className="text-fg">UI:</span> DRM/KMS fullscreen +
                    web config
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-panel p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Gauge className="h-4 w-4" />
                  <h3 className="font-sans text-sm font-semibold">
                    MCU firmware
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-muted">
                  <li>ADC DMA continuous (oversampled → 4 kHz CV)</li>
                  <li>GATE EXTI + re-arm + edge mask</li>
                  <li>SPI slave streaming ParamFrame @ 20–40 MHz</li>
                  <li>OLED jack map, atten, uni/bipolar</li>
                  <li>USB-C DFU bootloader</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "bom":
        return (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="border-b border-border bg-panel-raised px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-primary">
                Prototype A0 BOM
              </div>
              <div className="divide-y divide-border">
                {BOM.map((row) => (
                  <div
                    key={row.item}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2.5 text-xs"
                  >
                    <span className="text-fg">{row.item}</span>
                    <span className="font-mono text-muted">{row.qty}</span>
                    <span className="font-mono text-accent">{row.est}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border bg-panel px-3 py-3 text-xs">
                <span className="text-muted">Prototype total · </span>
                <span className="font-mono text-primary">~$250–350</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-panel p-4">
                <h3 className="mb-2 font-sans text-sm font-semibold text-fg">
                  Option A — 42HP Eurorack
                </h3>
                <p className="text-xs leading-relaxed text-muted">
                  Single panel: 8 CV + 4 GATE, OLED, encoder, HDMI mini,
                  composite I/O, USB-C. SBC as mezzanine or short ribbon to
                  compute brick. Depth target ~45 mm.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-panel p-4">
                <h3 className="mb-2 font-sans text-sm font-semibold text-fg">
                  Option B — I/O panel + brick
                </h3>
                <p className="text-xs leading-relaxed text-muted">
                  Thin 20–28HP panel is pure jacks + MCU. RK3588 lives in a
                  metal brick with proper heatsink — better thermals for 1080p
                  IP decode + shaders.
                </p>
              </div>
            </div>
          </div>
        );

      case "bringup":
        return (
          <div className="space-y-4">
            <ol className="space-y-3">
              {[
                {
                  t: "MCU only",
                  d: "CV meters on OLED, GATE LEDs, SPI loopback self-test.",
                },
                {
                  t: "SBC shaders",
                  d: "Test patterns with fake params over UDP (no hardware SPI yet).",
                },
                {
                  t: "CSI camera",
                  d: "720p → glitch/VGA shaders at 60 fps.",
                },
                {
                  t: "ADV7280 composite",
                  d: "CVBS camera/VCR into the same graph.",
                },
                {
                  t: "RTSP / WebRTC",
                  d: "IP cam as source B; CV7 crossfade A↔B.",
                },
                {
                  t: "GATE latency",
                  d: "Scope G1 → freeze; tune IRQ + uniform path <200 µs feel.",
                },
                {
                  t: "Panel integration",
                  d: "Full 42HP prototype, power, protection, thermal soak.",
                },
              ].map((step, i) => (
                <li
                  key={step.t}
                  className="flex gap-3 rounded-lg border border-border bg-panel p-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-xs text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-sans text-sm font-semibold text-fg">
                      {step.t}
                    </div>
                    <p className="text-xs text-muted">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-xs text-muted">
              <span className="font-semibold text-accent">Open questions · </span>
              Genlock vs free-run · NPU style-transfer later · MIDI TRS-A secondary
              · multi-module SPI clock share with Hypervault choir
            </div>
          </div>
        );
    }
  }, [tab]);

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
                MCU / SBC design · Hypervault A0
              </p>
            </div>
          </div>
          <a
            href="https://github.com/johnnyclem/hypervault-phosphor"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-accent hover:underline"
          >
            github.com/johnnyclem/hypervault-phosphor
          </a>
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
            Modular video synth with CV, GATE, and multi-source picture
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Hardware translation of the PHOSPHOR browser video engine: an MCU
            owns Eurorack-rate CV/GATE, an SBC owns analog video, cameras, and IP
            streams, and shader modes stay familiar — VGA, glitch, 8/16-bit,
            combo — driven by volts instead of mouse drags.
          </p>
        </section>

        {tabBody}

        <footer className="border-t border-border pt-4 pb-8 text-center font-mono text-[10px] text-faint">
          Full write-up · docs/hardware/phosphor-video-mcu-sbc.md · Hypervault
        </footer>
      </main>
    </div>
  );
}
