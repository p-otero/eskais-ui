import { useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"

import { angleAt, readingAt } from "./prism-dial"
import { layoutFor, paintScene } from "./prism-scene"

type Canvases = {
  stage: RefObject<HTMLElement | null>
  sharp: RefObject<HTMLCanvasElement | null>
  glow: RefObject<HTMLCanvasElement | null>
}

type SceneOptions = {
  /** The dial position to show. */
  position: number
  /** Jump to it, for a drag: the pointer already moves smoothly. */
  instant: boolean
  /** Called with each paint's duration in ms, for measurements. */
  onPaint?: ((milliseconds: number) => void) | undefined
}

// The panel duration token: a key press or an agent's step glides the prism there, a drag follows the pointer.
const glideMs = 180
const ease = (t: number) => 1 - (1 - t) ** 4

function paint(canvases: Canvases, position: number, onPaint: SceneOptions["onPaint"]) {
  const stage = canvases.stage.current
  const sharpCanvas = canvases.sharp.current
  const glowCanvas = canvases.glow.current
  if (!stage || !sharpCanvas || !glowCanvas) return
  const started = performance.now()
  const width = stage.clientWidth
  const height = stage.clientHeight
  if (width < 2 || height < 2) return
  const ratio = Math.min(2, devicePixelRatio || 1)
  const sharpWidth = Math.round(width * ratio)
  const sharpHeight = Math.round(height * ratio)
  if (sharpCanvas.width !== sharpWidth) sharpCanvas.width = sharpWidth
  if (sharpCanvas.height !== sharpHeight) sharpCanvas.height = sharpHeight
  const glowWidth = Math.ceil(width / 2)
  const glowHeight = Math.ceil(height / 2)
  if (glowCanvas.width !== glowWidth) glowCanvas.width = glowWidth
  if (glowCanvas.height !== glowHeight) glowCanvas.height = glowHeight
  const sharp = sharpCanvas.getContext("2d")
  const glow = glowCanvas.getContext("2d")
  if (!sharp || !glow) return
  sharp.setTransform(ratio, 0, 0, ratio, 0, 0)
  glow.setTransform(glowWidth / width, 0, 0, glowHeight / height, 0, 0)
  const reading = readingAt(position)
  paintScene(sharp, glow, layoutFor(width, height), reading)
  // The knob follows the painted position, not the value, so it glides with the prism without a React render.
  stage.style.setProperty("--prism-dial", `${String(angleAt(position))}deg`)
  stage.style.setProperty("--prism-shown", reading.colour.hex)
  onPaint?.(performance.now() - started)
}

/** Paints the prism scene when the position or the stage's size changes, and only then: nothing runs while idle. */
function usePrismScene(canvases: Canvases, { position, instant, onPaint }: SceneOptions) {
  const shown = useRef<number | null>(null)
  const report = useEffectEvent((milliseconds: number) => onPaint?.(milliseconds))
  const repaint = useEffectEvent(() => paint(canvases, shown.current ?? position, report))

  useEffect(() => {
    const stage = canvases.stage.current
    if (!stage) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(repaint)
    })
    observer.observe(stage)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [canvases])

  // A layout effect, so a drag paints the canvas in the same frame React commits the knob and the readout.
  useLayoutEffect(() => {
    const from = shown.current
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (from === null || instant || reduced || from === position) {
      shown.current = position
      paint(canvases, position, report)
      return
    }
    const started = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / glideMs)
      shown.current = from + (position - from) * ease(t)
      paint(canvases, shown.current, report)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [canvases, position, instant])
}

export { usePrismScene }
