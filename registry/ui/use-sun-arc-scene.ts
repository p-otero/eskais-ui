import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"

import { sceneVars } from "@/components/ui/sun-arc-scene"
import type { SolarPlace } from "@/components/ui/sun-arc-solar"

type SunArcSceneOptions = {
  place: SolarPlace
  scale: number
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
  scale: number,
  minutes: number,
) {
  if (!stage) return false
  for (const [name, value] of Object.entries(sceneVars(place, scale, minutes))) {
    if (written.get(name) === value) continue
    written.set(name, value)
    stage.style.setProperty(name, value)
  }
  return true
}

/** Paints the sky, the light and the sun when the time or the day changes, and only then: nothing runs while idle. */
function useSunArcScene(
  stage: RefObject<HTMLElement | null>,
  { place, scale, minutes, instant, onPaint }: SunArcSceneOptions,
) {
  const shown = useRef<number | null>(null)
  const written = useRef(new Map<string, string>())

  const paintAt = useEffectEvent((at: number, day: SolarPlace, dome: number) => {
    const started = performance.now()
    if (paint(stage.current, written.current, day, dome, at)) onPaint?.(performance.now() - started)
  })

  useLayoutEffect(() => {
    const from = shown.current
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (from === null || instant || reduced || Math.abs(minutes - from) <= glideAboveMinutes) {
      shown.current = minutes
      paintAt(minutes, place, scale)
      return
    }
    const started = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / glideMs)
      shown.current = from + (minutes - from) * ease(t)
      paintAt(shown.current, place, scale)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [minutes, instant, place, scale])
}

export { useSunArcScene }
