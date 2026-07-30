import {
  type SynthParams,
  type Waveform,
  DEFAULT_PARAMS,
  midiToFreq,
} from "./types";

type Voice = {
  midi: number;
  osc: OscillatorNode | AudioBufferSourceNode;
  osc2?: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  released: boolean;
};

export type MidiStatus = {
  supported: boolean;
  connected: boolean;
  inputs: string[];
  error?: string;
};

export type SampleStatus = {
  hasSample: boolean;
  duration: number;
  recording: boolean;
  sampleRate: number;
};

type EngineListeners = {
  onActiveNotes?: (notes: number[]) => void;
  onLevel?: (level: number) => void;
  onMidi?: (status: MidiStatus) => void;
  onSample?: (status: SampleStatus) => void;
};

/**
 * Polyphonic Web Audio synth:
 * dual-osc + noise, lowpass, ADSR, analyser, live sampling, MIDI.
 * AudioContext created only on first user gesture via start().
 */
export class SynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private voices = new Map<number, Voice>();
  private params: SynthParams = { ...DEFAULT_PARAMS };
  private listeners: EngineListeners = {};
  private started = false;
  private noiseBuffer: AudioBuffer | null = null;
  private sampleBuffer: AudioBuffer | null = null;
  private mediaStream: MediaStream | null = null;
  private recorder: ScriptProcessorNode | null = null;
  private recordSource: MediaStreamAudioSourceNode | null = null;
  private recordMute: GainNode | null = null;
  private recordChunks: Float32Array[] = [];
  private recording = false;
  private midiAccess: globalThis.MIDIAccess | null = null;
  private levelRaf = 0;
  private heldComputerKeys = new Set<string>();

  isStarted(): boolean {
    return this.started && this.ctx?.state === "running";
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getParams(): SynthParams {
    return { ...this.params };
  }

  setListeners(l: EngineListeners) {
    this.listeners = l;
  }

  /** Must be called from a user gesture. */
  async start(): Promise<void> {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.curveVolume(this.params.volume);

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.12;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;

      this.master.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.noiseBuffer = this.makeNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    this.started = true;
    this.pumpLevels();
    void this.initMidi();
    this.emitSample();
  }

  async resumeIfNeeded() {
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume();
    }
  }

  setParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]) {
    this.params[key] = value;
    if (!this.ctx || !this.master) return;

    if (key === "volume") {
      this.master.gain.setTargetAtTime(
        this.curveVolume(value as number),
        this.ctx.currentTime,
        0.02,
      );
    }

    if (key === "filterCutoff" || key === "filterRes") {
      for (const v of this.voices.values()) {
        if (key === "filterCutoff") {
          v.filter.frequency.setTargetAtTime(
            value as number,
            this.ctx.currentTime,
            0.02,
          );
        } else {
          v.filter.Q.setTargetAtTime(
            value as number,
            this.ctx.currentTime,
            0.02,
          );
        }
      }
    }

    if (key === "sampleRate" && this.params.useSample) {
      for (const [midi, v] of this.voices) {
        if (v.osc instanceof AudioBufferSourceNode) {
          const rate = (value as number) * Math.pow(2, (midi - 60) / 12);
          v.osc.playbackRate.setTargetAtTime(
            Math.max(0.05, Math.min(16, rate)),
            this.ctx.currentTime,
            0.02,
          );
        }
      }
    }
  }

  noteOn(midi: number, velocity = 0.85) {
    if (!this.ctx || !this.master || !this.started) return;
    void this.resumeIfNeeded();

    if (this.voices.has(midi)) {
      this.forceStopVoice(midi);
    }

    const t = this.ctx.currentTime;
    const p = this.params;
    const vel = Math.max(0.05, Math.min(1, velocity));

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = p.filterCutoff;
    filter.Q.value = p.filterRes;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    filter.connect(gain);
    gain.connect(this.master);

    const peak = 0.22 * vel;
    const a = Math.max(0.001, p.attack);
    const d = Math.max(0.001, p.decay);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + a);
    gain.gain.linearRampToValueAtTime(peak * p.sustain, t + a + d);

    let osc: OscillatorNode | AudioBufferSourceNode;
    let osc2: OscillatorNode | undefined;

    if (p.useSample && this.sampleBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.sampleBuffer;
      src.loop = true;
      const rate = p.sampleRate * Math.pow(2, (midi - 60) / 12);
      src.playbackRate.value = Math.max(0.05, Math.min(16, rate));
      src.connect(filter);
      src.start(t);
      osc = src;
    } else if (p.waveform === "noise") {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer!;
      src.loop = true;
      src.connect(filter);
      src.start(t);
      osc = src;
    } else {
      const o1 = this.ctx.createOscillator();
      o1.type = p.waveform as OscillatorType;
      o1.frequency.value = midiToFreq(midi);
      o1.detune.value = -p.detune;

      const o2 = this.ctx.createOscillator();
      o2.type = p.waveform as OscillatorType;
      o2.frequency.value = midiToFreq(midi);
      o2.detune.value = p.detune;

      const mix = this.ctx.createGain();
      mix.gain.value = 0.5;
      o1.connect(mix);
      o2.connect(mix);
      mix.connect(filter);
      o1.start(t);
      o2.start(t);
      osc = o1;
      osc2 = o2;
    }

    this.voices.set(midi, {
      midi,
      osc,
      osc2,
      filter,
      gain,
      released: false,
    });
    this.emitActive();
  }

  noteOff(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice || !this.ctx || voice.released) return;

    const t = this.ctx.currentTime;
    const r = Math.max(0.01, this.params.release);
    voice.released = true;

    this.voices.delete(midi);
    this.emitActive();

    voice.gain.gain.cancelScheduledValues(t);
    const current = Math.max(0.0001, voice.gain.gain.value);
    voice.gain.gain.setValueAtTime(current, t);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + r);

    const stopAt = t + r + 0.02;
    try {
      voice.osc.stop(stopAt);
      voice.osc2?.stop(stopAt);
    } catch {
      /* already stopped */
    }

    window.setTimeout(
      () => {
        try {
          voice.gain.disconnect();
          voice.filter.disconnect();
        } catch {
          /* */
        }
      },
      (r + 0.05) * 1000,
    );
  }

  private forceStopVoice(midi: number) {
    const voice = this.voices.get(midi);
    if (!voice || !this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setValueAtTime(0.0001, t);
      voice.osc.stop(t + 0.01);
      voice.osc2?.stop(t + 0.01);
      voice.gain.disconnect();
      voice.filter.disconnect();
    } catch {
      /* */
    }
    this.voices.delete(midi);
  }

  allNotesOff() {
    for (const midi of [...this.voices.keys()]) {
      this.forceStopVoice(midi);
    }
    this.emitActive();
  }

  async startRecording(): Promise<void> {
    if (!this.ctx || this.recording) return;
    await this.resumeIfNeeded();

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const source = this.ctx.createMediaStreamSource(this.mediaStream);
    const bufferSize = 4096;
    const recorder = this.ctx.createScriptProcessor(bufferSize, 1, 1);
    this.recordChunks = [];
    this.recording = true;

    recorder.onaudioprocess = (ev) => {
      if (!this.recording) return;
      const input = ev.inputBuffer.getChannelData(0);
      this.recordChunks.push(new Float32Array(input));
    };

    source.connect(recorder);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    recorder.connect(mute);
    mute.connect(this.ctx.destination);

    this.recordSource = source;
    this.recordMute = mute;
    this.recorder = recorder;
    this.emitSample();
  }

  stopRecording(): void {
    if (!this.ctx || !this.recording) return;
    this.recording = false;

    try {
      this.recorder?.disconnect();
      this.recordSource?.disconnect();
      this.recordMute?.disconnect();
    } catch {
      /* */
    }
    this.recorder = null;
    this.recordSource = null;
    this.recordMute = null;

    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;

    if (this.recordChunks.length === 0) {
      this.emitSample();
      return;
    }

    const total = this.recordChunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of this.recordChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.recordChunks = [];

    const trimmed = trimSilence(merged, 0.01);
    if (trimmed.length < 256) {
      this.emitSample();
      return;
    }

    const buf = this.ctx.createBuffer(1, trimmed.length, this.ctx.sampleRate);
    buf.copyToChannel(Float32Array.from(trimmed), 0);
    this.sampleBuffer = buf;
    this.params.useSample = true;
    this.emitSample();
  }

  clearSample() {
    this.sampleBuffer = null;
    this.params.useSample = false;
    this.emitSample();
  }

  async resampleSample(factor: number): Promise<void> {
    if (!this.ctx || !this.sampleBuffer) return;
    const f = Math.max(0.1, Math.min(8, factor));
    const src = this.sampleBuffer;
    const newLength = Math.max(1, Math.floor(src.length / f));
    const offline = new OfflineAudioContext(1, newLength, this.ctx.sampleRate);
    const bufferSource = offline.createBufferSource();
    bufferSource.buffer = src;
    bufferSource.playbackRate.value = f;
    bufferSource.connect(offline.destination);
    bufferSource.start(0);
    const rendered = await offline.startRendering();
    this.sampleBuffer = rendered;
    this.params.sampleRate = 1;
    this.emitSample();
  }

  private async initMidi() {
    if (typeof navigator.requestMIDIAccess !== "function") {
      this.listeners.onMidi?.({
        supported: false,
        connected: false,
        inputs: [],
        error: "Web MIDI not available in this browser",
      });
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess = access;
      this.wireMidi();
      access.onstatechange = () => this.wireMidi();
    } catch (e) {
      this.listeners.onMidi?.({
        supported: true,
        connected: false,
        inputs: [],
        error: e instanceof Error ? e.message : "MIDI access denied",
      });
    }
  }

  private wireMidi() {
    const access = this.midiAccess;
    if (!access) return;
    const names: string[] = [];
    for (const input of access.inputs.values()) {
      names.push(input.name || input.id);
      input.onmidimessage = (ev) => this.onMidiMessage(ev);
    }
    this.listeners.onMidi?.({
      supported: true,
      connected: names.length > 0,
      inputs: names,
    });
  }

  private onMidiMessage(ev: MIDIMessageEvent) {
    const data = ev.data;
    if (!data || data.length < 2) return;
    const status = data[0]! & 0xf0;
    const note = data[1]!;
    const vel = data[2] ?? 0;

    if (status === 0x90 && vel > 0) {
      this.noteOn(note, vel / 127);
    } else if (status === 0x80 || (status === 0x90 && vel === 0)) {
      this.noteOff(note);
    } else if (status === 0xb0 && note === 123) {
      this.allNotesOff();
    }
  }

  private curveVolume(v: number) {
    return Math.pow(Math.max(0, Math.min(1, v)), 2) * 0.9;
  }

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private emitActive() {
    this.listeners.onActiveNotes?.([...this.voices.keys()]);
  }

  private emitSample() {
    this.listeners.onSample?.({
      hasSample: !!this.sampleBuffer,
      duration: this.sampleBuffer?.duration ?? 0,
      recording: this.recording,
      sampleRate: this.params.sampleRate,
    });
  }

  private pumpLevels() {
    if (this.levelRaf) cancelAnimationFrame(this.levelRaf);
    const tick = () => {
      if (this.analyser) {
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        this.listeners.onLevel?.(Math.min(1, rms * 3.2));
      }
      this.levelRaf = requestAnimationFrame(tick);
    };
    this.levelRaf = requestAnimationFrame(tick);
  }

  dispose() {
    this.allNotesOff();
    if (this.levelRaf) cancelAnimationFrame(this.levelRaf);
    if (this.recording) this.stopRecording();
    void this.ctx?.close();
    this.ctx = null;
    this.started = false;
  }

  isComputerKeyHeld(k: string) {
    return this.heldComputerKeys.has(k);
  }
  holdComputerKey(k: string) {
    this.heldComputerKeys.add(k);
  }
  releaseComputerKey(k: string) {
    this.heldComputerKeys.delete(k);
  }
}

function trimSilence(data: Float32Array, threshold: number): Float32Array {
  let start = 0;
  let end = data.length - 1;
  while (start < end && Math.abs(data[start]!) < threshold) start++;
  while (end > start && Math.abs(data[end]!) < threshold) end--;
  start = Math.max(0, start - 64);
  end = Math.min(data.length - 1, end + 64);
  return data.subarray(start, end + 1);
}

export type { Waveform };
