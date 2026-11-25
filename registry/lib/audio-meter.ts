import { barProfile, levelFromDb, rms, smoothLevel, stepLevel, toDbfs } from "@/lib/audio-level"

type AudioLevelFrame = {
  /** The smoothed level, 0–1: stepped when `steps` is set. */
  level: number
  /** The bars, oldest first, 0–1. The same array every call: read it during the call, don't keep it. */
  bars: readonly number[]
}

type AudioMeterOptions = {
  /** Gets `--voice-level` and, with `bars`, `--voice-bar-0`… as inline custom properties; nothing re-renders. */
  target?: HTMLElement | null
  /** How many recent levels to keep as bars, newest last: a waveform that moves along. 0 keeps none. */
  bars?: number
  /** Milliseconds between two bars. */
  barInterval?: number
  /** dBFS that reads as 0: the room's hiss. */
  floorDb?: number
  /** dBFS that reads as 1: a raised voice. */
  ceilingDb?: number
  /** Milliseconds the level takes to rise most of the way to a louder sound. */
  attack?: number
  /** Milliseconds the level takes to fall most of the way back. */
  release?: number
  /** Rounds the level to this many steps and holds the bars still, for reduced motion. 0 is continuous. */
  steps?: number
  /** Runs on every frame whose level or bars changed, to draw on a canvas or anywhere else. */
  onFrame?: (frame: AudioLevelFrame) => void
  /** Runs once when the stream's audio ends, like a track stopped or a device unplugged. */
  onEnd?: () => void
}

type AudioMeter = {
  /** The latest level, 0–1. */
  level: () => number
  /** Stops sampling, disconnects its nodes and releases the shared AudioContext. Safe to call twice. */
  stop: () => void
}

type AudioContextClass = new () => AudioContext

// Spec: browsers cap how many AudioContexts can run, and each one holds an audio thread.
let shared: AudioContext | undefined
let holders = 0
let primeTimer: ReturnType<typeof setTimeout> | undefined
let stopGestureResume: (() => void) | undefined
const primeHoldMs = 10_000

function audioContextClass() {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextClass }
  return scope.AudioContext ?? scope.webkitAudioContext
}

// Spec: autoplay rules start a context created outside a user gesture suspended.
function resumeOnGesture(context: AudioContext) {
  if (stopGestureResume || typeof document === "undefined") return
  const events = ["pointerdown", "keydown", "touchend"] as const
  const resume = () => {
    if (context.state === "suspended") context.resume().catch(() => {})
  }
  const settle = () => {
    if (context.state !== "suspended") stopGestureResume?.()
  }
  for (const type of events) document.addEventListener(type, resume, { capture: true })
  context.addEventListener("statechange", settle)
  stopGestureResume = () => {
    for (const type of events) document.removeEventListener(type, resume, { capture: true })
    context.removeEventListener("statechange", settle)
    stopGestureResume = undefined
  }
}

function acquireAudioContext() {
  const Context = audioContextClass()
  if (!Context) return undefined
  if (!shared || shared.state === "closed") shared = new Context()
  holders += 1
  if (shared.state === "suspended") {
    shared.resume().catch(() => {})
    resumeOnGesture(shared)
  }
  return shared
}

function releaseAudioContext() {
  holders = Math.max(0, holders - 1)
  if (holders > 0 || !shared) return
  const context = shared
  shared = undefined
  stopGestureResume?.()
  context.close().catch(() => {})
}

function releasePrime() {
  if (primeTimer === undefined) return
  clearTimeout(primeTimer)
  primeTimer = undefined
  releaseAudioContext()
}

/**
 * Creates or resumes the shared AudioContext inside a user gesture, like the press that starts listening: Safari only
 * lets a context run when it starts there. The first meter takes it over; unused, it closes after ten seconds.
 */
function primeAudioContext() {
  if (primeTimer !== undefined) return
  if (!acquireAudioContext()) return
  primeTimer = setTimeout(releasePrime, primeHoldMs)
}

/** How many meters hold the shared AudioContext, and its state: for tests and debugging. */
function audioContextStatus() {
  return { holders, state: shared?.state ?? "closed" }
}

const live = (track: MediaStreamTrack) => track.readyState !== "ended"
const hasAudio = (stream: MediaStream) => stream.getAudioTracks().some(live)

/**
 * Samples a stream's loudness on animation frames through an `AnalyserNode` on the shared AudioContext: RMS, then
 * dBFS, then a 0–1 level with attack and release. It writes custom properties on `target` rather than setting state,
 * pauses (and releases the context) while the page is hidden, and stops by itself when the stream's audio ends.
 */
function createAudioMeter(stream: MediaStream, options: AudioMeterOptions = {}): AudioMeter {
  const { target, barInterval = 70, floorDb = -60, ceilingDb = -12, attack = 30, release = 250, steps = 0 } = options
  const barCount = Math.max(0, Math.floor(options.bars ?? 0))
  const bars = Array.from<number>({ length: barCount }).fill(0)
  const tracks = stream.getAudioTracks()
  let context: AudioContext | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let analyser: AnalyserNode | undefined
  let samples = new Float32Array(0)
  let frame = 0
  let last = 0
  let level = 0
  let shown = -1
  let peak = 0
  let sinceBar = 0
  let stopped = false

  const write = (name: string, value: number) => target?.style.setProperty(name, value.toFixed(3))
  const clear = () => {
    target?.style.removeProperty("--voice-level")
    for (let index = 0; index < barCount; index += 1) target?.style.removeProperty(`--voice-bar-${String(index)}`)
  }

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    if (!analyser) return
    // Workaround: `track.stop()` fires no "ended" on the track, and only Chromium fires "inactive" on the stream.
    if (!tracks.some(live)) {
      onTrackEnded()
      return
    }
    const elapsed = last === 0 ? 16 : Math.min(now - last, 250)
    last = now
    analyser.getFloatTimeDomainData(samples)
    level = smoothLevel(level, levelFromDb(toDbfs(rms(samples)), floorDb, ceilingDb), elapsed, attack, release)
    const next = stepLevel(level, steps)
    const levelChanged = steps > 0 ? next !== shown : Math.abs(next - shown) >= 0.004
    let barsChanged = false
    if (barCount > 0 && steps > 0) {
      barsChanged = levelChanged
      if (barsChanged)
        for (let index = 0; index < barCount; index += 1) bars[index] = next * barProfile(index, barCount)
    } else if (barCount > 0) {
      peak = Math.max(peak, level)
      sinceBar += elapsed
      if (sinceBar >= barInterval) {
        bars.shift()
        bars.push(peak)
        peak = 0
        sinceBar %= barInterval
        barsChanged = true
      }
    }
    if (levelChanged) {
      shown = next
      write("--voice-level", next)
    }
    if (barsChanged)
      for (let index = 0; index < barCount; index += 1) write(`--voice-bar-${String(index)}`, bars[index] ?? 0)
    if (levelChanged || barsChanged) options.onFrame?.({ level: shown, bars })
  }

  const attach = () => {
    if (stopped || analyser || document.visibilityState === "hidden") return
    context = acquireAudioContext()
    releasePrime()
    if (!context) return
    analyser = context.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0
    source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    samples = new Float32Array(analyser.fftSize)
    last = 0
    frame = requestAnimationFrame(tick)
  }

  const detach = () => {
    cancelAnimationFrame(frame)
    frame = 0
    source?.disconnect()
    analyser?.disconnect()
    source = undefined
    analyser = undefined
    if (context) {
      context = undefined
      releaseAudioContext()
    }
    level = 0
    peak = 0
    sinceBar = 0
    shown = -1
    bars.fill(0)
    clear()
  }

  const onVisibility = () => (document.visibilityState === "hidden" ? detach() : attach())

  const stop = () => {
    if (stopped) return
    stopped = true
    detach()
    document.removeEventListener("visibilitychange", onVisibility)
    stream.removeEventListener("inactive", onTrackEnded)
    stream.removeEventListener("removetrack", onTrackEnded)
    for (const track of tracks) track.removeEventListener("ended", onTrackEnded)
  }

  function onTrackEnded() {
    if (stopped || hasAudio(stream)) return
    stop()
    options.onEnd?.()
  }

  if (!hasAudio(stream)) {
    stopped = true
  } else {
    document.addEventListener("visibilitychange", onVisibility)
    stream.addEventListener("inactive", onTrackEnded)
    stream.addEventListener("removetrack", onTrackEnded)
    for (const track of tracks) track.addEventListener("ended", onTrackEnded)
    attach()
  }

  return { level: () => (stopped ? 0 : level), stop }
}

export { audioContextStatus, createAudioMeter, primeAudioContext }
export type { AudioLevelFrame, AudioMeter, AudioMeterOptions }
