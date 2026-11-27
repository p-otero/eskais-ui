import { useEffectEvent, useLayoutEffect, useState, useSyncExternalStore } from "react"

import { denyMs, motionTowards, poseAt, unlockMs, type SafeVaultMotion } from "@/components/ui/safe-vault-timeline"

type SafeVaultStatus = "locked" | "denied" | "unlocked"

/** The vault's motion, and whether its contents are open: unlocked, and done moving when the 3D safe shows it. */
type VaultMotionSnapshot = { motion: SafeVaultMotion; open: boolean }

const ignore = () => {}

const epochNow = () => performance.timeOrigin + performance.now()
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

function createVaultMotion(initial: SafeVaultStatus) {
  let status = initial
  let webgl = false
  let motion: SafeVaultMotion = {
    kind: initial === "unlocked" ? "unlocked" : "locked",
    since: 0,
  }
  let played: SafeVaultMotion | null = null
  let snapshot: VaultMotionSnapshot = { motion, open: initial === "unlocked" }
  let unlockTimer: ReturnType<typeof setTimeout> | undefined
  let denialTimer: ReturnType<typeof setTimeout> | undefined
  let onDenialPlayed = ignore
  let onRelocked = ignore
  const listeners = new Set<() => void>()

  const publish = () => {
    const open = status === "unlocked" && (!webgl || motion.kind === "unlocked" || played === motion)
    if (snapshot.motion === motion && snapshot.open === open) return
    snapshot = { motion, open }
    for (const listener of listeners) listener()
  }

  const move = (next: SafeVaultMotion, now: number) => {
    motion = next
    clearTimeout(unlockTimer)
    if (next.kind === "unlocking") {
      unlockTimer = setTimeout(
        () => {
          played = next
          publish()
        },
        Math.max(0, next.since + unlockMs - now),
      )
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot: () => snapshot,
    setStatus(next: SafeVaultStatus) {
      if (next === status) return
      const from = status
      status = next
      const now = epochNow()
      const reduce = reducedMotion()
      const current = poseAt(motion, now)
      if (next === "unlocked")
        move(reduce ? { kind: "unlocked", since: now } : motionTowards("unlocking", current, now), now)
      else if (from === "unlocked") {
        move(reduce ? { kind: "locked", since: now } : motionTowards("locking", current, now), now)
        onRelocked()
      } else if (next === "denied") move({ kind: reduce ? "locked" : "denied", since: now }, now)
      clearTimeout(denialTimer)
      if (next === "denied") denialTimer = setTimeout(() => onDenialPlayed(), reduce ? 0 : denyMs)
      publish()
    },
    setRenderer(next: boolean) {
      webgl = next
      publish()
    },
    handle(handlers: { denialPlayed: () => void; relocked: () => void }) {
      onDenialPlayed = handlers.denialPlayed
      onRelocked = handlers.relocked
    },
    dispose() {
      clearTimeout(unlockTimer)
      clearTimeout(denialTimer)
    },
  }
}

/**
 * Turns the vault's status into the motion its safe plays: unlocking (bolts, the door, the zoom onto the plaque),
 * locking, and the dial's shake when denied, at once under reduced motion. `denialPlayed` runs once the shake ends,
 * and `relocked` when an unlocked vault locks again.
 */
function useSafeVaultMotion(status: SafeVaultStatus, handlers: { denialPlayed: () => void; relocked: () => void }) {
  const [store] = useState(() => createVaultMotion(status))
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
  const denialPlayed = useEffectEvent(handlers.denialPlayed)
  const relocked = useEffectEvent(handlers.relocked)

  useLayoutEffect(() => {
    store.handle({ denialPlayed: () => denialPlayed(), relocked: () => relocked() })
    return () => store.dispose()
  }, [store])

  useLayoutEffect(() => {
    store.setStatus(status)
  }, [store, status])

  return { ...snapshot, setRenderer: store.setRenderer }
}

export { createVaultMotion, useSafeVaultMotion }
export type { SafeVaultStatus, VaultMotionSnapshot }
