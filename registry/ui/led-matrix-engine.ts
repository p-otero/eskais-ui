import { glyphRows, pagesOf, textColumns } from "@/components/ui/led-matrix-font"

type LedColor = "amber" | "red" | "green" | "white"

/** How a message moves: `scroll` runs it right to left; `hold` shows it still, a page at a time when it's too long. */
type LedMatrixMode = "scroll" | "hold"

type LedPalette = { core: string; lit: string; glow: string; unlit: string; rim: string }

const ledPalettes: Record<LedColor, LedPalette> = {
  amber: { core: "#fff4d6", lit: "#ffb020", glow: "#ff8800", unlit: "#2a1b08", rim: "#4a3418" },
  red: { core: "#ffe0d8", lit: "#ff4128", glow: "#ff1800", unlit: "#2a0c08", rim: "#4a1e18" },
  green: { core: "#eaffee", lit: "#52ff74", glow: "#00e046", unlit: "#0a2210", rim: "#1c3e24" },
  white: { core: "#ffffff", lit: "#eef3ff", glow: "#b8ccff", unlit: "#1c1e24", rim: "#383c46" },
}

const boardColor = "#070605"

type LedMatrixSettings = {
  messages: readonly string[]
  columns: number
  rows: number
  mode: LedMatrixMode
  /** Scroll speed in dots per second. */
  speed: number
  /** How long a held message or page stays, in ms. */
  holdMs: number
  color: LedColor
  paused: boolean
}

type LedMatrixHandlers = {
  /** Called with the index of the message that comes up. */
  onMessage: (index: number) => void
  /** Called with each paint's duration in ms. */
  onPaint?: ((milliseconds: number) => void) | undefined
}

type Frame = { columns: number[]; offset: number }

const softwareRenderer = /swiftshader|llvmpipe|softpipe|basic render|warp/i
type CanvasPlan = { settings: CanvasRenderingContext2DSettings; maxRatio: number }
let canvasPlan: CanvasPlan | undefined

function rendererName(gl: WebGLRenderingContext) {
  const generic = String(gl.getParameter(gl.RENDERER))
  const debug = generic === "WebKit WebGL" ? gl.getExtension("WEBGL_debug_renderer_info") : null
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : generic
}

function planCanvas(): CanvasPlan {
  if (canvasPlan) return canvasPlan
  const gl = document.createElement("canvas").getContext("webgl")
  const software = gl ? softwareRenderer.test(rendererName(gl)) : true
  gl?.getExtension("WEBGL_lose_context")?.loseContext()
  canvasPlan = { settings: { willReadFrequently: software }, maxRatio: software ? 1 : 2 }
  return canvasPlan
}

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

function sized(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return canvas.getContext("2d", planCanvas().settings)
}

type Geometry = { pitch: number; left: number; top: number; ratio: number }

function geometryOf(width: number, height: number, settings: LedMatrixSettings): Geometry {
  const ratio = Math.min(planCanvas().maxRatio, devicePixelRatio || 1)
  const pitch = Math.min(width / settings.columns, height / settings.rows) * ratio
  return {
    pitch,
    left: (width * ratio - pitch * settings.columns) / 2,
    top: (height * ratio - pitch * settings.rows) / 2,
    ratio,
  }
}

function litSprite(pitch: number, palette: LedPalette) {
  const sprite = document.createElement("canvas")
  const size = Math.max(4, Math.ceil(pitch * 2.4))
  const context = sized(sprite, size, size)
  if (!context) return sprite
  const centre = size / 2
  const glow = context.createRadialGradient(centre, centre, 0, centre, centre, centre)
  glow.addColorStop(0, palette.core)
  glow.addColorStop(0.1, palette.lit)
  glow.addColorStop(0.2, palette.lit)
  glow.addColorStop(0.24, `${palette.glow}88`)
  glow.addColorStop(0.45, `${palette.glow}22`)
  glow.addColorStop(1, `${palette.glow}00`)
  context.fillStyle = glow
  context.fillRect(0, 0, size, size)
  return sprite
}

function paintUnlit(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  geometry: Geometry,
  settings: LedMatrixSettings,
) {
  const context = sized(canvas, width, height)
  if (!context) return
  const palette = ledPalettes[settings.color]
  const { pitch, left, top } = geometry
  const radius = pitch * 0.34
  context.fillStyle = boardColor
  context.fillRect(0, 0, width, height)
  for (let row = 0; row < settings.rows; row++) {
    for (let column = 0; column < settings.columns; column++) {
      const x = left + (column + 0.5) * pitch
      const y = top + (row + 0.5) * pitch
      const lens = context.createRadialGradient(x - radius * 0.3, y - radius * 0.35, 0, x, y, radius)
      lens.addColorStop(0, palette.rim)
      lens.addColorStop(0.7, palette.unlit)
      lens.addColorStop(1, "#000000")
      context.fillStyle = lens
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
  }
}

/**
 * Drives a dot-matrix sign on a canvas: it steps a message across a dot at a time, or holds it a page at a time, and
 * paints only when a dot changes, only while the board is on screen and the page is visible.
 */
function createLedMatrixEngine(canvas: HTMLCanvasElement, board: HTMLElement, handlers: LedMatrixHandlers) {
  let settings: LedMatrixSettings | undefined
  let size = { width: 0, height: 0 }
  let unlit: HTMLCanvasElement | undefined
  let sprite: HTMLCanvasElement | undefined
  let geometry: Geometry | undefined
  let onScreen = true
  let reduced = prefersReducedMotion()
  let message = 0
  let page = 0
  let offset = 0
  let shown: Frame = { columns: [], offset: 0 }
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let started = 0
  let startOffset = 0
  const columnsCache = new Map<string, number[]>()

  const scale = () => Math.max(1, Math.floor((settings?.rows ?? glyphRows) / glyphRows))
  const columnsOf = (text: string) => {
    const key = `${String(scale())}:${text}`
    let columns = columnsCache.get(key)
    if (!columns) {
      columns = textColumns(text, scale())
      columnsCache.set(key, columns)
    }
    return columns
  }
  const scrolls = () => settings?.mode === "scroll" && !reduced
  const pages = () => {
    const text = settings?.messages[message] ?? ""
    return settings ? pagesOf(text, settings.columns, scale()) : [text]
  }

  function frameNow(): Frame {
    if (!settings) return { columns: [], offset: 0 }
    if (scrolls()) return { columns: columnsOf(settings.messages[message] ?? ""), offset }
    const columns = columnsOf(pages()[page] ?? "")
    return { columns, offset: -Math.floor((settings.columns - columns.length) / 2) }
  }

  function paint() {
    if (!settings || !geometry || !unlit || !sprite) return
    const paintStarted = performance.now()
    const context = canvas.getContext("2d", planCanvas().settings)
    if (!context) return
    shown = frameNow()
    context.globalCompositeOperation = "copy"
    context.drawImage(unlit, 0, 0)
    context.globalCompositeOperation = "lighter"
    const { pitch, left, top } = geometry
    const half = sprite.width / 2
    const firstRow = Math.floor((settings.rows - glyphRows * scale()) / 2)
    for (let column = 0; column < settings.columns; column++) {
      const dots = shown.columns[shown.offset + column] ?? 0
      if (!dots) continue
      const x = left + (column + 0.5) * pitch - half
      for (let row = 0; row < settings.rows; row++) {
        if (dots & (1 << (row - firstRow))) context.drawImage(sprite, x, top + (row + 0.5) * pitch - half)
      }
    }
    handlers.onPaint?.(performance.now() - paintStarted)
  }

  function layout() {
    if (!settings || size.width < 2 || size.height < 2) return
    geometry = geometryOf(size.width, size.height, settings)
    const width = Math.round(size.width * geometry.ratio)
    const height = Math.round(size.height * geometry.ratio)
    sized(canvas, width, height)
    unlit ??= document.createElement("canvas")
    paintUnlit(unlit, width, height, geometry, settings)
    sprite = litSprite(geometry.pitch, ledPalettes[settings.color])
    paint()
  }

  const running = () =>
    Boolean(
      settings && !settings.paused && onScreen && settings.messages.length && document.visibilityState !== "hidden",
    )

  function stop() {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    frame = 0
    timer = undefined
  }

  function showMessage(index: number) {
    const count = settings?.messages.length ?? 0
    message = count ? index % count : 0
    page = 0
    offset = -(settings?.columns ?? 0)
    handlers.onMessage(message)
  }

  function step(now: number) {
    if (!settings) return
    const length = columnsOf(settings.messages[message] ?? "").length
    const next = startOffset + Math.floor(((now - started) * settings.speed) / 1000)
    if (next >= length) {
      showMessage(message + 1)
      started = now
      startOffset = offset
    } else {
      offset = next
    }
    if (shown.offset !== offset || shown.columns !== columnsOf(settings.messages[message] ?? "")) paint()
    frame = requestAnimationFrame(step)
  }

  function hold() {
    timer = setTimeout(() => {
      if (page + 1 < pages().length) page += 1
      else showMessage(message + 1)
      paint()
      hold()
    }, settings?.holdMs ?? 3000)
  }

  function run() {
    stop()
    if (!running()) return
    if (scrolls()) {
      started = performance.now()
      startOffset = offset
      frame = requestAnimationFrame(step)
    } else {
      hold()
    }
  }

  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return
    size = { width: entry.contentRect.width, height: entry.contentRect.height }
    layout()
  })
  resize.observe(board)

  const visibility =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => {
          onScreen = entry?.isIntersecting ?? true
          run()
        })
      : undefined
  visibility?.observe(board)

  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined
  const onMotion = () => {
    reduced = prefersReducedMotion()
    page = 0
    offset = -(settings?.columns ?? 0)
    paint()
    run()
  }
  motion?.addEventListener("change", onMotion)
  document.addEventListener("visibilitychange", run)

  return {
    set(next: LedMatrixSettings) {
      const previous = settings
      settings = next
      const messagesChanged =
        !previous ||
        previous.messages.length !== next.messages.length ||
        previous.messages.some((text, index) => text !== next.messages[index])
      const shapeChanged =
        !previous || previous.columns !== next.columns || previous.rows !== next.rows || previous.color !== next.color
      if (messagesChanged) showMessage(0)
      else if (previous.mode !== next.mode) {
        page = 0
        offset = -next.columns
      }
      if (shapeChanged) {
        columnsCache.clear()
        layout()
      } else if (messagesChanged || previous.mode !== next.mode) paint()
      const pacingChanged =
        !previous ||
        messagesChanged ||
        previous.mode !== next.mode ||
        previous.paused !== next.paused ||
        previous.speed !== next.speed ||
        previous.holdMs !== next.holdMs
      if (pacingChanged) run()
    },
    destroy() {
      stop()
      resize.disconnect()
      visibility?.disconnect()
      motion?.removeEventListener("change", onMotion)
      document.removeEventListener("visibilitychange", run)
    },
  }
}

export { createLedMatrixEngine, ledPalettes }
export type { LedColor, LedMatrixHandlers, LedMatrixMode, LedMatrixSettings }
