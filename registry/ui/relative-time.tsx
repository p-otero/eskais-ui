"use client"

import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { useEffect, useState } from "react"

import { formatInstant, formatRelative, toISO, toTime, type Instant } from "@/lib/time"
import { cn } from "@/lib/utils"

interface UseNowOptions {
  now?: Instant
  intervalMs?: number
}

function useNow({ now, intervalMs = 30_000 }: UseNowOptions = {}) {
  const fixed = now === undefined ? undefined : toTime(now)
  const [tick, setTick] = useState(() => fixed ?? Date.now())

  useEffect(() => {
    if (fixed !== undefined) return
    let timer: ReturnType<typeof setInterval> | undefined
    const update = () => setTick(Date.now())
    const stop = () => {
      clearInterval(timer)
      timer = undefined
    }
    const start = () => {
      stop()
      if (!document.hidden) timer = setInterval(update, intervalMs)
    }
    const onVisibilityChange = () => {
      if (document.hidden) return stop()
      update()
      start()
    }
    // The first render may come from the server, so resync once mounted.
    update()
    start()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [fixed, intervalMs])

  return fixed ?? tick
}

type RelativeTimeProps = Omit<PartProps<"time">, "children" | "dateTime"> & {
  value: Instant
  now?: Instant
  locale?: string
  timeZone?: string
  intervalMs?: number
  /** "short" ("2 min. ago") or "narrow" where space is tight; "long" by default. */
  formatStyle?: Intl.RelativeTimeFormatStyle
}

function RelativeTime({
  value,
  now,
  locale,
  timeZone,
  intervalMs,
  formatStyle,
  className,
  render,
  ...props
}: RelativeTimeProps) {
  const current = useNow({ now, intervalMs })
  return renderElement(
    "time",
    {
      "data-slot": "relative-time",
      dateTime: toISO(value),
      title: formatInstant(value, { locale, timeZone }),
      className: cn("tabular-nums", className),
      // Server and browser differ in clock and time zone; the effect in useNow resyncs the text.
      suppressHydrationWarning: true,
      ...props,
      children: formatRelative(value, { now: current, locale, style: formatStyle }),
    },
    render,
  )
}

export { RelativeTime, useNow }
export type { RelativeTimeProps, UseNowOptions }
