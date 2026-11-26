"use client"

import { announce } from "@ui-sdk/core"
import { useCallback, useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react"

const LONGEST_TIMEOUT_MS = 2 ** 31 - 1
const SECOND_MS = 1000
const FINAL_STRETCH_S = 30
const FINAL_STEP_S = 10

const secondsLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / SECOND_MS))

function subscribeUntil(expiresAt: number, nextDelay: (leftMs: number) => number) {
  return (notify: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      timer = undefined
      notify()
      if (document.hidden) return
      const left = expiresAt - Date.now()
      if (left <= 0) return
      timer = setTimeout(arm, Math.min(nextDelay(left), LONGEST_TIMEOUT_MS))
    }
    arm()
    document.addEventListener("visibilitychange", arm)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", arm)
    }
  }
}

/**
 * Whether `expiresAt` (epoch ms) has passed, with one timeout and none while the page is hidden; coming back checks
 * the clock. Runs `onExpire` once it passes, or on mount when it already has.
 */
function useDeviceApprovalExpiry(expiresAt: number | undefined, onExpire: () => void) {
  const subscribe = useCallback(
    (notify: () => void) =>
      expiresAt === undefined ? () => undefined : subscribeUntil(expiresAt, (left) => left)(notify),
    [expiresAt],
  )
  const expired = useSyncExternalStore(
    subscribe,
    () => expiresAt !== undefined && expiresAt <= Date.now(),
    () => false,
  )
  const expire = useEffectEvent(onExpire)

  useEffect(() => {
    if (expired) expire()
  }, [expired])

  return expired
}

/** The whole seconds left until `expiresAt`, updated on each second's boundary while the page is visible. */
function useSecondsLeft(expiresAt: number) {
  const subscribe = useCallback(
    (notify: () => void) => subscribeUntil(expiresAt, (left) => left % SECOND_MS || SECOND_MS)(notify),
    [expiresAt],
  )
  return useSyncExternalStore(
    subscribe,
    () => secondsLeft(expiresAt),
    () => secondsLeft(expiresAt),
  )
}

/** Once a minute, then every ten seconds in the last thirty; `null` once it's over. */
function announcementStep(seconds: number) {
  if (seconds <= 0) return null
  if (seconds > FINAL_STRETCH_S) return Math.ceil(seconds / 60) * 60
  return Math.ceil(seconds / FINAL_STEP_S) * FINAL_STEP_S
}

/**
 * Announces the time left politely when it reaches a whole minute, and every ten seconds in the last thirty; never
 * on the first render, so a page that opens doesn't talk over itself.
 */
function useCountdownAnnouncements(seconds: number, message: ((seconds: number) => string) | undefined) {
  const step = announcementStep(seconds)
  const announced = useRef<number | null | undefined>(undefined)
  const say = useEffectEvent((at: number) => {
    if (message) announce(message(at))
  })

  useEffect(() => {
    const previous = announced.current
    announced.current = step
    if (previous === undefined || step === null || step === previous) return
    say(step)
  }, [step])
}

export { announcementStep, useCountdownAnnouncements, useDeviceApprovalExpiry, useSecondsLeft }
