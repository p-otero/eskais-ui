import type { StageSize } from "@/lib/three-studio"

/** A picture the page draws and hands to the scene by name, such as a record's label. */
type StageAsset = ImageBitmap | HTMLCanvasElement | OffscreenCanvas

/** A three.js scene a runner draws: it draws `State` on request and says while it still moves. */
type StageScene<State> = {
  /** Whether WebGL runs on the CPU, where every frame is costly: the runner then waits for changes to settle. */
  software: boolean
  /** Resolves once the shaders have compiled and the textures are uploaded; it draws nothing before. */
  prepare: () => Promise<void>
  setSize: (size: StageSize) => void
  /** Whether it has what it needs to draw (an asset it waits for); true when left out. */
  ready?: () => boolean
  /** Whether the state still changes on its own, so the runner draws the next frame too. */
  animating: (state: State) => boolean
  render: (state: State) => void
  receive?: (name: string, asset: StageAsset) => void
  dispose: () => void
}

type ToRunner<State> =
  | { type: "start"; canvas: OffscreenCanvas; size: StageSize }
  | { type: "size"; size: StageSize }
  | { type: "state"; state: State }
  | { type: "asset"; name: string; asset: ImageBitmap }
  | { type: "dispose" }

type FromRunner = { type: "shown" } | { type: "unsupported" } | { type: "lost" }

/** `shown` fires after the first frame; `lost` when the WebGL context is gone. */
type RunnerEvents = { shown: () => void; lost: () => void }

type StageRunner<State> = {
  setSize: (size: StageSize) => void
  setState: (state: State) => void
  setAsset: (name: string, asset: StageAsset) => void
  dispose: () => void
}

/** Starts a runner on a canvas: `null` when the canvas has no WebGL. */
type RunnerFactory<State> = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  size: StageSize,
  events: RunnerEvents,
) => StageRunner<State> | null

const gpuPacing = { settleMs: 0, frameMs: 0 }
const softwarePacing = { settleMs: 150, frameMs: 66 }

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

/**
 * Draws `scene` into `canvas` once per change, and every frame while it animates. On a software renderer it waits for
 * changes to settle and draws at most 15 frames a second. `null` when the canvas has no WebGL.
 */
function createStageRunner<State>(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  size: StageSize,
  events: RunnerEvents,
  createScene: (canvas: HTMLCanvasElement | OffscreenCanvas, size: StageSize) => StageScene<State>,
  initial: State,
): StageRunner<State> | null {
  let scene: StageScene<State>
  try {
    scene = createScene(canvas, size)
  } catch {
    return null
  }
  const pacing = scene.software ? softwarePacing : gpuPacing
  let changedAt = 0
  let drawnAt = Number.NEGATIVE_INFINITY
  let state = initial
  let prepared = false
  let cancelPending: (() => void) | null = null
  let shown = false
  let lost = false

  const draw = () => {
    cancelPending = null
    if (lost || !prepared || !(scene.ready?.() ?? true)) return
    scene.render(state)
    drawnAt = performance.now()
    if (!shown) {
      shown = true
      events.shown()
    }
    if (scene.animating(state)) schedule()
  }
  const schedule = () => {
    if (cancelPending !== null) return
    const now = performance.now()
    const settling = scene.animating(state) ? 0 : pacing.settleMs - (now - changedAt)
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
    setAsset(name, asset) {
      scene.receive?.(name, asset)
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
function serveStageRunner<State>(create: RunnerFactory<State>) {
  let runner: StageRunner<State> | null = null
  self.addEventListener("message", (event: MessageEvent<ToRunner<State>>) => {
    const message = event.data
    if (message.type === "start") {
      runner = create(message.canvas, message.size, {
        shown: () => send({ type: "shown" }),
        lost: () => send({ type: "lost" }),
      })
      if (!runner) send({ type: "unsupported" })
      return
    }
    if (!runner) return
    if (message.type === "size") runner.setSize(message.size)
    else if (message.type === "state") runner.setState(message.state)
    else if (message.type === "asset") runner.setAsset(message.name, message.asset)
    else {
      runner.dispose()
      runner = null
      self.close()
    }
  })
}

export { createStageRunner, serveStageRunner }
export type { FromRunner, RunnerEvents, RunnerFactory, StageAsset, StageRunner, StageScene, ToRunner }
