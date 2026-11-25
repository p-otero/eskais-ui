import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"

import { sceneAt, type SunArcLocate } from "@/components/ui/sun-arc-scene"
import type { SolarPlace } from "@/components/ui/sun-arc-solar"

type SunArcSceneOptions = {
  place: SolarPlace
  /** Where the sun sits on the stage; a new one repaints. */
  locate: SunArcLocate
  minutes: number
  /** Jump to it, for a drag or a key: the pointer and the key already move in small steps. */
  instant: boolean
  /** Called with each paint's duration in ms. */
  onPaint?: ((milliseconds: number) => void) | undefined
}

const glideMs = 420
const glideAboveMinutes = 30
const ease = (t: number) => 1 - (1 - t) ** 3

// Perf: a custom property set to the value it holds still restyles every element under the stage, so only changes go out.
function paint(
  stage: HTMLElement | null,
  written: Map<string, string>,
  place: SolarPlace,
  locate: SunArcLocate,
  minutes: number,
) {
  if (!stage) return false
  const { vars, out } = sceneAt(place, locate, minutes)
  for (const [name, value] of Object.entries(vars)) {
    if (written.get(name) === value) continue
    written.set(name, value)
    stage.style.setProperty(name, value)
  }
  if (stage.dataset.sunOut !== out) {
    if (out) stage.dataset.sunOut = out
    else delete stage.dataset.sunOut
  }
  return true
}

/** Paints the sky, the light and the sun when the time or the day changes, and only then: nothing runs while idle. */
function useSunArcScene(
  stage: RefObject<HTMLElement | null>,
  { place, locate, minutes, instant, onPaint }: SunArcSceneOptions,
) {
  const shown = useRef<number | null>(null)
  const written = useRef(new Map<string, string>())

  const paintAt = useEffectEvent((at: number, day: SolarPlace, locator: SunArcLocate) => {
    const started = performance.now()
    if (paint(stage.current, written.current, day, locator, at)) onPaint?.(performance.now() - started)
  })

  useLayoutEffect(() => {
    const from = shown.current
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (from === null || instant || reduced || Math.abs(minutes - from) <= glideAboveMinutes) {
      shown.current = minutes
      paintAt(minutes, place, locate)
      return
    }
    const started = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / glideMs)
      shown.current = from + (minutes - from) * ease(t)
      paintAt(shown.current, place, locate)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [minutes, instant, place, locate])
}

export { useSunArcScene }
