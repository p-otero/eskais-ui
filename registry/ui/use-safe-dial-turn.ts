import { useEffect, useRef, type RefObject } from "react"

const glideMs = 160
const ease = (t: number) => 1 - (1 - t) ** 3

// Perf: the dial turns from requestAnimationFrame rather than a CSS transition. A transition still running when a key
// comes up leaves style pending, and React reads the focused range input's selection on every keyup, which then
// recalculates style; a frame's write is painted in that frame, so nothing is pending between frames.
/** Turns the dial's face to an angle in degrees: gliding there for a key or a release, at once for a drag. */
function useSafeDialTurn(rotor: RefObject<HTMLElement | null>) {
  const shown = useRef(0)
  const target = useRef(0)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const write = (degrees: number) => {
    shown.current = degrees
    rotor.current?.style.setProperty("--safe-dial-turn", `${degrees.toFixed(2)}deg`)
  }

  const turnTo = (degrees: number, glide: boolean) => {
    target.current = degrees
    cancelAnimationFrame(frame.current)
    if (!glide || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      write(degrees)
      return
    }
    const from = shown.current
    const started = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / glideMs)
      write(from + (degrees - from) * ease(t))
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }

  return { turnTo, target }
}

export { useSafeDialTurn }
