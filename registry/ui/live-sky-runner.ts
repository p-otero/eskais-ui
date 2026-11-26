import { composeScene, sceneMotion, type SkyBackground, type SkyScene } from "@/components/ui/live-sky-backdrop"
import { steppedRain, type SkyConditions } from "@/components/ui/live-sky-conditions"
import { createGlass } from "@/components/ui/live-sky-glass"
import { createIdleWork, type IdleJob } from "@/components/ui/live-sky-idle"
import type { SkyPalette } from "@/components/ui/live-sky-palette"
import { photoCamera, type LiveSkyPhotoView, type PhotoLayers } from "@/components/ui/live-sky-photo"
import { planRenderer } from "@/components/ui/live-sky-renderer"
import { createStreetBuilder } from "@/components/ui/live-sky-street-builder"
import type { Surface } from "@/components/ui/live-sky-surface"
import type { SkyLocation } from "@/components/ui/live-sky-weather"
import { keysOf } from "@/lib/narrow"

/** What the sky shows, sent on every change: a photo is named by the `id` its layers were handed over with. */
type RunnerInput = {
  conditions: SkyConditions
  location: SkyLocation
  glass: boolean
  photo?: { id: string; view: LiveSkyPhotoView } | undefined
  /** True while a photo is being read: the street keeps its quick preview instead of being traced in full. */
  awaitingPhoto?: boolean | undefined
  /** True when the page wants each frame's drawing time. */
  reportFrames: boolean
}

/** How the sky is seen: the stage's size in CSS px, the device's pixel ratio, on screen or not, motion welcome or not. */
type RunnerView = { width: number; height: number; pixelRatio: number; visible: boolean; reduced: boolean }

/** What the sky is doing, for tests and checks: drawing every frame, holding a still, or idle while hidden. */
type EngineMode = "running" | "still" | "paused" | "unsupported"

/** What a runner tells the page it draws for. */
type RunnerEvents = {
  /** The renderer it drew with: `webgl`, `webgl-software` or `canvas`. */
  ready: (renderer: string) => void
  frame: (milliseconds: number) => void
  /** The static layers were painted again: how many times so far, and the background when it changed. */
  painted: (paints: number, background: SkyBackground["kind"] | undefined) => void
  mode: (mode: EngineMode) => void
  /** A still to show under reduced motion, drawn on the runner's canvas. */
  still: (canvas: Surface) => void
}

type SkyRunner = {
  setView: (view: RunnerView) => void
  update: (input: RunnerInput) => void
  /** Hands over a photo's layers under `id`, or forgets them with null. */
  setPhoto: (id: string, layers: PhotoLayers | null) => void
  /** Takes a key press, click, drag or wheel on the page, which holds static repaints until input is quiet. */
  noteInput: () => void
  dispose: () => void
}

/** The page's side of a runner, wherever it runs: on the page, or in a worker. */
type ToRunner =
  | { type: "start"; canvas: OffscreenCanvas; palette: SkyPalette }
  | { type: "view"; view: RunnerView }
  | { type: "update"; input: RunnerInput }
  | { type: "photo"; id: string; layers: PhotoLayers | null }
  | { type: "input" }

/** A runner's side, from a worker. */
type FromRunner =
  | { type: "ready"; renderer: string }
  | { type: "unsupported" }
  | { type: "frame"; milliseconds: number }
  | { type: "painted"; paints: number; background: SkyBackground["kind"] | undefined }
  | { type: "mode"; mode: EngineMode }
  | { type: "still"; bitmap: ImageBitmap }

const stillEveryMs = 9000
const stillSettleSeconds = 6
const stillStepSeconds = 1 / 30
const maxStepSeconds = 0.1
const flashGapSeconds = { min: 7, spread: 12 }
const traceSliceMs = 2
const settleMs = 250
const maxTraceRatio = 1.5

const sceneKey = ({ conditions, location, glass, photo, awaitingPhoto, reportFrames }: RunnerInput) =>
  JSON.stringify([
    conditions,
    location.latitude,
    location.longitude,
    glass,
    photo?.id,
    photo?.view,
    awaitingPhoto,
    reportFrames,
  ])

const staticKey = ({ conditions, location, photo }: RunnerInput) =>
  JSON.stringify([steppedRain(conditions), location.latitude, location.longitude, photo?.id, photo?.view])

function flashAt(sinceFlash: number) {
  if (sinceFlash < 0 || sinceFlash > 0.45) return 0
  return Math.max(0, 1 - sinceFlash / 0.09) * 0.8 + Math.max(0, 1 - Math.abs(sinceFlash - 0.22) / 0.12) * 0.55
}

/**
 * Draws a live sky on a canvas: one frame loop while it's on screen and motion is welcome, stills otherwise, and the
 * static layers repainted a step at a time between key presses. It touches no DOM, so it runs in a worker on an
 * `OffscreenCanvas` as well as on the page. Null where the canvas gives neither WebGL nor 2D.
 */
function createSkyRunner(canvas: Surface, palette: SkyPalette, events: RunnerEvents): SkyRunner | null {
  const plan = planRenderer(canvas)
  if (!plan) return null
  const { renderer, budget, maxRatio, frameMs, software } = plan
  const glass = createGlass()
  const idle = createIdleWork(settleMs)
  const streets = createStreetBuilder()
  const photos = new Map<string, PhotoLayers>()
  let input: RunnerInput | null = null
  let view: RunnerView = { width: 0, height: 0, pixelRatio: 1, visible: false, reduced: false }
  let scene: SkyScene | null = null
  let mode: EngineMode = "paused"
  let frame = 0
  let traceFrame = 0
  let stillTimer = 0
  let lastFrameAt = 0
  const startedAt = performance.now()
  let nextFlash = Number.POSITIVE_INFINITY
  let shownKey = ""
  let composedKey = ""
  let recompose = false
  let unshown: SkyBackground | null = null
  let shownPhotoKey = ""
  let staticPaints = 0

  const setMode = (next: EngineMode) => {
    mode = next
    events.mode(next)
  }
  const countStaticPaint = (background?: SkyBackground["kind"]) => {
    staticPaints += 1
    events.painted(staticPaints, background)
  }
  const visible = () => view.visible && view.width > 1 && view.height > 1
  const shownPhoto = () => {
    const wanted = input?.photo
    const layers = wanted ? photos.get(wanted.id) : undefined
    return wanted && layers ? { ...wanted, layers } : undefined
  }

  const composeNext = () => {
    if (!input) return null
    const { width, height } = view
    const ratio = Math.min(maxRatio, view.pixelRatio || 1)
    const photo = shownPhoto()
    const camera = photo ? photoCamera(width, height, photo.view) : undefined
    const next = composeScene({
      width,
      height,
      ratio,
      conditions: steppedRain(input.conditions),
      moving: input.conditions,
      palette,
      budget: budget,
      camera,
    })
    if (!next) return null
    composedKey = staticKey(input)
    const traceRatio = Math.min(ratio, maxTraceRatio)
    if (photo) {
      const traceWidth = Math.round(width * traceRatio)
      const traceHeight = Math.round(height * traceRatio)
      const key = JSON.stringify([photo.id, photo.view.horizon, traceWidth, traceHeight])
      if (key !== shownPhotoKey) {
        shownPhotoKey = key
        unshown = {
          kind: "photo",
          layers: photo.layers,
          horizon: photo.view.horizon,
          width: traceWidth,
          height: traceHeight,
        }
      }
    } else {
      if (shownPhotoKey !== "") streets.forget()
      shownPhotoKey = ""
      const preview = streets.request({ width, height, ratio: traceRatio, location: input.location, palette })
      if (preview) unshown = { kind: "street", ...preview }
    }
    rainOnGlass()
    return next
  }

  function* repaint(): IdleJob {
    if (!visible()) return
    const next = recompose ? composeNext() : null
    if (recompose && !next) return
    const shown = next ?? scene
    if (!shown) return
    if (next) yield
    const background = unshown
    yield* renderer.show(shown, background)
    if (next) {
      scene = next
      recompose = false
      countStaticPaint()
      if (input) renderer.setMotion(sceneMotion(next, input.conditions, budget))
    }
    if (background) {
      if (unshown === background) unshown = null
      countStaticPaint(background.kind)
    }
    if (mode === "still") showStill()
  }

  function rainOnGlass() {
    if (!input) return
    glass.setRain(
      input.glass ? input.conditions : { ...input.conditions, rainKind: "none" },
      view.width,
      view.height,
      budget,
    )
    if (!input.glass) glass.clear()
  }

  const moveOnly = () => {
    if (!input || !scene) return
    renderer.setMotion(sceneMotion(scene, input.conditions, budget))
    rainOnGlass()
    if (mode === "still") showStill()
  }

  const composeWhenSettled = () => {
    moveOnly()
    recompose = true
    if (input) composedKey = staticKey(input)
    idle.run(repaint(), settleMs)
  }

  const drawAt = (seconds: number) => {
    const started = performance.now()
    const flash = input?.conditions.thunder && !view.reduced ? flashAt(seconds - nextFlash) : 0
    if (seconds - nextFlash > 0.45) nextFlash = seconds + flashGapSeconds.min + Math.random() * flashGapSeconds.spread
    renderer.draw(seconds, glass.drops, flash)
    if (input?.reportFrames) events.frame(performance.now() - started)
  }

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    if (now - lastFrameAt < frameMs) return
    if (frameMs > 0 && idle.sinceInput() < frameMs && now - lastFrameAt < frameMs * 2) return
    const step = Math.min(maxStepSeconds, (now - (lastFrameAt || now)) / 1000)
    lastFrameAt = now
    glass.step(step)
    drawAt((now - startedAt) / 1000)
  }

  function showStill() {
    if (!scene) return
    for (let elapsed = 0; elapsed < stillSettleSeconds; elapsed += stillStepSeconds) glass.step(stillStepSeconds)
    drawAt(stillSettleSeconds + Math.random() * 600)
    events.still(canvas)
  }

  const trace = () => {
    traceFrame = 0
    if (input?.photo) streets.forget()
    if (!visible() || !streets.pending() || input?.awaitingPhoto) return
    traceFrame = requestAnimationFrame(trace)
    if (!idle.quiet()) return
    const street = streets.work(traceSliceMs, idle.inputWaiting)
    if (!street) return
    cancelAnimationFrame(traceFrame)
    traceFrame = 0
    unshown = { kind: "street", ...street }
    idle.run(repaint())
  }

  const stop = () => {
    idle.stop()
    cancelAnimationFrame(frame)
    cancelAnimationFrame(traceFrame)
    self.clearInterval(stillTimer)
    frame = 0
    traceFrame = 0
    stillTimer = 0
  }

  const refresh = () => {
    stop()
    recompose = true
    idle.finish(repaint())
    if (recompose) {
      setMode("paused")
      return
    }
    setMode(view.reduced ? "still" : "running")
    traceFrame = requestAnimationFrame(trace)
    if (mode === "still") {
      showStill()
      stillTimer = self.setInterval(showStill, stillEveryMs)
      return
    }
    lastFrameAt = 0
    nextFlash = (performance.now() - startedAt) / 1000 + 3 + Math.random() * flashGapSeconds.spread
    frame = requestAnimationFrame(tick)
  }

  events.ready(renderer.kind === "webgl" && software ? "webgl-software" : renderer.kind)

  return {
    setView(next) {
      const changed = keysOf(next).some((key) => next[key] !== view[key])
      view = next
      if (changed) refresh()
    },
    update(next) {
      const key = sceneKey(next)
      input = next
      if (key === shownKey) return
      shownKey = key
      const showing = scene !== null && (mode === "running" || mode === "still")
      if (!showing) refresh()
      else if (staticKey(next) === composedKey) moveOnly()
      else composeWhenSettled()
      if (showing && traceFrame === 0) traceFrame = requestAnimationFrame(trace)
    },
    setPhoto(id, layers) {
      if (layers) photos.set(id, layers)
      else photos.delete(id)
    },
    noteInput: () => idle.noteInput(),
    dispose() {
      stop()
      renderer.dispose()
    },
  }
}

const send = (message: FromRunner, transfer: Transferable[] = []) => self.postMessage(message, { transfer })

/**
 * Serves a runner from inside a worker: takes the page's canvas and messages, and sends back the runner's events. The
 * worker entry, `live-sky-worker.js`, only calls this.
 */
function serveSkyRunner() {
  let runner: SkyRunner | null = null
  const events: RunnerEvents = {
    ready: (renderer) => send({ type: "ready", renderer }),
    frame: (milliseconds) => send({ type: "frame", milliseconds }),
    painted: (paints, background) => send({ type: "painted", paints, background }),
    mode: (mode) => send({ type: "mode", mode }),
    still: (canvas) => {
      void createImageBitmap(canvas).then((bitmap) => send({ type: "still", bitmap }, [bitmap]))
    },
  }
  self.addEventListener("message", (event: MessageEvent<ToRunner>) => {
    const message = event.data
    if (message.type === "start") {
      runner =
        typeof requestAnimationFrame === "function" ? createSkyRunner(message.canvas, message.palette, events) : null
      if (!runner) send({ type: "unsupported" })
      return
    }
    if (!runner) return
    if (message.type === "view") runner.setView(message.view)
    else if (message.type === "update") runner.update(message.input)
    else if (message.type === "photo") runner.setPhoto(message.id, message.layers)
    else runner.noteInput()
  })
}

export { createSkyRunner, serveSkyRunner }
export type { EngineMode, FromRunner, RunnerEvents, RunnerInput, RunnerView, SkyRunner, ToRunner }
