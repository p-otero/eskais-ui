"use client"

import { useCountdownAnnouncements, useSecondsLeft } from "@/components/ui/use-expiry"
import { cn } from "@/lib/utils"

/** The time left, from the milliseconds left and the same as `m:ss` (`h:mm:ss` past an hour). */
type ExpiresInText = (remainingMs: number, formatted: string) => string

type ExpiryCountdownProps = {
  /** When it expires, in epoch milliseconds. */
  expiresAt: number
  expiresIn: ExpiresInText
  className?: string
  "data-slot"?: string
}

function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, "0")
  return hours > 0 ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${rest}` : `${String(minutes)}:${rest}`
}

/**
 * The time left in a `role="timer"`, shown each second and announced politely once a minute and at 30, 20 and 10
 * seconds; one timeout per second while the page is visible, none while it's hidden.
 */
function ExpiryCountdown({
  expiresAt,
  expiresIn,
  className,
  "data-slot": slot = "expiry-countdown",
}: ExpiryCountdownProps) {
  const seconds = useSecondsLeft(expiresAt)
  useCountdownAnnouncements(seconds, (at) => expiresIn(at * 1000, formatRemaining(at)))
  return (
    <p
      role="timer"
      data-slot={slot}
      className={cn("flex items-center gap-inline text-body-sm text-muted-foreground tabular-nums", className)}
    >
      {expiresIn(seconds * 1000, formatRemaining(seconds))}
    </p>
  )
}

export { ExpiryCountdown, formatRemaining }
export type { ExpiresInText, ExpiryCountdownProps }
