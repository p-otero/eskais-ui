import { createTurntableScene, type LabelImage, type StageSize } from "@/components/ui/vinyl-scrubber-scene"

/** The time to draw: seconds at `at` (ms since the epoch), carried on while `moving`. */
type DeckState = { time: number; at: number; duration: number; moving: boolean }

type ToRunner =
  | { type: "start"; canvas: OffscreenCanvas; size: StageSize }
  | { type: "size"; size: StageSize }
  | { type: "state"; state: DeckState }
  | { type: "label"; image: ImageBitmap }
  | { type: "dispose" }

type FromRunner = { type: "shown" } | { type: "unsupported" } | { type: "lost" }

/** `shown` fires after the first frame with the label; `lost` when the WebGL context is gone. */
type RunnerEvents = { shown: () => void; lost: () => void }

type VinylRunner = {
  setSize: (size: StageSize) => void
  setState: (state: DeckState) => void
  setLabel: (image: LabelImage) => void
  dispose: () => void
}

const maxLeadSeconds = 0.4

const epochNow = () => performance.timeOrigin + performance.now()

function requestFrame(draw: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }
  const timer = setTimeout(draw, 16)
  return () => clearTimeout(timer)
}

function after(milliseconds: number, run: () => void): () => void {
  const timer = setTimeout(run, milliseconds)
  return () => clearTimeout(timer)
}

const gpuPacing = { settleMs: 0, frameMs: 0 }
const softwarePacing = { settleMs: 150, frameMs: 66 }

function shownSeconds({ time, at, duration, moving }: DeckState) {
  const lead = moving ? Math.max(0, Math.min(maxLeadSeconds, (epochNow() - at) / 1000)) : 0
  return duration > 0 ? Math.min(duration, time + lead) : time
}

/**
 * Draws the turntable into `canvas` once per change, and every frame while the record moves. `null` when the canvas
 * has no WebGL.
 */
function createVinylRunner(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  size: StageSize,
  events: RunnerEvents,
): VinylRunner | null {
  let scene: ReturnType<typeof createTurntableScene>
  try {
    scene = createTurntableScene(canvas, size)
  } catch {
    return null
  }
  const pacing = scene.software ? softwarePacing : gpuPacing
  let changedAt = 0
  let drawnAt = Number.NEGATIVE_INFINITY
  let state: DeckState = { time: 0, at: 0, duration: 0, moving: false }
  let labelled = false
  let prepared = false
  let cancelPending: (() => void) | null = null
  let shown = false
  let lost = false

  const draw = () => {
    cancelPending = null
    if (lost || !labelled || !prepared) return
    const seconds = shownSeconds(state)
    scene.render(seconds, state.duration > 0 ? seconds / state.duration : 0)
    drawnAt = performance.now()
    if (!shown) {
      shown = true
      events.shown()
    }
    if (state.moving) schedule()
  }
  const schedule = () => {
    if (cancelPending !== null) return
    const now = performance.now()
    const settling = state.moving ? 0 : pacing.settleMs - (now - changedAt)
    const wait = Math.max(settling, pacing.frameMs - (now - drawnAt))
    cancelPending =
      wait > 0
        ? after(wait, () => {
            cancelPending = null
            schedule()
          })
        : requestFrame(draw)
  }

  void scene.prepare().then(
    () => {
      prepared = true
      schedule()
    },
    () => {
      lost = true
      events.lost()
    },
  )

  canvas.addEventListener("webglcontextlost", () => {
    lost = true
    events.lost()
  })

  return {
    setSize(next) {
      scene.setSize(next)
      schedule()
    },
    setState(next) {
      state = next
      changedAt = performance.now()
      schedule()
    },
    setLabel(image) {
      scene.setLabel(image)
      labelled = true
      schedule()
    },
    dispose() {
      cancelPending?.()
      lost = true
      scene.dispose()
    },
  }
}

function send(message: FromRunner) {
  self.postMessage(message, { transfer: [] })
}

/** Serves a runner to the page from a worker: the page sends `ToRunner` messages and hears `FromRunner` ones. */
function serveVinylRunner() {
  let runner: VinylRunner | null = null
  self.addEventListener("message", (event: MessageEvent<ToRunner>) => {
    const message = event.data
    if (message.type === "start") {
      runner = createVinylRunner(message.canvas, message.size, {
        shown: () => send({ type: "shown" }),
        lost: () => send({ type: "lost" }),
      })
      if (!runner) send({ type: "unsupported" })
      return
    }
    if (!runner) return
    if (message.type === "size") runner.setSize(message.size)
    else if (message.type === "state") runner.setState(message.state)
    else if (message.type === "label") runner.setLabel(message.image)
    else {
      runner.dispose()
      runner = null
      self.close()
    }
  })
}

export { createVinylRunner, serveVinylRunner }
export type { DeckState, FromRunner, RunnerEvents, ToRunner, VinylRunner }
