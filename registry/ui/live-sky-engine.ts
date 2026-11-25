import { composeScene, sceneMotion, type SkyBackground, type SkyScene } from "@/components/ui/live-sky-backdrop"
import { steppedRain, type SkyConditions } from "@/components/ui/live-sky-conditions"
import { createGlass } from "@/components/ui/live-sky-glass"
import { createIdleWork, type IdleJob } from "@/components/ui/live-sky-idle"
import { readPalette } from "@/components/ui/live-sky-palette"
import { photoCamera, type LiveSkyPhotoView, type PhotoLayers } from "@/components/ui/live-sky-photo"
import { planRenderer } from "@/components/ui/live-sky-renderer"
import { createStreetBuilder } from "@/components/ui/live-sky-street-builder"
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

/** What the engine is doing, for tests and checks: drawing every frame, holding a still, or idle while hidden. */
type EngineMode = "running" | "still" | "paused" | "unsupported"

type SkyEngine = {
  update: (input: EngineInput) => void
  dispose: () => void
  mode: () => EngineMode
  renderer: () => string
}

const stillEveryMs = 9000
const crossfadeMs = 2400
const stillSettleSeconds = 6
const stillStepSeconds = 1 / 30
const maxStepSeconds = 0.1
const flashGapSeconds = { min: 7, spread: 12 }
const traceSliceMs = 2
const settleMs = 250
const maxTraceRatio = 1.5

function makeCanvas(slot: string) {
  const canvas = document.createElement("canvas")
  canvas.dataset.slot = slot
  canvas.setAttribute("aria-hidden", "true")
  return canvas
}

const sceneKey = ({ conditions, location, glass, photo, awaitingPhoto }: EngineInput) =>
  JSON.stringify([conditions, location.latitude, location.longitude, glass, photo?.id, photo?.view, awaitingPhoto])

const staticKey = ({ conditions, location, photo }: EngineInput) =>
  JSON.stringify([steppedRain(conditions), location.latitude, location.longitude, photo?.id, photo?.view])

function flashAt(sinceFlash: number) {
  if (sinceFlash < 0 || sinceFlash > 0.45) return 0
  return Math.max(0, 1 - sinceFlash / 0.09) * 0.8 + Math.max(0, 1 - Math.abs(sinceFlash - 0.22) / 0.12) * 0.55
}

/** Draws a live sky into a stage element: one frame loop while it's visible and motion is welcome, stills otherwise. */
function createSkyEngine(stage: HTMLElement): SkyEngine {
  const chosen = planRenderer(() => makeCanvas("live-sky-canvas"))
  const stills = [makeCanvas("live-sky-still"), makeCanvas("live-sky-still")] as const
  for (const still of stills) still.style.setProperty("transition-duration", `${String(crossfadeMs)}ms`, "important")
  const glass = createGlass()
  let input: EngineInput | null = null
  let scene: SkyScene | null = null
  let size = { width: 0, height: 0 }
  let inView = typeof IntersectionObserver !== "function"
  let frame = 0
  let stillTimer = 0
  let lastFrameAt = 0
  const startedAt = performance.now()
  let front: 0 | 1 = 0
  let nextFlash = Number.POSITIVE_INFINITY
  let shownKey = ""
  let composedKey = ""
  let recompose = false
  let unshown: SkyBackground | null = null
  const idle = createIdleWork(settleMs)
  let palette: ReturnType<typeof readPalette> | null = null
  const paletteOf = () => (palette ??= readPalette(stage))
  let mode: EngineMode = chosen ? "paused" : "unsupported"
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null

  if (chosen) stage.append(chosen.canvas, ...stills)
  let staticPaints = 0
  const countStaticPaint = () => {
    staticPaints += 1
    stage.dataset.staticPaints = String(staticPaints)
  }
  const streets = createStreetBuilder()
  let shownPhotoKey = ""
  let traceFrame = 0

  const visible = () => inView && document.visibilityState !== "hidden" && size.width > 1 && size.height > 1
  const reduced = () => motion?.matches ?? false

  const composeNext = () => {
    if (!chosen || !input) return null
    const ratio = Math.min(chosen.plan.maxRatio, devicePixelRatio || 1)
    const photo = input.photo
    const camera = photo ? photoCamera(size.width, size.height, photo.view) : undefined
    const next = composeScene({
      ...size,
      ratio,
      conditions: steppedRain(input.conditions),
      moving: input.conditions,
      palette: paletteOf(),
      budget: chosen.plan.budget,
      camera,
    })
    if (!next) return null
    composedKey = staticKey(input)
    const traceRatio = Math.min(ratio, maxTraceRatio)
    if (photo) {
      const width = Math.round(size.width * traceRatio)
      const height = Math.round(size.height * traceRatio)
      const key = JSON.stringify([photo.id, photo.view.horizon, width, height])
      if (key !== shownPhotoKey) {
        shownPhotoKey = key
        unshown = { kind: "photo", layers: photo.layers, horizon: photo.view.horizon, width, height }
      }
    } else {
      if (shownPhotoKey !== "") streets.forget()
      shownPhotoKey = ""
      const preview = streets.request({ ...size, ratio: traceRatio, location: input.location, palette: paletteOf() })
      if (preview) unshown = { kind: "street", ...preview }
    }
    rainOnGlass()
    return next
  }

  function* repaint(): IdleJob {
    if (!chosen || !visible()) return
    const next = recompose ? composeNext() : null
    if (recompose && !next) return
    const shown = next ?? scene
    if (!shown) return
    if (next) yield
    const background = unshown
    yield* chosen.plan.renderer.show(shown, background)
    if (next) {
      scene = next
      recompose = false
      countStaticPaint()
      if (input) chosen.plan.renderer.setMotion(sceneMotion(next, input.conditions, chosen.plan.budget))
    }
    if (background) {
      if (unshown === background) unshown = null
      stage.dataset.background = background.kind
      countStaticPaint()
    }
    if (mode === "still") showStill()
  }

  function rainOnGlass() {
    if (!chosen || !input) return
    glass.setRain(
      input.glass ? input.conditions : { ...input.conditions, rainKind: "none" },
      size.width,
      size.height,
      chosen.plan.budget,
    )
    if (!input.glass) glass.clear()
  }

  const moveOnly = () => {
    if (!chosen || !input || !scene) return
    chosen.plan.renderer.setMotion(sceneMotion(scene, input.conditions, chosen.plan.budget))
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
    if (!chosen) return
    const started = performance.now()
    const flash = input?.conditions.thunder && !reduced() ? flashAt(seconds - nextFlash) : 0
    if (seconds - nextFlash > 0.45) nextFlash = seconds + flashGapSeconds.min + Math.random() * flashGapSeconds.spread
    chosen.plan.renderer.draw(seconds, glass.drops, flash)
    input?.onFrame?.(performance.now() - started)
  }

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    if (!chosen) return
    const { frameMs } = chosen.plan
    if (now - lastFrameAt < frameMs) return
    if (frameMs > 0 && idle.sinceInput() < frameMs && now - lastFrameAt < frameMs * 2) return
    const step = Math.min(maxStepSeconds, (now - (lastFrameAt || now)) / 1000)
    lastFrameAt = now
    glass.step(step)
    drawAt((now - startedAt) / 1000)
  }

  const showStill = () => {
    if (!chosen || !scene) return
    for (let elapsed = 0; elapsed < stillSettleSeconds; elapsed += stillStepSeconds) glass.step(stillStepSeconds)
    drawAt(stillSettleSeconds + Math.random() * 600)
    front = front === 0 ? 1 : 0
    const target = front === 0 ? stills[0] : stills[1]
    target.width = chosen.canvas.width
    target.height = chosen.canvas.height
    target.getContext("2d")?.drawImage(chosen.canvas, 0, 0)
    target.dataset.front = ""
    delete (front === 0 ? stills[1] : stills[0]).dataset.front
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
    clearInterval(stillTimer)
    frame = 0
    traceFrame = 0
    stillTimer = 0
  }

  const refresh = () => {
    stop()
    if (!chosen) return
    recompose = true
    idle.finish(repaint())
    if (recompose) {
      mode = "paused"
      stage.dataset.mode = mode
      return
    }
    mode = reduced() ? "still" : "running"
    stage.dataset.mode = mode
    traceFrame = requestAnimationFrame(trace)
    if (mode === "still") {
      showStill()
      stillTimer = window.setInterval(showStill, stillEveryMs)
      return
    }
    lastFrameAt = 0
    nextFlash = (performance.now() - startedAt) / 1000 + 3 + Math.random() * flashGapSeconds.spread
    frame = requestAnimationFrame(tick)
  }

  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return
    const next = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }
    if (next.width === size.width && next.height === size.height) return
    size = next
    refresh()
  })
  resize.observe(stage)
  const intersection =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          const next = entries.some((entry) => entry.isIntersecting)
          if (next === inView) return
          inView = next
          refresh()
        })
      : null
  intersection?.observe(stage)
  document.addEventListener("visibilitychange", refresh)
  motion?.addEventListener("change", refresh)
  stage.dataset.renderer = chosen
    ? chosen.plan.renderer.kind === "webgl" && chosen.plan.software
      ? "webgl-software"
      : chosen.plan.renderer.kind
    : "none"

  return {
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
    mode: () => mode,
    renderer: () => stage.dataset.renderer ?? "none",
    dispose() {
      stop()
      idle.dispose()
      resize.disconnect()
      intersection?.disconnect()
      document.removeEventListener("visibilitychange", refresh)
      motion?.removeEventListener("change", refresh)
      chosen?.plan.renderer.dispose()
      chosen?.canvas.remove()
      for (const still of stills) still.remove()
    },
  }
}

export { createSkyEngine }
export type { EngineInput, EngineMode, ShownPhoto, SkyEngine }
