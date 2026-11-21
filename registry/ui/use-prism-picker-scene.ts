import { useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"

import { angleAt, readingAt } from "@/components/ui/prism-picker-dial"
import { layoutFor, paintScene } from "@/components/ui/prism-picker-scene"

type PrismCanvases = {
  stage: RefObject<HTMLElement | null>
  sharp: RefObject<HTMLCanvasElement | null>
  glow: RefObject<HTMLCanvasElement | null>
}

type SceneOptions = {
  /** The wavelength to show. */
  wavelength: number
  /** Jump to it, for a drag: the pointer already moves smoothly. */
  instant: boolean
  /** Called with each paint's duration in ms. */
  onPaint?: ((milliseconds: number) => void) | undefined
}

type Size = { width: number; height: number }

// The panel duration token: a key press or an agent's step glides the prism there, a drag follows the pointer.
const glideMs = 180
const ease = (t: number) => 1 - (1 - t) ** 4

// The size comes from the ResizeObserver, never from the element, so a paint inside a layout effect, right after
// React wrote the DOM, doesn't force a layout.
function paint(canvases: PrismCanvases, size: Size | null, wavelength: number) {
  const stage = canvases.stage.current
  const sharpCanvas = canvases.sharp.current
  const glowCanvas = canvases.glow.current
  if (!stage || !sharpCanvas || !glowCanvas || !size || size.width < 2 || size.height < 2) return false
  const { width, height } = size
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
  if (!sharp || !glow) return false
  sharp.setTransform(ratio, 0, 0, ratio, 0, 0)
  glow.setTransform(glowWidth / width, 0, 0, glowHeight / height, 0, 0)
  const reading = readingAt(wavelength)
  paintScene(sharp, glow, layoutFor(width, height), reading)
  // The knob follows the painted wavelength, not the value, so it glides with the prism without a React render.
  stage.style.setProperty("--prism-dial", `${String(angleAt(wavelength))}deg`)
  stage.style.setProperty("--prism-shown", reading.colour.hex)
  return true
}

/** Paints the prism scene when the wavelength or the stage's size changes, and only then: nothing runs while idle. */
function usePrismPickerScene(canvases: PrismCanvases, { wavelength, instant, onPaint }: SceneOptions) {
  const shown = useRef<number | null>(null)
  const size = useRef<Size | null>(null)

  const paintAt = useEffectEvent((at: number) => {
    const started = performance.now()
    if (paint(canvases, size.current, at)) onPaint?.(performance.now() - started)
  })
  const repaint = useEffectEvent(() => paintAt(shown.current ?? wavelength))

  useEffect(() => {
    const stage = canvases.stage.current
    if (!stage) return
    let frame = 0
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      size.current = { width: entry.contentRect.width, height: entry.contentRect.height }
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
    if (from === null || instant || reduced || from === wavelength) {
      shown.current = wavelength
      paintAt(wavelength)
      return
    }
    // The first frame paints where the glide starts, over the knob position React just rendered for its end.
    paintAt(from)
    const started = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / glideMs)
      shown.current = from + (wavelength - from) * ease(t)
      paintAt(shown.current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [wavelength, instant])
}

export { usePrismPickerScene }
export type { PrismCanvases }
