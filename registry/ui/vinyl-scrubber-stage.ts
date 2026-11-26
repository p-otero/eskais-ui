import type { DeckState, FromRunner, RunnerEvents, ToRunner, VinylRunner } from "@/components/ui/vinyl-scrubber-runner"
import type { StageSize } from "@/components/ui/vinyl-scrubber-scene"

/** What the turntable shows: the position and length in seconds, and whether the record turns on its own. */
type DeckInput = { time: number; duration: number; playing: boolean }

type VinylStage = {
  update: (input: DeckInput) => void
  label: (title: string | undefined, subtitle: string | undefined) => void
  dispose: () => void
}

type Link = {
  setSize: (size: StageSize) => void
  setState: (state: DeckState) => void
  setLabel: (label: HTMLCanvasElement) => void
  dispose: () => void
}

type LinkEvents = RunnerEvents & { failed: () => void }

const labelPixels = 512
const quietInputMs = 1200
const inputEvents = ["keydown", "pointerdown", "wheel", "touchstart"]
const speedMark = "33⅓ RPM"

const epochNow = () => performance.timeOrigin + performance.now()

/** Whether the browser has WebGL at all; a server or a test DOM without it keeps the drawn turntable. */
const supportsVinylStage = () =>
  typeof window !== "undefined" && typeof WebGLRenderingContext !== "undefined" && typeof ResizeObserver === "function"

function makeCanvas() {
  const canvas = document.createElement("canvas")
  canvas.dataset.slot = "vinyl-canvas"
  canvas.setAttribute("aria-hidden", "true")
  return canvas
}

function fitFont(context: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string) {
  let fitted = size
  context.font = `${String(weight)} ${String(fitted)}px ${family}`
  while (context.measureText(text).width > labelPixels * 0.8 && fitted > size / 3) {
    fitted -= 2
    context.font = `${String(weight)} ${String(fitted)}px ${family}`
  }
}

function drawLabel(title: string, subtitle: string, family: string) {
  const canvas = document.createElement("canvas")
  canvas.width = labelPixels
  canvas.height = labelPixels
  const context = canvas.getContext("2d")
  if (!context) return canvas
  const center = labelPixels / 2
  context.translate(0, labelPixels)
  context.scale(1, -1)
  const fill = context.createRadialGradient(center * 0.8, center * 0.7, 5, center, center, center)
  fill.addColorStop(0, "#ff3b22")
  fill.addColorStop(0.7, "#d91f10")
  fill.addColorStop(1, "#9e1206")
  context.fillStyle = fill
  context.beginPath()
  context.arc(center, center, center, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = "rgb(255 220 200 / 0.55)"
  context.lineWidth = 2
  context.beginPath()
  context.arc(center, center, center * 0.92, 0, Math.PI * 2)
  context.stroke()
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "#fff6ee"
  if (title) {
    fitFont(context, title.toUpperCase(), 800, 60, family)
    context.fillText(title.toUpperCase(), center, center * 0.55)
  }
  context.fillStyle = "#ffd8cb"
  if (subtitle) {
    fitFont(context, subtitle.toUpperCase(), 600, 27, family)
    context.fillText(subtitle.toUpperCase(), center, center * 1.38)
  }
  context.font = `600 15px ${family}`
  context.fillText(speedMark, center, center * 1.62)
  context.fillStyle = "rgb(0 0 0 / 0.35)"
  context.beginPath()
  context.arc(center, center, 15, 0, Math.PI * 2)
  context.fill()
  return canvas
}

async function fontsFor(family: string) {
  const fonts = typeof document.fonts === "object" ? document.fonts : null
  if (!fonts) return
  await Promise.all([fonts.load(`800 60px ${family}`), fonts.load(`600 27px ${family}`)]).catch(() => [])
  await fonts.ready
}

function workerLink(canvas: HTMLCanvasElement, size: StageSize, events: LinkEvents): Link | null {
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return null
  if (!("transferControlToOffscreen" in canvas) || typeof createImageBitmap !== "function") return null
  let worker: Worker
  try {
    worker = new Worker(new URL("./vinyl-scrubber-worker.js", import.meta.url), { type: "module" })
  } catch {
    return null
  }
  let shown = false
  let disposed = false
  const send = (message: ToRunner, transfer: Transferable[] = []) => worker.postMessage(message, transfer)
  worker.addEventListener("message", (event: MessageEvent<FromRunner>) => {
    if (event.data.type === "shown") {
      shown = true
      events.shown()
    } else if (event.data.type === "lost") events.lost()
    else events.failed()
  })
  worker.addEventListener("error", () => (shown ? events.lost() : events.failed()))
  const offscreen = canvas.transferControlToOffscreen()
  send({ type: "start", canvas: offscreen, size }, [offscreen])
  return {
    setSize: (next) => send({ type: "size", size: next }),
    setState: (state) => send({ type: "state", state }),
    setLabel: (label) => {
      void createImageBitmap(label).then((image) => {
        if (disposed) image.close()
        else send({ type: "label", image }, [image])
      })
    },
    dispose: () => {
      disposed = true
      send({ type: "dispose" })
    },
  }
}

function pageLink(canvas: HTMLCanvasElement, size: StageSize, events: LinkEvents): Link {
  let runner: VinylRunner | null = null
  let disposed = false
  let latest: { size: StageSize; state?: DeckState; label?: HTMLCanvasElement } = { size }
  void import("@/components/ui/vinyl-scrubber-runner").then(({ createVinylRunner }) => {
    if (disposed) return
    runner = createVinylRunner(canvas, latest.size, events)
    if (!runner) {
      events.failed()
      return
    }
    if (latest.state) runner.setState(latest.state)
    if (latest.label) runner.setLabel(latest.label)
  }, events.failed)
  return {
    setSize: (next) => {
      latest = { ...latest, size: next }
      runner?.setSize(next)
    },
    setState: (state) => {
      latest = { ...latest, state }
      runner?.setState(state)
    },
    setLabel: (label) => {
      latest = { ...latest, label }
      runner?.setLabel(label)
    },
    dispose: () => {
      disposed = true
      runner?.dispose()
    },
  }
}

/**
 * The photographic turntable over the drawn one in `host`: a WebGL scene drawn in a worker where the browser can (an
 * OffscreenCanvas), on the page otherwise, loaded after the controls paint. `host` gets `data-renderer="webgl"` once
 * the first frame is drawn, and loses it when WebGL fails or its context is lost, so the drawing shows again.
 */
function createVinylStage(host: HTMLElement): VinylStage {
  const family = getComputedStyle(host).fontFamily || "sans-serif"
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  let input: DeckInput = { time: 0, duration: 0, playing: false }
  let inputAt = epochNow()
  let inView = typeof IntersectionObserver !== "function"
  let size: StageSize | null = null
  let label: HTMLCanvasElement | null = null
  let labelText = { title: "", subtitle: "" }
  let link: Link | null = null
  let canvas: HTMLCanvasElement | null = null
  let triedPage = false
  let ended = false

  const deckState = (): DeckState => ({
    time: input.time,
    at: inputAt,
    duration: input.duration,
    moving: input.playing && inView && !motion?.matches,
  })

  const removeCanvas = () => {
    link?.dispose()
    link = null
    canvas?.remove()
    canvas = null
    delete host.dataset.renderer
  }

  const giveUp = () => {
    removeCanvas()
    ended = true
  }

  const connect = (through: "worker" | "page") => {
    if (!size) return
    canvas = makeCanvas()
    host.append(canvas)
    const events: LinkEvents = {
      shown: () => {
        host.dataset.renderer = "webgl"
      },
      lost: giveUp,
      failed: () => {
        removeCanvas()
        if (triedPage || ended) giveUp()
        else connect("page")
      },
    }
    if (through === "worker") link = workerLink(canvas, size, events)
    if (!link) {
      triedPage = true
      link = pageLink(canvas, size, events)
    }
    link.setState(deckState())
    if (label) link.setLabel(label)
  }

  let quietTimer: ReturnType<typeof setTimeout> | undefined
  const startWhenQuiet = () => {
    clearTimeout(quietTimer)
    quietTimer = setTimeout(() => {
      stopWaiting()
      if (typeof requestIdleCallback === "function") requestIdleCallback(() => connectOnce(), { timeout: 1000 })
      else connectOnce()
    }, quietInputMs)
  }
  const stopWaiting = () => {
    clearTimeout(quietTimer)
    for (const name of inputEvents) removeEventListener(name, startWhenQuiet, true)
  }
  const connectOnce = () => {
    if (!ended && !link) connect("worker")
  }
  for (const name of inputEvents) addEventListener(name, startWhenQuiet, { capture: true, passive: true })

  const resize = new ResizeObserver(([entry]) => {
    if (!entry || ended) return
    const { width, height } = entry.contentRect
    const first = size === null
    size = { width, height, pixelRatio: devicePixelRatio || 1 }
    if (link) link.setSize(size)
    else if (first) startWhenQuiet()
  })
  resize.observe(host)

  const visibility =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => {
          inView = entry?.isIntersecting ?? true
          link?.setState(deckState())
        })
      : null
  visibility?.observe(host)

  const onMotion = () => link?.setState(deckState())
  motion?.addEventListener("change", onMotion)

  return {
    update(next) {
      input = next
      inputAt = epochNow()
      link?.setState(deckState())
    },
    label(title = "", subtitle = "") {
      if (title === labelText.title && subtitle === labelText.subtitle && label) return
      labelText = { title, subtitle }
      void fontsFor(family).then(() => {
        if (ended || labelText.title !== title || labelText.subtitle !== subtitle) return
        label = drawLabel(title, subtitle, family)
        link?.setLabel(label)
      })
    },
    dispose() {
      ended = true
      stopWaiting()
      resize.disconnect()
      visibility?.disconnect()
      motion?.removeEventListener("change", onMotion)
      removeCanvas()
    },
  }
}

export { createVinylStage, supportsVinylStage }
export type { DeckInput, VinylStage }
