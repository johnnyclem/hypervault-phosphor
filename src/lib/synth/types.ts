export type Waveform = "sine" | "square" | "sawtooth" | "triangle" | "noise";

export type VideoMode = "vga" | "glitch" | "bit8" | "bit16" | "combo";

export type SynthParams = {
  waveform: Waveform;
  volume: number;
  octave: number;
  filterCutoff: number;
  filterRes: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  detune: number;
  /** Sample playback rate multiplier when in sample mode */
  sampleRate: number;
  /** Whether notes play recorded sample instead of oscillator */
  useSample: boolean;
  videoMode: VideoMode;
  videoIntensity: number;
};

export const DEFAULT_PARAMS: SynthParams = {
  waveform: "sawtooth",
  volume: 0.55,
  octave: 4,
  filterCutoff: 2800,
  filterRes: 4,
  attack: 0.01,
  decay: 0.18,
  sustain: 0.65,
  release: 0.28,
  detune: 6,
  sampleRate: 1,
  useSample: false,
  videoMode: "combo",
  videoIntensity: 0.75,
};

/** White-key layout for one octave (C–B) + partial next C optional */
export type KeyDef = {
  note: string;
  midiOffset: number;
  isBlack: boolean;
  /** Computer keyboard code (lowercase letter or digit) */
  key?: string;
};

/** Two-octave computer keyboard map starting at C of current octave */
export const KEYBOARD_MAP: KeyDef[] = [
  // Lower octave (Z row)
  { note: "C", midiOffset: 0, isBlack: false, key: "z" },
  { note: "C#", midiOffset: 1, isBlack: true, key: "s" },
  { note: "D", midiOffset: 2, isBlack: false, key: "x" },
  { note: "D#", midiOffset: 3, isBlack: true, key: "d" },
  { note: "E", midiOffset: 4, isBlack: false, key: "c" },
  { note: "F", midiOffset: 5, isBlack: false, key: "v" },
  { note: "F#", midiOffset: 6, isBlack: true, key: "g" },
  { note: "G", midiOffset: 7, isBlack: false, key: "b" },
  { note: "G#", midiOffset: 8, isBlack: true, key: "h" },
  { note: "A", midiOffset: 9, isBlack: false, key: "n" },
  { note: "A#", midiOffset: 10, isBlack: true, key: "j" },
  { note: "B", midiOffset: 11, isBlack: false, key: "m" },
  // Upper octave (Q row)
  { note: "C", midiOffset: 12, isBlack: false, key: "q" },
  { note: "C#", midiOffset: 13, isBlack: true, key: "2" },
  { note: "D", midiOffset: 14, isBlack: false, key: "w" },
  { note: "D#", midiOffset: 15, isBlack: true, key: "3" },
  { note: "E", midiOffset: 16, isBlack: false, key: "e" },
  { note: "F", midiOffset: 17, isBlack: false, key: "r" },
  { note: "F#", midiOffset: 18, isBlack: true, key: "5" },
  { note: "G", midiOffset: 19, isBlack: false, key: "t" },
  { note: "G#", midiOffset: 20, isBlack: true, key: "6" },
  { note: "A", midiOffset: 21, isBlack: false, key: "y" },
  { note: "A#", midiOffset: 22, isBlack: true, key: "7" },
  { note: "B", midiOffset: 23, isBlack: false, key: "u" },
  { note: "C", midiOffset: 24, isBlack: false, key: "i" },
];

/** Visible piano: 2 octaves of keys for on-screen UI */
export const PIANO_KEYS: KeyDef[] = KEYBOARD_MAP;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteMidi(octave: number, offset: number): number {
  // C of octave: MIDI 12 * (octave + 1) for scientific pitch (C4 = 60)
  return 12 * (octave + 1) + offset;
}
