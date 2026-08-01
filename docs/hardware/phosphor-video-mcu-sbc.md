# PHOSPHOR Video — MCU/SBC Architecture

**Product line:** Hypervault / PHOSPHOR  
**Module class:** Hybrid video synthesizer + modular control surface  
**Revision:** A0 (design)

## 1. Intent

Translate the browser PHOSPHOR video synth into a **rack-mountable / Eurorack-adjacent** instrument that:

- Treats **CV and GATE as first-class modulators** (not MIDI-only afterthoughts)
- Accepts **live picture sources**: composite analog, MIPI/USB camera, IP streams
- Renders **real-time effect modes** (VGA / glitch / 8-bit / 16-bit / combo) with hard timing
- Stays repairable, open, and Eurorack-safe (protection, ranges, panel logic)

## 2. System split (MCU + SBC)

| Domain | Owner | Why |
|---|---|---|
| CV/GATE sample + scale + edge detect | **MCU** (hard real-time) | Deterministic µs timing, ADC continuous, no Linux jitter |
| Panel UI (OLED/LEDs/encoders) | MCU | Instant response, works during SBC reboot |
| Video capture / decode / mix / effects | **SBC** (GPU + ISP) | 720p/1080p frames, RTSP, OpenGL/Vulkan |
| Network / IP streams | SBC | Ethernet, Wi‑Fi, WebRTC, RTSP |
| Clock / frame sync orchestration | MCU ↔ SBC over SPI/UART | MCU can hard-trigger frame events |

```
                 ┌──────────────────────────────────────────┐
  CV ×8  ──────► │  FRONTEND ANALOG (op-amps, clamps)       │
  GATE ×4 ─────► │                                          │
                 │         STM32H723 / RP2350                │
                 │   ADC DMA · Schmitt · SPI slave · I²C     │
                 └───────────────┬──────────────────────────┘
                                 │ SPI @ 20–40 MHz (param bus)
                                 │ + IRQ (gate edge)
                 ┌───────────────▼──────────────────────────┐
  CVBS ────────► │  VIDEO FRONTEND                          │
  CAM CSI ─────► │  RK3588 / Raspberry Pi 5                 │
  USB UVC ─────► │  V4L2 · GStreamer · GL/VK shaders        │
  ETH/RTSP ────► │  HDMI out · Composite out (DAC)          │
                 └──────────────────────────────────────────┘
```

### Recommended silicon

| Role | Primary | Alternate | Notes |
|---|---|---|---|
| MCU | **STM32H723VGT6** | RP2350 + external ADC | 16-bit ADC options via SPI; H7 has good timers |
| SBC | **Radxa Rock 5B (RK3588)** | RPi 5 8GB | RK3588 has dual ISP + NPU + strong decode |
| CV frontend | TL072 / OPA1678 | — | ±12V Eurorack → scaled 0–3.3V |
| Video decoder | **ADV7280A-M** (CVBS→CSI) | TVP5150 + bridge | Prefer MIPI into SBC CSI |
| Video encoder out | ADV7393 (composite) | built-in HDMI only | Keep CRT path alive |
| Protection | BAT54S + polyfuse + TVS | — | Per jack |

## 3. I/O specification

### 3.1 CV inputs (×8) — modulators

| Jack | Default mapping | Range | Rate |
|---|---|---|---|
| CV1 | Intensity | −5…+5 V bipolar | 4 kHz sample (oversampled) |
| CV2 | Mode morph / palette | −5…+5 V | 4 kHz |
| CV3 | Slice / glitch amount | −5…+5 V | 4 kHz |
| CV4 | Hue / phosphor tint | −5…+5 V | 4 kHz |
| CV5 | Zoom / crop | −5…+5 V | 1 kHz |
| CV6 | Feedback / trail | −5…+5 V | 1 kHz |
| CV7 | Source crossfade A↔B | 0…10 V unipolar option | 1 kHz |
| CV8 | Master FX depth | −5…+5 V | 4 kHz |

Each channel:

- DC-coupled input, 100kΩ impedance
- Attenuverter + offset trimpot (or digital attenuverter in firmware)
- Clamped to ADC window, 12–16 bit effective after averaging
- Optional sample-and-hold on GATE edge (per-channel flag)

### 3.2 GATE / TRIG inputs (×4) — triggers

| Jack | Default | Sense |
|---|---|---|
| G1 | Hard cut / freeze frame | Rising, 1.2 V thresh, 0–10 V tolerant |
| G2 | Glitch burst | Rising or falling (menu) |
| G3 | Palette step / mode advance | Rising |
| G4 | Source switch / random seed | Rising |

- Schmitt trigger + RC debounce (hardware) + digital re-arm
- Latency target: **< 200 µs** jack edge → effect start (MCU path)
- Can also clock internal LFO-rate sequencers for video parameters

### 3.3 Optional CV outs (×2)

| Jack | Use |
|---|---|
| CV OUT 1 | Envelope follower from video luma |
| CV OUT 2 | Motion / glitch energy → modular |

### 3.4 Video inputs

| Path | Hardware | Formats |
|---|---|---|
| **Analog** | ADV7280A-M → CSI-2 | NTSC/PAL/SECAM composite; optional S-Video |
| **Camera** | Native CSI (IMX219/477) or USB UVC | 720p–1080p |
| **IP stream** | eth0 / wlan0 | RTSP H.264/H.265, WebRTC, SRT, HLS (decode) |

### 3.5 Video outputs

| Path | Hardware | Notes |
|---|---|---|
| HDMI | SBC native | Primary monitoring / capture |
| Composite | ADV7393 from RGB/YCbCr | CRT / modular video ecosystem |
| Network preview | WebRTC or MJPEG | Phone / laptop monitoring |

## 4. Signal & processing pipeline

```
Source select ──► Capture (V4L2) ──► Normalize ──► Effect graph ──► Output
                      ▲                  ▲
                      │                  │
                 IP decode          CV/GATE param bus
                 (GStreamer)        (SPI ring buffer)
```

### Effect graph (maps from web PHOSPHOR)

| Node | CV/GATE control |
|---|---|
| Input crop/scale | CV5 |
| Feedback delay | CV6 |
| Palette quantize (VGA/8/16) | CV2 + G3 |
| Glitch slice offset | CV3 + G2 |
| Scanline / CRT mask | CV8 |
| Plasma/interference field | CV1 intensity |
| Freeze / hard cut | G1 |
| Source A/B crossfade | CV7 |

Update loop:

1. MCU DMA fills CV sample buffer @ 4 kHz  
2. On GATE edge, MCU asserts IRQ + stamps param snapshot  
3. SBC shader uniform upload every frame (or every 2 frames) from latest SPI packet  
4. Luma analysis → optional CV OUT  

## 5. Firmware / software stack

### MCU (C / Rust, bare-metal or Zephyr)

- ADC DMA continuous  
- GATE EXTI interrupts  
- SPI slave streaming `ParamFrame` structs  
- OLED menu for attenuation, jack mapping, unipolar/bipolar  
- Bootloader via USB-C DFU  

`ParamFrame` (32 bytes, little-endian):

```
u16 sequence
u16 gate_mask          // bit0..3 edges since last frame
i16 cv[8]              // −32768..32767 ≡ −5V..+5V
u8  flags              // sample-hold, bipolar masks
u8  reserved[5]
u32 timestamp_us
```

### SBC (Linux)

| Layer | Choice |
|---|---|
| Capture | V4L2 + libcamera / GStreamer |
| IP | GStreamer `rtspsrc` / `webrtcbin` |
| Effects | OpenGL ES 3.1 fragment shaders (or Vulkan compute) |
| UI | DRM/KMS fullscreen + optional web config on :8080 |
| Control | `phosphor-video` daemon: SPI master + JSON patch API |
| Sync | Prefer free-running 60 fps; optional genlock later |

### Shader modes (parity with web)

- `vga` — 16-color nearest palette  
- `bit8` — phosphor green set  
- `bit16` — RGB555 quantize  
- `glitch` — row slice + posterize  
- `combo` — blend + magenta flecks  

## 6. Mechanical / panel

### Option A — Eurorack 42HP (recommended first SKU)

- 3U, 42HP aluminum panel  
- Top: 8 CV + 4 GATE mini-jacks  
- Mid: source LEDs, mode encoder, OLED 128×64  
- Bottom: HDMI mini, USB-C power/data, 3.5 mm composite in/out  
- Depth: ~45 mm (SBC as mezzanine or external compute brick on ribbon)

### Option B — 1U desktop “Compute Brick” + 20HP I/O panel

- SBC lives in a metal brick with heatsink  
- Thin Eurorack panel is pure I/O + MCU  
- Better thermals for RK3588  

Power:

- Eurorack: +12V / −12V / +5V (MCU + analog)  
- SBC: 5V/5A USB-C PD or barrel (isolated from modular rail)

## 7. BOM sketch (prototype A0)

| Item | Qty | Est. |
|---|---|---|
| STM32H723 dev / custom PCB | 1 | $12–25 |
| Rock 5B 8GB or Pi 5 8GB | 1 | $80–120 |
| ADV7280A-M module | 1 | $25–40 |
| ADV7393 module (optional) | 1 | $15–25 |
| Op-amp frontends + jacks | 12 | $30 |
| OLED + encoder + LEDs | 1 set | $15 |
| Panel + PCB fab (JLCPCB) | 1 | $40–80 |
| Misc (TVS, fuses, connectors) | — | $20 |
| **Prototype total** | | **~$250–350** |

## 8. Safety & modular best practices

- All jacks ESD + overvoltage clamped before op-amps  
- No DC path from ±12 V rails into SBC GPIO  
- Opto or digital isolator on SPI if sharing chassis with dirty grounds  
- Hot-plug CV/GATE safe  
- Composite AC-coupled with proper 75 Ω termination  

## 9. Bring-up plan

1. **MCU only** — CV meters on OLED, GATE LEDs, SPI loopback  
2. **SBC shaders** — test patterns with fake SPI params over UDP  
3. **CSI camera** — 720p → glitch shader  
4. **ADV7280** — composite camera/VCR → same graph  
5. **RTSP** — IP cam decode → source B, CV7 crossfade  
6. **GATE latency** — measure G1 → freeze with scope  
7. **Panel integration** — full 42HP prototype  

## 10. Open questions

- Genlock to external video vs free-run (cost vs pro video sync)  
- Whether NPU assists style transfer later (optional Hypervault “choir vision”)  
- MIDI TRS-A as secondary control bus  
- Multi-module chain: share SPI/I²S clock between choir + video  

## 11. Relationship to web PHOSPHOR

| Web | Hardware |
|---|---|
| Audio analyser drives intensity | CV1 + optional audio envelope MCU |
| Mouse/touch knobs | Encoders + CV attenuverters |
| Canvas 2D palette loops | GPU fragment shaders |
| Single media source (mic) | Multi-source: CVBS / CSI / UVC / RTSP |
| Browser MIDI | CV/GATE + optional MIDI |

---

*Hypervault — PHOSPHOR Video MCU/SBC Design A0*
