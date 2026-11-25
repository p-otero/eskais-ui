"use client"

import { useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import type { RetroTvPhosphor } from "@/components/ui/retro-tv"
import { cn, cssVars } from "@/lib/utils"

const collapseMs = 520
const dotFadeMs = 900
const reducedFadeMs = 240

type TvPowerOffProps = {
  /** Plays the transition over the whole page while `true`, and keeps the screen black once it ends. */
  playing: boolean
  /** The colour of the last line and dot: `white` by default. */
  phosphor?: RetroTvPhosphor
  className?: string
}

/**
 * A tube TV switching off over the whole page: the picture closes to a bright line, the line to a dot, and the dot
 * fades on black. Under reduced motion the page fades to black. Rendered into `document.body`, above everything.
 */
function TvPowerOff({ playing, phosphor = "white", className }: TvPowerOffProps) {
  if (!playing || typeof document === "undefined") return null
  return createPortal(
    <div
      data-slot="tv-power-off"
      data-phosphor={phosphor}
      aria-hidden="true"
      className={cn(className)}
      style={cssVars({
        "--tv-power-off-collapse": `${String(collapseMs)}ms`,
        "--tv-power-off-dot": `${String(dotFadeMs)}ms`,
        "--tv-power-off-fade": `${String(reducedFadeMs)}ms`,
      })}
    >
      <span data-slot="tv-power-off-beam" />
      <span data-slot="tv-power-off-dot" />
    </div>,
    document.body,
  )
}

type TvPowerOffOptions = { phosphor?: RetroTvPhosphor }

type TvPowerOffControls = {
  /** Whether the transition is on the page. */
  playing: boolean
  /** Plays the transition; resolves once the screen is black, for navigating after, like on "log out". */
  powerOff: () => Promise<void>
  /** Takes the black screen away again, when the page stays. */
  reset: () => void
  /** Render it once, anywhere in the app. */
  overlay: ReactNode
}

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

/** The page-wide power-off: render `overlay`, then `await powerOff()` before navigating. */
function useTvPowerOff({ phosphor }: TvPowerOffOptions = {}): TvPowerOffControls {
  const [playing, setPlaying] = useState(false)
  const powerOff = () => {
    setPlaying(true)
    const durationMs = prefersReducedMotion() ? reducedFadeMs : collapseMs + dotFadeMs
    return new Promise<void>((done) => setTimeout(done, durationMs))
  }
  return {
    playing,
    powerOff,
    reset: () => setPlaying(false),
    overlay: <TvPowerOff playing={playing} phosphor={phosphor} />,
  }
}

export { TvPowerOff, useTvPowerOff }
export type { TvPowerOffControls, TvPowerOffOptions, TvPowerOffProps }
