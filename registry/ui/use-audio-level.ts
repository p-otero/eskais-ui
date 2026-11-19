"use client"

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react"

import { createAudioMeter, type AudioLevelFrame, type AudioMeter, type AudioMeterOptions } from "@/lib/audio-meter"

type UseAudioLevelOptions = Omit<AudioMeterOptions, "target" | "steps"> & {
  /** `false` stops sampling, as while a voice input isn't listening. */
  active?: boolean
  /** How many steps the level takes under `prefers-reduced-motion: reduce`, where bars also hold still. */
  reducedMotionSteps?: number
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(notify: () => void) {
  if (typeof matchMedia !== "function") return () => {}
  const list = matchMedia(reducedMotionQuery)
  list.addEventListener("change", notify)
  return () => list.removeEventListener("change", notify)
}

const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia(reducedMotionQuery).matches

/**
 * The microphone level of `stream`, for a visual of your own, without a React render per frame. Put `ref` on the
 * element to style: it gets `--voice-level` (0–1) and, with `bars`, `--voice-bar-0`… as custom properties. Or draw in
 * `onFrame`, or read `level()` when you need it. Sampling stops while `active` is false, the page is hidden or the
 * stream ends, and under reduced motion the level moves in a few steps.
 */
function useAudioLevel(stream: MediaStream | null | undefined, options: UseAudioLevelOptions = {}) {
  const { active = true, reducedMotionSteps = 4, bars = 0, barInterval, floorDb, ceilingDb, attack, release } = options
  const [element, setElement] = useState<HTMLElement | null>(null)
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
  const meter = useRef<AudioMeter | null>(null)
  const onFrame = useEffectEvent((frame: AudioLevelFrame) => options.onFrame?.(frame))
  const onEnd = useEffectEvent(() => options.onEnd?.())

  useEffect(() => {
    if (!stream || !active) return
    const created = createAudioMeter(stream, {
      target: element,
      bars,
      barInterval,
      floorDb,
      ceilingDb,
      attack,
      release,
      steps: reduced ? reducedMotionSteps : 0,
      onFrame: (frame) => onFrame(frame),
      onEnd: () => onEnd(),
    })
    meter.current = created
    return () => {
      created.stop()
      meter.current = null
    }
  }, [stream, active, element, bars, barInterval, floorDb, ceilingDb, attack, release, reduced, reducedMotionSteps])

  return { ref: setElement, level: () => meter.current?.level() ?? 0 }
}

export { useAudioLevel }
export type { UseAudioLevelOptions }
