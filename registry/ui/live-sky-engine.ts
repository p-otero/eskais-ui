import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { readPalette, type SkyPalette } from "@/components/ui/live-sky-palette"
import type { LiveSkyPhotoView, PhotoLayers } from "@/components/ui/live-sky-photo"
import {
  createSkyRunner,
  type EngineMode,
  type FromRunner,
  type RunnerEvents,
  type RunnerView,
  type SkyRunner,
  type ToRunner,
} from "@/components/ui/live-sky-runner"
import type { Surface } from "@/components/ui/live-sky-surface"
import type { SkyLocation } from "@/components/ui/live-sky-weather"

/** What the engine draws, and where it reports each frame's cost. */
type EngineInput = {
  conditions: SkyConditions
  location: SkyLocation
  glass: boolean
  /** A photo to show the sky in instead of the street, once its layers are loaded; `id` names one photo. */
  photo?: ShownPhoto | undefined
  /** True while a photo is being read: the street keeps its quick preview instead of being traced in full. */
  awaitingPhoto?: boolean | undefined
  /** Called with each frame's drawing time in ms, for measuring. */
  onFrame?: ((milliseconds: number) => void) | undefined
}

/** A loaded photo and the view it is drawn with. */
type ShownPhoto = { id: string; layers: PhotoLayers; view: LiveSkyPhotoView }

type SkyEngine = {
  update: (input: EngineInput) => void
  dispose: () => void
  mode: () => EngineMode
  renderer: () => string
}

type PageEvents = Omit<RunnerEvents, "still"> & { still: (image: Surface | ImageBitmap) => void }

const crossfadeMs = 2400
const inputEvents = ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"] as const
const dragNoteMs = 50

function makeCanvas(slot: string) {
  const canvas = document.createElement("canvas")
  canvas.dataset.slot = slot
  canvas.setAttribute("aria-hidden", "true")
  return canvas
}

function workerLink(
  canvas: HTMLCanvasElement,
  palette: SkyPalette,
  events: PageEvents,
  failed: () => void,
): SkyRunner | null {
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return null
  if (!("transferControlToOffscreen" in canvas)) return null
  let worker: Worker
  try {
    worker = new Worker(new URL("./live-sky-worker.js", import.meta.url), { type: "module" })
  } catch {
    return null
  }
  const offscreen = canvas.transferControlToOffscreen()
  const send = (message: ToRunner, transfer: Transferable[] = []) => worker.postMessage(message, transfer)
  let ready = false
  worker.addEventListener("message", (event: MessageEvent<FromRunner>) => {
    const message = event.data
    if (message.type === "ready") {
      ready = true
      events.ready(message.renderer)
    } else if (message.type === "unsupported") failed()
    else if (message.type === "frame") events.frame(message.milliseconds)
    else if (message.type === "painted") events.painted(message.paints, message.background)
    else if (message.type === "mode") events.mode(message.mode)
    else events.still(message.bitmap)
  })
  worker.addEventListener("error", () => {
    if (!ready) failed()
  })
  send({ type: "start", canvas: offscreen, palette }, [offscreen])
  return {
    setView: (view) => send({ type: "view", view }),
    update: (input) => send({ type: "update", input }),
    setPhoto: (id, layers) => send({ type: "photo", id, layers }),
    noteInput: () => send({ type: "input" }),
    dispose: () => worker.terminate(),
  }
}

/**
 * Draws a live sky into a stage element: one frame loop while it's visible and motion is welcome, stills otherwise. It
 * draws in a worker where the browser can (an OffscreenCanvas with WebGL or 2D there), so no frame of the sky holds the
 * page's main thread, and on the page otherwise.
 */
function createSkyEngine(stage: HTMLElement): SkyEngine {
  const stills = [makeCanvas("live-sky-still"), makeCanvas("live-sky-still")] as const
  for (const still of stills) still.style.setProperty("transition-duration", `${String(crossfadeMs)}ms`, "important")
  let canvas = makeCanvas("live-sky-canvas")
  stage.append(canvas, ...stills)
  const palette = readPalette(stage)
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  let mode: EngineMode = "paused"
  let input: EngineInput | null = null
  let sentPhoto = ""
  let size = { width: 0, height: 0 }
  let inView = typeof IntersectionObserver !== "function"
  let front: 0 | 1 = 0
  let drawsIn: "worker" | "page" = "worker"
  let lastNoted = Number.NEGATIVE_INFINITY

  const showStill = (image: Surface | ImageBitmap) => {
    front = front === 0 ? 1 : 0
    const target = stills[front]
    target.width = image.width
    target.height = image.height
    target.getContext("2d")?.drawImage(image, 0, 0)
    if (typeof ImageBitmap === "function" && image instanceof ImageBitmap) image.close()
    target.dataset.front = ""
    delete stills[front === 0 ? 1 : 0].dataset.front
  }

  const events: PageEvents = {
    ready: (renderer) => {
      stage.dataset.renderer = renderer
      stage.dataset.thread = drawsIn
    },
    frame: (milliseconds) => input?.onFrame?.(milliseconds),
    painted: (paints, background) => {
      stage.dataset.staticPaints = String(paints)
      if (background) stage.dataset.background = background
    },
    mode: (next) => {
      mode = next
      stage.dataset.mode = next
    },
    still: showStill,
  }

  const currentView = (): RunnerView => ({
    ...size,
    pixelRatio: devicePixelRatio || 1,
    visible: inView && document.visibilityState !== "hidden",
    reduced: motion?.matches ?? false,
  })

  const send = (next: EngineInput) => {
    if (!link) return
    const photo = next.photo
    if (photo && photo.id !== sentPhoto) {
      link.setPhoto(photo.id, photo.layers)
      if (sentPhoto) link.setPhoto(sentPhoto, null)
      sentPhoto = photo.id
    }
    link.update({
      conditions: next.conditions,
      location: next.location,
      glass: next.glass,
      photo: photo ? { id: photo.id, view: photo.view } : undefined,
      awaitingPhoto: next.awaitingPhoto,
      reportFrames: next.onFrame !== undefined,
    })
  }

  const unsupported = () => {
    mode = "unsupported"
    stage.dataset.renderer = "none"
    canvas.remove()
    for (const still of stills) still.remove()
  }

  const fallBack = () => {
    link?.dispose()
    const fresh = makeCanvas("live-sky-canvas")
    canvas.replaceWith(fresh)
    canvas = fresh
    drawsIn = "page"
    link = createSkyRunner(fresh, palette, events)
    if (!link) {
      unsupported()
      return
    }
    sentPhoto = ""
    link.setView(currentView())
    if (input) send(input)
  }

  let link = workerLink(canvas, palette, events, fallBack)
  if (!link) {
    drawsIn = "page"
    link = createSkyRunner(canvas, palette, events)
  }
  if (!link) unsupported()
  const sendView = () => link?.setView(currentView())

  const noteInput = (event: Event) => {
    if (event.type === "pointermove") {
      if (!(event instanceof PointerEvent) || event.buttons === 0 || event.timeStamp - lastNoted < dragNoteMs) return
    }
    lastNoted = event.timeStamp
    link?.noteInput()
  }
  for (const type of inputEvents) addEventListener(type, noteInput, { capture: true, passive: true })

  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return
    const next = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }
    if (next.width === size.width && next.height === size.height) return
    size = next
    sendView()
  })
  resize.observe(stage)
  const intersection =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          const next = entries.some((entry) => entry.isIntersecting)
          if (next === inView) return
          inView = next
          sendView()
        })
      : null
  intersection?.observe(stage)
  document.addEventListener("visibilitychange", sendView)
  motion?.addEventListener("change", sendView)

  return {
    update(next) {
      input = next
      send(next)
    },
    mode: () => mode,
    renderer: () => stage.dataset.renderer ?? "none",
    dispose() {
      link?.dispose()
      link = null
      for (const type of inputEvents) removeEventListener(type, noteInput, { capture: true })
      resize.disconnect()
      intersection?.disconnect()
      document.removeEventListener("visibilitychange", sendView)
      motion?.removeEventListener("change", sendView)
      canvas.remove()
      for (const still of stills) still.remove()
    },
  }
}

export { createSkyEngine }
export type { EngineInput, EngineMode, ShownPhoto, SkyEngine }
