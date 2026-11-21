import { useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react"

import { angleAt, readingAt } from "@/components/ui/prism-picker-dial"
import { layoutFor, paintScene } from "@/components/ui/prism-picker-scene"

type PrismCanvases = {
  stage: RefObject<HTMLElement | null>
  light: RefObject<HTMLCanvasElement | null>
}

/** Offscreen buffers: the fan at half the stage's size, and the glow at a quarter, blurred into `soft`. */
type GlowBuffers = { field: HTMLCanvasElement; glow: HTMLCanvasElement; soft: HTMLCanvasElement }

type SceneOptions = {
  /** The wavelength to show. */
  wavelength: number
  /** Jump to it, for a drag: the pointer already moves smoothly. */
  instant: boolean
  /** Called with each paint's duration in ms. */
  onPaint?: ((milliseconds: number) => void) | undefined
}

type Size = { width: number; height: number }

// A machine without a GPU (a CI runner, a VM, some remote desktops) emulates GL in software: SwiftShader, llvmpipe,
// WARP. An accelerated canvas there paints about 20 times slower than Skia on the CPU, which `willReadFrequently`
// asks for; with a real GPU the accelerated canvas is the fastest, by about 10 ms a frame at a DPR of 2. The CPU
// rasterizes every pixel, so there the canvas stays at a DPR of 1: a runner or a VM rarely shows a sharper screen.
const softwareRenderer = /swiftshader|llvmpipe|softpipe|basic render|warp/i
type CanvasPlan = { settings: CanvasRenderingContext2DSettings; maxRatio: number }
let canvasPlan: CanvasPlan | undefined

function planCanvas(): CanvasPlan {
  if (canvasPlan) return canvasPlan
  const gl = document.createElement("canvas").getContext("webgl")
  let software = true
  if (gl) {
    // Chrome and Safari report a generic RENDERER and the real one through the debug extension; Firefox reports it
    // in RENDERER and deprecates the extension.
    const generic = String(gl.getParameter(gl.RENDERER))
    const debug = generic === "WebKit WebGL" ? gl.getExtension("WEBGL_debug_renderer_info") : null
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : generic
    software = softwareRenderer.test(renderer)
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }
  canvasPlan = { settings: { willReadFrequently: software }, maxRatio: software ? 1 : 2 }
  return canvasPlan
}
// The glow buffer's scale: a soft field needs few pixels, and scaling it up blurs it further for free.
const glowScale = 4
// The old CSS blur(7px), in the glow buffer's pixels.
const glowBlur = `blur(${String(7 / glowScale)}px)`

// The panel duration token: a key press or an agent's step glides the prism there, a drag follows the pointer.
const glideMs = 180
const glideAbove = 2
const ease = (t: number) => 1 - (1 - t) ** 4

// The size comes from the ResizeObserver, never from the element, so a paint inside a layout effect, right after
// React wrote the DOM, doesn't force a layout.
// The knob carries its own angle and colour: set on the stage, they would restyle the whole engraved scale on
// every frame, which a compositor without a GPU felt as a dropped frame per key press.
const knobOf = (stage: HTMLElement) => stage.querySelector<HTMLElement>('[data-slot="slider-thumb"]')

function sized(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return canvas.getContext("2d", planCanvas().settings)
}

// The glow used to be a second canvas with a CSS blur and an additive blend, which a compositor without a GPU redid
// over the whole stage on every frame. Now it is blurred at a quarter size and added into the one canvas.
function paint(canvases: PrismCanvases, buffers: GlowBuffers, size: Size | null, wavelength: number) {
  const stage = canvases.stage.current
  const lightCanvas = canvases.light.current
  if (!stage || !lightCanvas || !size || size.width < 2 || size.height < 2) return false
  const { width, height } = size
  const ratio = Math.min(planCanvas().maxRatio, devicePixelRatio || 1)
  const light = sized(lightCanvas, Math.round(width * ratio), Math.round(height * ratio))
  const fieldWidth = Math.ceil(width / 2)
  const fieldHeight = Math.ceil(height / 2)
  const field = sized(buffers.field, fieldWidth, fieldHeight)
  const glowWidth = Math.ceil(width / glowScale)
  const glowHeight = Math.ceil(height / glowScale)
  const glow = sized(buffers.glow, glowWidth, glowHeight)
  const soft = sized(buffers.soft, glowWidth, glowHeight)
  if (!light || !field || !glow || !soft) return false
  light.setTransform(ratio, 0, 0, ratio, 0, 0)
  field.setTransform(fieldWidth / width, 0, 0, fieldHeight / height, 0, 0)
  glow.setTransform(glowWidth / width, 0, 0, glowHeight / height, 0, 0)
  const reading = readingAt(wavelength)
  paintScene({ sharp: light, field, glow }, layoutFor(width, height), reading)
  soft.clearRect(0, 0, glowWidth, glowHeight)
  soft.filter = glowBlur
  soft.drawImage(buffers.glow, 0, 0)
  field.setTransform(1, 0, 0, 1, 0, 0)
  field.globalCompositeOperation = "lighter"
  field.drawImage(buffers.soft, 0, 0, fieldWidth, fieldHeight)
  light.setTransform(1, 0, 0, 1, 0, 0)
  light.globalCompositeOperation = "lighter"
  light.drawImage(buffers.field, 0, 0, lightCanvas.width, lightCanvas.height)
  // The knob follows the painted wavelength, not the value, so it glides with the prism without a React render.
  const knob = knobOf(stage)
  knob?.style.setProperty("--prism-dial", `${String(angleAt(wavelength))}deg`)
  knob?.style.setProperty("--prism-shown", reading.colour.hex)
  return true
}

// Outside the hook: React Compiler can't compile `??=`.
function glowBuffersOf(ref: { current: GlowBuffers | null }): GlowBuffers {
  if (ref.current === null) {
    ref.current = {
      field: document.createElement("canvas"),
      glow: document.createElement("canvas"),
      soft: document.createElement("canvas"),
    }
  }
  return ref.current
}

/** Paints the prism scene when the wavelength or the stage's size changes, and only then: nothing runs while idle. */
function usePrismPickerScene(canvases: PrismCanvases, { wavelength, instant, onPaint }: SceneOptions) {
  const shown = useRef<number | null>(null)
  const size = useRef<Size | null>(null)
  // Made on the first paint, in the browser: the hook also renders on the server.
  const buffers = useRef<GlowBuffers | null>(null)

  const paintAt = useEffectEvent((at: number) => {
    const started = performance.now()
    if (paint(canvases, glowBuffersOf(buffers), size.current, at)) onPaint?.(performance.now() - started)
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
    // An arrow key moves a nanometre or two, which a glide wouldn't show: it would only repaint for 180 ms.
    if (from === null || instant || reduced || Math.abs(wavelength - from) <= glideAbove) {
      shown.current = wavelength
      paintAt(wavelength)
      return
    }
    // The canvas still shows where the glide starts; only the knob, which React just rendered at its end, goes back.
    const stage = canvases.stage.current
    if (stage) knobOf(stage)?.style.setProperty("--prism-dial", `${String(angleAt(from))}deg`)
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
  }, [canvases, wavelength, instant])
}

export { usePrismPickerScene }
export type { PrismCanvases }
