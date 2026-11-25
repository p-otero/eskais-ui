import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"

type VinylSceneOptions = {
  time: number
  duration: number
  playing: boolean
  /** Called with each paint's duration in ms. */
  onPaint?: ((milliseconds: number) => void) | undefined
}

/** One turn of a record at 33⅓ rpm, in seconds. */
const secondsPerTurn = 1.8
const armRestDegrees = 19
const armSweepDegrees = 21
const maxLeadSeconds = 0.4

function paint(deck: HTMLElement | null, time: number, duration: number) {
  if (!deck) return false
  const progress = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0
  deck.style.setProperty("--vinyl-turn", `${((time / secondsPerTurn) * 360).toFixed(2)}deg`)
  deck.style.setProperty("--vinyl-arm", `${(armRestDegrees + progress * armSweepDegrees).toFixed(3)}deg`)
  deck.style.setProperty("--vinyl-progress", progress.toFixed(5))
  return true
}

/**
 * Turns the record, swings the tonearm and fills the waveform. While it plays it paints every frame, carrying the time
 * on from the last reading; paused, it paints once per change. Reduced motion paints only when the time changes.
 */
function useVinylScene(deck: RefObject<HTMLElement | null>, { time, duration, playing, onPaint }: VinylSceneOptions) {
  const readAt = useRef({ time, at: 0 })

  const paintAt = useEffectEvent((at: number, length: number) => {
    const started = performance.now()
    if (paint(deck.current, at, length)) onPaint?.(performance.now() - started)
  })

  useLayoutEffect(() => {
    readAt.current = { time, at: performance.now() }
    paintAt(time, duration)
  }, [time, duration])

  useLayoutEffect(() => {
    if (!playing || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    const step = (now: number) => {
      const reading = readAt.current
      const lead = Math.min(maxLeadSeconds, (now - reading.at) / 1000)
      paintAt(Math.min(duration || Infinity, reading.time + lead), duration)
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration])
}

export { secondsPerTurn, useVinylScene }
