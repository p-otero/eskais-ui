const openDegrees = 100

/**
 * What the vault is doing since `since` (ms since the epoch). `locked` and `unlocked` rest; `unlocking`, `locking` and
 * `denied` play once and then rest locked, unlocked and locked.
 */
type SafeVaultMotion = {
  kind: "locked" | "unlocking" | "unlocked" | "locking" | "denied"
  since: number
}

/** The moving parts at a moment: bolts from out (0) to in (1), the door's swing, the interior light and the zoom. */
type Pose = {
  bolts: number
  doorDegrees: number
  light: number
  zoom: number
  wobbleDegrees: number
}

const unlockTimes = { bolts: 450, pause: 220, door: 1150, zoom: 1000 }
const lockTimes = { zoom: 600, door: 900, bolts: 350 }
const denyMs = 520
const unlockMs = unlockTimes.bolts + unlockTimes.pause + unlockTimes.door + unlockTimes.zoom
const lockMs = lockTimes.zoom + lockTimes.door + lockTimes.bolts

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const overshoot = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const phase = (elapsed: number, start: number, length: number) => clamp01((elapsed - start) / length)

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

const motionLength = (kind: SafeVaultMotion["kind"]) =>
  kind === "unlocking" ? unlockMs : kind === "locking" ? lockMs : kind === "denied" ? denyMs : 0

/** Whether a motion has played out at `now` (ms since the epoch), so nothing moves until the next one. */
const motionDone = (motion: SafeVaultMotion, now: number) => now - motion.since >= motionLength(motion.kind)

function unlockingPose(elapsed: number): Pose {
  const doorStart = unlockTimes.bolts + unlockTimes.pause
  const door = phase(elapsed, doorStart, unlockTimes.door)
  return {
    bolts: easeInOut(phase(elapsed, 0, unlockTimes.bolts)),
    doorDegrees: door === 0 ? 0 : openDegrees * overshoot(door),
    light: clamp01(door * 1.6),
    zoom: phase(elapsed, doorStart + unlockTimes.door, unlockTimes.zoom),
    wobbleDegrees: 0,
  }
}

function lockingPose(elapsed: number): Pose {
  const door = easeInOut(phase(elapsed, lockTimes.zoom, lockTimes.door))
  return {
    bolts: 1 - easeInOut(phase(elapsed, lockTimes.zoom + lockTimes.door, lockTimes.bolts)),
    doorDegrees: openDegrees * (1 - door),
    light: 1 - door,
    zoom: 1 - phase(elapsed, 0, lockTimes.zoom),
    wobbleDegrees: 0,
  }
}

/** The moving parts at `now` (ms since the epoch). */
function poseAt(motion: SafeVaultMotion, now: number): Pose {
  const elapsed = Math.max(0, now - motion.since)
  if (motion.kind === "unlocking") return unlockingPose(elapsed)
  if (motion.kind === "locking") return lockingPose(elapsed)
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

/**
 * The motion that takes the vault to `kind` from where `current` has it at `now`: an unlock that starts while the door
 * still closes picks up from the door's angle rather than slamming it shut first, and the other way round.
 */
function motionTowards(kind: "unlocking" | "locking", current: Pose, now: number): SafeVaultMotion {
  const { bolts, doorDegrees, zoom } = current
  const door = clamp01(doorDegrees / openDegrees)
  const elapsed =
    kind === "unlocking"
      ? bolts < 1
        ? bolts * unlockTimes.bolts
        : door < 1
          ? unlockTimes.bolts + unlockTimes.pause + door * unlockTimes.door
          : unlockTimes.bolts + unlockTimes.pause + unlockTimes.door + zoom * unlockTimes.zoom
      : zoom > 0
        ? (1 - zoom) * lockTimes.zoom
        : door > 0
          ? lockTimes.zoom + (1 - door) * lockTimes.door
          : lockTimes.zoom + lockTimes.door + (1 - bolts) * lockTimes.bolts
  return { kind, since: now - elapsed }
}

export { denyMs, lockedPose, lockMs, motionDone, motionTowards, openDegrees, poseAt, unlockedPose, unlockMs }
export type { Pose, SafeVaultMotion }
