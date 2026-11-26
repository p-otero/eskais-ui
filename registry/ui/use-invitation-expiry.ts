"use client"

import { useCallback, useEffect, useEffectEvent, useSyncExternalStore } from "react"

type ExpiryPhase = "later" | "soon" | "expired"

const SOON_MS = 120_000
const LONGEST_TIMEOUT_MS = 2 ** 31 - 1

function phaseAt(expiresAt: number, now: number): ExpiryPhase {
  const left = expiresAt - now
  if (left <= 0) return "expired"
  return left <= SOON_MS ? "soon" : "later"
}

/**
 * Runs `onExpire` once `expiresAt` (epoch ms) passes, with one timeout per boundary and none while the page is hidden;
 * coming back checks the clock again. `soon` is true in the last two minutes, for a countdown by the second.
 */
function useInvitationExpiry(expiresAt: number, onExpire: () => void) {
  const subscribe = useCallback(
    (notify: () => void) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const arm = () => {
        clearTimeout(timer)
        timer = undefined
        notify()
        if (document.hidden) return
        const left = expiresAt - Date.now()
        if (left <= 0) return
        const nextBoundary = left > SOON_MS ? left - SOON_MS : left
        timer = setTimeout(arm, Math.min(nextBoundary, LONGEST_TIMEOUT_MS))
      }
      arm()
      document.addEventListener("visibilitychange", arm)
      return () => {
        clearTimeout(timer)
        document.removeEventListener("visibilitychange", arm)
      }
    },
    [expiresAt],
  )
  const phase = useSyncExternalStore(
    subscribe,
    () => phaseAt(expiresAt, Date.now()),
    (): ExpiryPhase => "later",
  )
  const expire = useEffectEvent(onExpire)

  useEffect(() => {
    if (phase === "expired") expire()
  }, [phase])

  return { soon: phase === "soon", expired: phase === "expired" }
}

export { useInvitationExpiry }
