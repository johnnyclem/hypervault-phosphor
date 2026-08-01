# PHOSPHOR Video — Single-board designs (your inventory)

**Product line:** Hypervault / PHOSPHOR  
**Revision:** A1 — **either SBC *or* MCU** (no dual-board requirement)  
**Your kit:** RPi 5 · RPi Zero 1/2 · Teensy 4.1 · RP2040/RP2350 · DVI/HDMI Feathers

## Short answer

**Yes — pick one.** You do **not** need MCU + SBC together.

| Path | Board | What it does well | What it drops or weakens |
|---|---|---|---|
| **SBC-only** ★ | **Raspberry Pi 5** | Camera · USB video · IP streams · HDMI · full shader graph | GATE latency under load (still fine for modular video if tuned) |
| **SBC-light** | Pi Zero 2 W | Generative + light CSI / simple streams | Heavy RTSP, dual sources, 1080p FX |
| **Avoid as main** | Pi Zero 1 | Tiny experiments only | Real video synth |
| **MCU-only** ★ | **RP2350 + DVI Feather** | Pure generative VGA/glitch/8–16bit · hard CV/GATE · Eurorack module | No IP; analog/camera need extra chips |
| **MCU-only** | RP2040 + DVI Feather | Same idea, lower res / fewer effects | RAM/CPU ceiling |
| **MCU control king** | **Teensy 4.1** | Best ADC + USB host; great CV brain | No native DVI Feather — pair with RP for video *or* use as CV-only later |

**Recommendation from your shelf:**

1. **Full multi-source instrument → Pi 5 only**  
2. **Tight Eurorack generative video module → RP2350 + DVI Feather only**  
3. Hybrid MCU+SBC is optional later if Pi 5 GATE timing ever feels soft — not day one.

---

## Path A — SBC only (Raspberry Pi 5)

### Why this works alone

Linux + GPU + CSI + USB + network is exactly what multi-source video needs. CV and GATE are “just” protected GPIO + ADC — good enough for video-rate modulation (you are not doing audio-rate FM).

### Block diagram

```
  CV ×8 ──► op-amps + clamp ──► SPI ADC (ADS1115×2 or MCP3008×2)
  GATE ×4 ──► schmitt ──► GPIO (pigpio / libgpiod, isolcpus optional)

  CSI cam ──┐
  USB UVC ──┼──► V4L2 / GStreamer ──► GLES shaders ──► HDMI
  RTSP/IP ──┘         ▲
                      │ params from ADC + GPIO thread
```

### Parts you still need (cheap)

| Piece | Role |
|---|---|
| Op-amp frontend (TL072 etc.) | ±5 V / 0–10 V → 0–3.3 V |
| **ADS1115** (I²C) or MCP3008 (SPI) | 4–8 CV channels |
| TVS + series R + schmitt | GATE safety |
| Optional: USB composite capture | Analog CVBS without CSI decoder |
| Optional: Pi Camera Module 3 | CSI path |

No second MCU required. Optional later: RP2040 as USB-CDC “CV dongle” if you want cleaner sampling — still not a second brain for video.

### Software sketch

- `phosphor-video` daemon (C++/Rust/Python):
  - Thread A: poll ADC + GPIO @ 1–4 kHz → shared atomics  
  - Thread B: GStreamer / DRM + GLES effect graph @ 30–60 fps  
- Modes: `vga` · `glitch` · `bit8` · `bit16` · `combo` (same as web)
- Sources: `csi` · `uvc` · `rtsp://…` · `test`

### Pi 5 CV/GATE reliability tips

- Pin high-priority poller with `SCHED_FIFO` or use **pigpio** wave/alerts for GATE edges  
- `isolcpus` + `nohz_full` for the video core if GATE ever glitches under RTSP load  
- Sample CV at 1 kHz first — video uniforms don’t need audio-rate  

### Pi Zero 2 W variant

- Generative + single CSI or single low-bitrate RTSP  
- Drop dual-source crossfade and 1080p  
- Still valid “pocket” Hypervault node  

### Pi Zero 1

- Skip for this product (use as MIDI/USB gadget toy only)

---

## Path B — MCU only (RP2040 / RP2350 + DVI Feather)

### Why this works alone

PicoDVI / HSTX DVI on Feather boards is a **known-good** path for 320×240–640×480 “VGA/glitch/8-bit” looks — closer to the web PHOSPHOR aesthetic than a full 1080p GPU path, and excellent as a Eurorack module.

### Block diagram

```
  CV ×8 ──► frontend ──► external ADC (MCP3208 / ADS131) ──► SPI
  GATE ×4 ──► GPIO IRQ

  RP2040 / RP2350 ──► DVI/HDMI Feather ──► monitor / scaler / CRT via adapter
       │
       └── internal generators (plasma, feedback buffer, palette quantize)
```

### Capability matrix

| Feature | RP2040 + DVI | RP2350 + DVI | Notes |
|---|---|---|---|
| Generative video | Yes | Yes | Higher res / layers on 2350 |
| CV/GATE | Yes (+ ADC IC) | Yes | Hard realtime |
| HDMI/DVI out | Feather | Feather | Use what you have |
| CSI camera | No* | No* | *needs external bridge + huge firmware |
| Analog CVBS in | No* | No* | Needs video decoder + line store |
| IP stream | No | No | No Ethernet stack for video decode |
| Eurorack fit | Excellent | Excellent | Low power, small PCB |

### Firmware stack

- **Arduino / Pico SDK / CircuitPython** (your call; SDK for max DVI bandwidth)  
- Double-buffered framebuffer → DVI serializer  
- Effect modes as scanline shaders (palette, slice glitch, phosphor tint)  
- GATE EXTI mutates mode flags immediately  
- CV updates parameters each frame (or each line for wilder looks)

### Resolution targets

| Chip | Comfortable | Stretch |
|---|---|---|
| RP2040 | 320×240 / 360×240 | 640×480 simple 8-color |
| RP2350 | 640×480 / 720×400 | Multi-layer feedback |

This matches the **web combo VGA/glitch/8–16bit** look better than fighting for 1080p on a microcontroller.

---

## Path C — Teensy 4.1 (where it shines)

Teensy 4.1 is the **best pure-control MCU** in your drawer:

- Fast ADC, many pins, PSRAM, USB host  
- Great for **8+ CV + 4 GATE + OLED** with zero Linux drama  

It does **not** pair with your RP DVI Feathers natively. Options:

1. **Teensy as the whole module** using VGA/parallel TFT / existing Teensy video libraries (different from DVI Feather path)  
2. **Teensy as CV frontend only** talking UART/SPI to Pi 5 or RP2350 — only if you later want luxury sampling  
3. **Skip Teensy for video v1** and keep it for a separate Hypervault audio/CV utility  

**For “just one brain”:** prefer **Pi 5** or **RP2350+DVI**, not Teensy-as-DVI.

---

## Feature coverage by path

| Requirement | Pi 5 only | Zero 2 only | RP2350+DVI | RP2040+DVI | Teensy alone |
|---|---|---|---|---|---|
| On-screen keys (N/A hw) | — | — | — | — | — |
| CV modulators | Yes (ADC) | Yes | Yes | Yes | Best ADC |
| GATE triggers | Yes* | Yes* | Best | Best | Best |
| VGA/glitch/8–16 modes | Yes (GPU) | Partial | Yes (native look) | Yes | If display path exists |
| HDMI/DVI out | Native | Mini/micro adapters | Feather | Feather | Extra hardware |
| Analog video in | USB capture / CSI decoder | Hard | Extra silicon | Extra silicon | Extra |
| Camera | CSI / UVC | CSI light | No | No | No |
| IP stream | Yes | Light | No | No | No |
| Live sampling audio | Yes (USB/I2S) | Yes | Optional I2S | Optional | Yes (audio shield) |

\*Pi GATE is software-timed; fine for video if you prioritize the poller.

---

## Decide in one line

| If you want… | Build… |
|---|---|
| Camera + IP + analog capture + HDMI | **Pi 5 only** |
| Small rack generative glitch box, hard CV/GATE | **RP2350 + DVI Feather only** |
| Cheapest/fastest first light | **RP2040 + DVI Feather** generative demo |
| Best CV metering / utility module | **Teensy 4.1** (not the video out path) |

---

## Shared Eurorack frontend (both paths)

Same analog front end whether the brain is Pi or RP:

- 100 kΩ input impedance  
- Attenuverter (or digital scale in firmware)  
- Clamp to 0–3.3 V  
- TVS + polyfuse per jack  
- GATE: schmitt, 0–10 V tolerant, ~1.2 V threshold  

Jack map can stay identical to A0 (CV1–8, G1–4).

### Default CV map (unchanged)

| Jack | Role |
|---|---|
| CV1 | Intensity |
| CV2 | Mode / palette morph |
| CV3 | Glitch slice |
| CV4 | Hue / phosphor |
| CV5 | Zoom / crop (Pi) or scale (MCU) |
| CV6 | Feedback / trail |
| CV7 | Source A↔B (Pi) or layer mix (MCU) |
| CV8 | Master FX depth |
| G1 | Freeze |
| G2 | Glitch burst |
| G3 | Mode step |
| G4 | Source / seed |

---

## BOM deltas (using what you own)

### Pi 5 path (buy list)

| Item | Notes |
|---|---|
| RPi 5 (yours) | Main brain |
| ADC breakout ×1–2 | ADS1115 or MCP3008 |
| Op-amps + jacks + protection | CV/GATE front |
| Camera Module or USB cam | Optional day one |
| USB CVBS capture | If you want analog in without CSI decoder |
| 42HP panel | Optional |

### RP + DVI path (buy list)

| Item | Notes |
|---|---|
| RP2350 or RP2040 (yours) | Main brain |
| DVI/HDMI Feather (yours) | Video out |
| MCP3208 or similar | 8ch CV |
| Op-amps + jacks + protection | Same frontend |
| Panel + 5 V power | Eurorack or USB-C |

---

## Bring-up (pick one track)

### Track Pi 5

1. GLES test pattern + keyboard param control  
2. ADS1115 CV meters on HDMI overlay  
3. GATE freeze/glitch wired  
4. CSI or UVC source  
5. RTSP source + CV7 crossfade  
6. USB composite capture (optional)  

### Track RP + DVI

1. Solid color / raster over DVI Feather  
2. Palette quantize (VGA16 + phosphor)  
3. Scanline glitch + feedback buffer  
4. ADC CV → uniforms  
5. GATE IRQ → freeze / mode step  
6. Panelize  

---

## Hybrid later (optional, not required)

If Pi 5 GATE ever feels soft under dual 1080p decode:

```
RP2040 (CV/GATE only) --USB CDC or SPI--> Pi 5 (video)
```

That is a **sensor dongle**, not a second architecture. Start single-board.

---

*Hypervault — PHOSPHOR Video Design A1 · single-brain*
