const openDegrees = 100

/** The moving parts at a moment: bolts from out (0) to in (1), the door's swing, the interior light and the zoom. */
type Pose = {
  bolts: number
  doorDegrees: number
  light: number
  zoom: number
  wobbleDegrees: number
}

/**
 * What the vault is doing since `since` (ms since the epoch), starting from the pose `from`. `locked` and `unlocked`
 * rest; `unlocking`, `locking` and `denied` play once and then rest locked, unlocked and locked. An unlock or a lock
 * that interrupts another starts from where that one had the vault, so nothing jumps.
 */
type SafeVaultMotion = {
  kind: "locked" | "unlocking" | "unlocked" | "locking" | "denied"
  since: number
  from: Pose
}

const unlockTimes = { bolts: 450, pause: 220, door: 1150, zoom: 1000 }
const lockTimes = { zoom: 600, door: 900, bolts: 350 }
const denyMs = 520
const unlockMs = unlockTimes.bolts + unlockTimes.pause + unlockTimes.door + unlockTimes.zoom
const lockMs = lockTimes.zoom + lockTimes.door + lockTimes.bolts

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const overshoot = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

const lockedPose: Pose = {
  bolts: 0,
  doorDegrees: 0,
  light: 0,
  zoom: 0,
  wobbleDegrees: 0,
}
const unlockedPose: Pose = {
  bolts: 1,
  doorDegrees: openDegrees,
  light: 1,
  zoom: 1,
  wobbleDegrees: 0,
}

const phase = (elapsed: number, start: number, length: number) =>
  length <= 0 ? (elapsed >= start ? 1 : 0) : clamp01((elapsed - start) / length)

function unlockPhases(from: Pose) {
  const bolts = unlockTimes.bolts * (1 - from.bolts)
  const pause = from.doorDegrees > 0 ? 0 : unlockTimes.pause
  const door = unlockTimes.door * clamp01(1 - from.doorDegrees / openDegrees)
  const zoom = unlockTimes.zoom * (1 - from.zoom)
  return { bolts, doorStart: bolts + pause, door, zoomStart: bolts + pause + door, zoom }
}

function lockPhases(from: Pose) {
  const zoom = lockTimes.zoom * from.zoom
  const door = lockTimes.door * clamp01(from.doorDegrees / openDegrees)
  const bolts = lockTimes.bolts * from.bolts
  return { zoom, door, boltsStart: zoom + door, bolts }
}

function motionLength({ kind, from }: SafeVaultMotion) {
  if (kind === "unlocking") {
    const { zoomStart, zoom } = unlockPhases(from)
    return zoomStart + zoom
  }
  if (kind === "locking") {
    const { boltsStart, bolts } = lockPhases(from)
    return boltsStart + bolts
  }
  return kind === "denied" ? denyMs : 0
}

/** Whether a motion has played out at `now` (ms since the epoch), so nothing moves until the next one. */
const motionDone = (motion: SafeVaultMotion, now: number) => now - motion.since >= motionLength(motion)

const towards = (from: number, to: number, t: number) => from + (to - from) * t

function unlockingPose(from: Pose, elapsed: number): Pose {
  const times = unlockPhases(from)
  const door = phase(elapsed, times.doorStart, times.door)
  return {
    bolts: towards(from.bolts, 1, easeInOut(phase(elapsed, 0, times.bolts))),
    doorDegrees: towards(from.doorDegrees, openDegrees, door === 0 ? 0 : overshoot(door)),
    light: towards(from.light, 1, clamp01(door * 1.6)),
    zoom: towards(from.zoom, 1, phase(elapsed, times.zoomStart, times.zoom)),
    wobbleDegrees: 0,
  }
}

function lockingPose(from: Pose, elapsed: number): Pose {
  const times = lockPhases(from)
  const door = easeInOut(phase(elapsed, times.zoom, times.door))
  return {
    bolts: towards(from.bolts, 0, easeInOut(phase(elapsed, times.boltsStart, times.bolts))),
    doorDegrees: towards(from.doorDegrees, 0, door),
    light: towards(from.light, 0, door),
    zoom: towards(from.zoom, 0, phase(elapsed, 0, times.zoom)),
    wobbleDegrees: 0,
  }
}

/** The moving parts at `now` (ms since the epoch). */
function poseAt(motion: SafeVaultMotion, now: number): Pose {
  const elapsed = Math.max(0, now - motion.since)
  if (motion.kind === "unlocking") return unlockingPose(motion.from, elapsed)
  if (motion.kind === "locking") return lockingPose(motion.from, elapsed)
  if (motion.kind === "unlocked") return unlockedPose
  if (motion.kind === "denied" && elapsed < denyMs) {
    const t = elapsed / denyMs
    return {
      ...lockedPose,
      wobbleDegrees: Math.sin(t * Math.PI * 7) * 5 * (1 - t),
    }
  }
  return lockedPose
}

/** A vault at rest, locked or unlocked, since `since`. */
const resting = (kind: "locked" | "unlocked", since: number): SafeVaultMotion => ({
  kind,
  since,
  from: kind === "locked" ? lockedPose : unlockedPose,
})

/** The motion that takes the vault to `kind` from the pose `current` has it in at `now`, with no jump. */
function motionTowards(kind: "unlocking" | "locking" | "denied", current: Pose, now: number): SafeVaultMotion {
  return { kind, since: now, from: { ...current, wobbleDegrees: 0 } }
}

export {
  denyMs,
  lockedPose,
  lockMs,
  motionDone,
  motionLength,
  motionTowards,
  openDegrees,
  poseAt,
  resting,
  unlockedPose,
  unlockMs,
}
export type { Pose, SafeVaultMotion }
