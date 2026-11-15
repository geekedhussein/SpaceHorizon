// Short sound effects, made in the browser with the Web Audio API: no audio
// files to ship or fetch. Every sound follows a player action (a click starts
// the audio), and one setting mutes them all.

const MUTE_KEY = 'space-horizon.muted'
/** Overall loudness, 0 to 1. Kept low: these are cues, not music. */
const VOLUME = 0.12

let context: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'yes'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? 'yes' : 'no')
  } catch {
    // The setting then lasts this visit only.
  }
}

function audio(): AudioContext | null {
  if (muted || typeof AudioContext === 'undefined') return null
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

/** One note with a soft attack and an exponential fade. */
function note(frequency: number, startS: number, lengthS: number, type: OscillatorType = 'sine', level = 1): void {
  const ctx = audio()
  if (!ctx) return
  const at = ctx.currentTime + startS
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(VOLUME * level, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + lengthS)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(at)
  oscillator.stop(at + lengthS + 0.05)
}

/** Filtered noise that rises: the roar of engines at liftoff. */
function rumble(lengthS: number): void {
  const ctx = audio()
  if (!ctx) return
  const samples = Math.floor(ctx.sampleRate * lengthS)
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Not part of the simulation, so Math.random is fine here.
  for (let index = 0; index < samples; index++) data[index] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(120, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + lengthS)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(VOLUME * 1.6, ctx.currentTime + 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + lengthS)
  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
}

export const sound = {
  /** A part was chosen. */
  select: () => note(660, 0, 0.08, 'triangle', 0.5),
  /** One second of the countdown. */
  count: () => note(880, 0, 0.18, 'square', 0.35),
  liftoff: () => {
    note(1320, 0, 0.35, 'square', 0.35)
    rumble(2.2)
  },
  /** A star appears on the debrief; `index` 0 to 2 climbs the scale. */
  star: (index: number) => note([784, 988, 1175][index] ?? 1175, 0, 0.35, 'triangle', 0.8),
  success: () => [523, 659, 784, 1047].forEach((frequency, index) => note(frequency, index * 0.12, 0.5, 'triangle', 0.7)),
  failure: () => [392, 330, 262].forEach((frequency, index) => note(frequency, index * 0.18, 0.5, 'sine', 0.8)),
  badge: () => [1047, 1319].forEach((frequency, index) => note(frequency, index * 0.09, 0.3, 'triangle', 0.6)),
}
