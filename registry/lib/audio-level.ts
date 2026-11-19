/** dBFS reported for digital silence, where the logarithm has no value. */
const silenceDb = -100

/** The root mean square of samples in -1…1, like an `AnalyserNode`'s `getFloatTimeDomainData`. */
function rms(samples: ArrayLike<number>) {
  if (samples.length === 0) return 0
  let sum = 0
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0
    sum += sample * sample
  }
  return Math.sqrt(sum / samples.length)
}

/** An RMS amplitude in decibels relative to full scale: 1 is 0 dBFS, silence is `silenceDb`. */
function toDbfs(amplitude: number) {
  if (!(amplitude > 0)) return silenceDb
  return Math.max(silenceDb, 20 * Math.log10(amplitude))
}

/**
 * A loudness in dBFS as a 0–1 level that tracks how loud it sounds: linear in decibels between `floorDb` (0, the room's
 * hiss) and `ceilingDb` (1, a raised voice). Speech close to a laptop microphone sits around -40 to -15 dBFS.
 */
function levelFromDb(db: number, floorDb = -60, ceilingDb = -12) {
  if (ceilingDb <= floorDb) return db >= ceilingDb ? 1 : 0
  return Math.min(1, Math.max(0, (db - floorDb) / (ceilingDb - floorDb)))
}

/**
 * Moves `previous` toward `target` with an attack (rising) and a release (falling) time constant in milliseconds, so a
 * level jumps up with a syllable and falls back gently, the same at 60 or 120 frames a second.
 */
function smoothLevel(previous: number, target: number, elapsedMs: number, attackMs: number, releaseMs: number) {
  const constant = target > previous ? attackMs : releaseMs
  if (constant <= 0 || elapsedMs <= 0) return elapsedMs <= 0 ? previous : target
  const factor = 1 - Math.exp(-elapsedMs / constant)
  return previous + (target - previous) * factor
}

/** A level rounded to one of `steps` levels above 0, for reduced motion: it changes a few times, not every frame. */
function stepLevel(level: number, steps: number) {
  if (steps <= 0) return level
  return Math.round(Math.min(1, Math.max(0, level)) * steps) / steps
}

/** A fixed hump across `count` bars, tallest in the middle, that a stepped level scales under reduced motion. */
function barProfile(index: number, count: number) {
  if (count <= 1) return 1
  return 0.5 + 0.5 * Math.sin((Math.PI * (index + 0.5)) / count)
}

/** Seconds as `m:ss`, or `h:mm:ss` from an hour: digits and colons, the same in any language. */
function formatElapsed(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, "0")
  return hours > 0 ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${rest}` : `${String(minutes)}:${rest}`
}

/** The ISO 8601 duration of `formatElapsed`'s seconds, for a `<time dateTime>`. */
function elapsedDateTime(totalSeconds: number) {
  return `PT${String(Math.max(0, Math.floor(totalSeconds)))}S`
}

export { barProfile, elapsedDateTime, formatElapsed, levelFromDb, rms, silenceDb, smoothLevel, stepLevel, toDbfs }
