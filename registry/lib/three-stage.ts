import type { FromRunner, RunnerEvents, RunnerFactory, StageRunner, ToRunner } from "@/lib/three-stage-runner"
import type { StageSize } from "@/lib/three-studio"

/** What the page knows that changes what a scene draws: whether the stage is on screen and motion is reduced. */
type StageView = { inView: boolean; reducedMotion: boolean }

type ThreeStageOptions<State> = {
  /** The `data-slot` of the canvas the stage adds to the host. */
  slot: string
  /** Starts the module worker that serves the runner: `() => new Worker(new URL("./x-worker.js", import.meta.url), { type: "module" })`. */
  worker: () => Worker
  /** Loads the runner to draw on the page where a worker can't: `() => import("./x-runner").then((m) => m.createXRunner)`. */
  runner: () => Promise<RunnerFactory<State>>
  /** The state to draw now; the stage asks again on `refresh()`, when it scrolls in or out and when motion changes. */
  state: (view: StageView) => State
  /** Runs with the host's size, on the first measure and after every resize. */
  onSize?: (size: StageSize) => void
  /** Runs with true once WebGL drew its first frame, and with false when it gave up. */
  onRenderer?: (webgl: boolean) => void
}

type ThreeStage = {
  /** Sends the state again, read from `options.state`. */
  refresh: () => void
  /** Hands the scene a picture drawn on the page, by name. */
  asset: (name: string, canvas: HTMLCanvasElement) => void
  view: () => StageView
  dispose: () => void
}

type Link<State> = {
  setSize: (size: StageSize) => void
  setState: (state: State) => void
  setAsset: (name: string, canvas: HTMLCanvasElement) => void
  dispose: () => void
}

type LinkEvents = RunnerEvents & { failed: () => void }

const quietInputMs = 1200
const inputEvents = ["keydown", "pointerdown", "wheel", "touchstart"]

/** Whether the browser has WebGL at all; a server or a test DOM without it keeps the drawing. */
const supportsThreeStage = () =>
  typeof window !== "undefined" && typeof WebGLRenderingContext !== "undefined" && typeof ResizeObserver === "function"

function makeCanvas(slot: string) {
  const canvas = document.createElement("canvas")
  canvas.dataset.slot = slot
  canvas.setAttribute("aria-hidden", "true")
  return canvas
}

function workerLink<State>(
  canvas: HTMLCanvasElement,
  size: StageSize,
  start: () => Worker,
  events: LinkEvents,
): Link<State> | null {
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return null
  if (!("transferControlToOffscreen" in canvas) || typeof createImageBitmap !== "function") return null
  let worker: Worker
  try {
    worker = start()
  } catch {
    return null
  }
  let shown = false
  let disposed = false
  const send = (message: ToRunner<State>, transfer: Transferable[] = []) => worker.postMessage(message, transfer)
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
    setAsset: (name, picture) => {
      void createImageBitmap(picture).then((asset) => {
        if (disposed) asset.close()
        else send({ type: "asset", name, asset }, [asset])
      })
    },
    dispose: () => {
      disposed = true
      send({ type: "dispose" })
    },
  }
}

function pageLink<State>(
  canvas: HTMLCanvasElement,
  size: StageSize,
  load: () => Promise<RunnerFactory<State>>,
  events: LinkEvents,
): Link<State> {
  let runner: StageRunner<State> | null = null
  let disposed = false
  let latest: {
    size: StageSize
    state?: State
    assets: Map<string, HTMLCanvasElement>
  } = { size, assets: new Map() }
  void load().then((create) => {
    if (disposed) return
    runner = create(canvas, latest.size, events)
    if (!runner) {
      events.failed()
      return
    }
    if (latest.state !== undefined) runner.setState(latest.state)
    for (const [name, asset] of latest.assets) runner.setAsset(name, asset)
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
    setAsset: (name, asset) => {
      latest.assets.set(name, asset)
      runner?.setAsset(name, asset)
    },
    dispose: () => {
      disposed = true
      runner?.dispose()
    },
  }
}

/**
 * A three.js scene over a drawing in `host`: drawn in a module worker where the browser can (an OffscreenCanvas), on
 * the page otherwise, and started once input has been quiet for a moment after the host is measured. `host` gets
 * `data-renderer="webgl"` once the first frame is drawn, and loses it when WebGL fails or its context is lost, so the
 * drawing shows again.
 */
function createThreeStage<State>(host: HTMLElement, options: ThreeStageOptions<State>): ThreeStage {
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null
  let inView = typeof IntersectionObserver !== "function"
  let size: StageSize | null = null
  const assets = new Map<string, HTMLCanvasElement>()
  let link: Link<State> | null = null
  let canvas: HTMLCanvasElement | null = null
  let triedPage = false
  let ended = false

  const view = (): StageView => ({
    inView,
    reducedMotion: motion?.matches ?? false,
  })
  const refresh = () => link?.setState(options.state(view()))

  const removeCanvas = () => {
    link?.dispose()
    link = null
    canvas?.remove()
    canvas = null
    if (host.dataset.renderer !== undefined) {
      delete host.dataset.renderer
      options.onRenderer?.(false)
    }
  }

  const giveUp = () => {
    removeCanvas()
    ended = true
  }

  const connect = (through: "worker" | "page") => {
    if (!size) return
    canvas = makeCanvas(options.slot)
    host.append(canvas)
    const events: LinkEvents = {
      shown: () => {
        host.dataset.renderer = "webgl"
        options.onRenderer?.(true)
      },
      lost: giveUp,
      failed: () => {
        removeCanvas()
        if (triedPage || ended) giveUp()
        else connect("page")
      },
    }
    if (through === "worker") link = workerLink<State>(canvas, size, options.worker, events)
    if (!link) {
      triedPage = true
      link = pageLink(canvas, size, options.runner, events)
    }
    link.setState(options.state(view()))
    for (const [name, asset] of assets) link.setAsset(name, asset)
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
    options.onSize?.(size)
    if (link) link.setSize(size)
    else if (first) startWhenQuiet()
  })
  resize.observe(host)

  const visibility =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => {
          inView = entry?.isIntersecting ?? true
          refresh()
        })
      : null
  visibility?.observe(host)

  motion?.addEventListener("change", refresh)

  return {
    refresh,
    view,
    asset(name, picture) {
      assets.set(name, picture)
      link?.setAsset(name, picture)
    },
    dispose() {
      ended = true
      stopWaiting()
      resize.disconnect()
      visibility?.disconnect()
      motion?.removeEventListener("change", refresh)
      removeCanvas()
    },
  }
}

export { createThreeStage, supportsThreeStage }
export type { StageView, ThreeStage, ThreeStageOptions }
