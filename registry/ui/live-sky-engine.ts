import { composeScene, type SkyScene } from "@/components/ui/live-sky-backdrop"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { createGlass } from "@/components/ui/live-sky-glass"
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
const traceSliceMs = 6
const maxTraceRatio = 1.5

function makeCanvas(slot: string) {
  const canvas = document.createElement("canvas")
  canvas.dataset.slot = slot
  canvas.setAttribute("aria-hidden", "true")
  return canvas
}

const sceneKey = ({ conditions, location, glass, photo }: EngineInput) =>
  JSON.stringify([conditions, location.latitude, location.longitude, glass, photo?.id, photo?.view])

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
  const streets = createStreetBuilder((facades) => {
    if (input?.photo) return
    chosen?.plan.renderer.setBackground({ kind: "street", ...facades })
    countStaticPaint()
  })
  let shownPhotoKey = ""
  let traceFrame = 0

  const visible = () => inView && document.visibilityState !== "hidden" && size.width > 1 && size.height > 1
  const reduced = () => motion?.matches ?? false

  const compose = () => {
    if (!chosen || !input || !visible()) return false
    const ratio = Math.min(chosen.plan.maxRatio, devicePixelRatio || 1)
    const photo = input.photo
    const camera = photo ? photoCamera(size.width, size.height, photo.view) : undefined
    scene = composeScene({
      ...size,
      ratio,
      conditions: input.conditions,
      palette: paletteOf(),
      budget: chosen.plan.budget,
      camera,
    })
    if (!scene) return false
    chosen.plan.renderer.setScene(scene)
    countStaticPaint()
    const traceRatio = Math.min(ratio, maxTraceRatio)
    if (photo) {
      const width = Math.round(size.width * traceRatio)
      const height = Math.round(size.height * traceRatio)
      const key = JSON.stringify([photo.id, photo.view.horizon, width, height])
      if (key !== shownPhotoKey) {
        shownPhotoKey = key
        chosen.plan.renderer.setBackground({
          kind: "photo",
          layers: photo.layers,
          horizon: photo.view.horizon,
          width,
          height,
        })
        countStaticPaint()
      }
    } else {
      if (shownPhotoKey !== "") streets.forget()
      shownPhotoKey = ""
      streets.request({ ...size, ratio: traceRatio, location: input.location, palette: paletteOf() })
    }
    glass.setRain(
      input.glass ? input.conditions : { ...input.conditions, rainKind: "none" },
      size.width,
      size.height,
      chosen.plan.budget,
    )
    if (!input.glass) glass.clear()
    return true
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
    if (!chosen || now - lastFrameAt < chosen.plan.frameMs) return
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
    if (!visible() || !streets.pending()) return
    if (streets.work(traceSliceMs)) {
      if (mode === "still") showStill()
      return
    }
    traceFrame = requestAnimationFrame(trace)
  }

  const stop = () => {
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
    if (!compose()) {
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
      refresh()
    },
    mode: () => mode,
    renderer: () => stage.dataset.renderer ?? "none",
    dispose() {
      stop()
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
