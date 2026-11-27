import { createTurntableScene } from "@/components/ui/vinyl-scrubber-scene"
import { createStageRunner, serveStageRunner, type RunnerFactory } from "@/lib/three-stage-runner"

/** The time to draw: seconds at `at` (ms since the epoch), carried on while `moving`. */
type DeckState = {
  time: number
  at: number
  duration: number
  moving: boolean
}

const maxLeadSeconds = 0.4

const epochNow = () => performance.timeOrigin + performance.now()

function shownSeconds({ time, at, duration, moving }: DeckState) {
  const lead = moving ? Math.max(0, Math.min(maxLeadSeconds, (epochNow() - at) / 1000)) : 0
  return duration > 0 ? Math.min(duration, time + lead) : time
}

/**
 * Draws the turntable into `canvas` once per change, and every frame while the record moves. `null` when the canvas
 * has no WebGL.
 */
const createVinylRunner: RunnerFactory<DeckState> = (canvas, size, events) =>
  createStageRunner<DeckState>(
    canvas,
    size,
    events,
    (surface, initial) => {
      const scene = createTurntableScene(surface, initial)
      let labelled = false
      return {
        software: scene.software,
        prepare: scene.prepare,
        setSize: scene.setSize,
        ready: () => labelled,
        animating: (state) => state.moving,
        render(state) {
          const seconds = shownSeconds(state)
          scene.render(seconds, state.duration > 0 ? seconds / state.duration : 0)
        },
        receive(name, asset) {
          if (name !== "label") return
          scene.setLabel(asset)
          labelled = true
        },
        dispose: scene.dispose,
      }
    },
    { time: 0, at: 0, duration: 0, moving: false },
  )

/** Serves the turntable's runner to the page from its worker. */
const serveVinylRunner = () => serveStageRunner(createVinylRunner)

export { createVinylRunner, serveVinylRunner }
export type { DeckState }
