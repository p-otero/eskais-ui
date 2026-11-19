import type { ModelScanPoint, ModelScanStage } from "@/components/ui/model-scan"

import figure from "./figure.json"

/** What a photo-to-3D engine reports, in the shape ModelScan takes as props. */
type FakeModelScanState = {
  stage: ModelScanStage
  points: readonly ModelScanPoint[]
  model?: string
  weights?: Record<string, number>
  progress?: number
  error?: string
}

type FakeModelEngineOptions = {
  /** The GLB the engine "builds". */
  model: string
  /** Stops at the end of building with an error. */
  fail?: boolean
  /** Scales every wait, so tests can run it fast. */
  speed?: number
}

const initialModelScan: FakeModelScanState = { stage: "photo", points: [] }

// The weights the engine settles on: a broader build, a slightly larger head and a smile.
const finalWeights: Record<string, number> = { Build: 0.55, HeadSize: 0.45, Smile: 1 }

/**
 * A stand-in for a local model, with no ML: points over about a second, a base model, then weights streamed over
 * about three seconds. Returns a function that stops it.
 */
function runFakeModelEngine(update: (patch: Partial<FakeModelScanState>) => void, options: FakeModelEngineOptions) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const speed = options.speed ?? 1
  let at = 0
  const later = (ms: number, run: () => void) => {
    at += ms / speed
    timers.push(setTimeout(run, at))
  }
  const points = figure.points as ModelScanPoint[]
  update({ stage: "detecting", points: [], model: undefined, weights: undefined, progress: 0, error: undefined })
  const batch = 6
  for (let index = batch; index < points.length + batch; index += batch) {
    const shown = Math.min(index, points.length)
    later(80, () => update({ points: points.slice(0, shown), progress: shown / points.length }))
  }
  later(250, () => update({ stage: "building", model: options.model, progress: undefined }))
  if (options.fail) {
    later(1600, () => update({ stage: "error", error: "The engine could not fit a model to this photo." }))
    return () => timers.forEach(clearTimeout)
  }
  later(2400, () => update({ stage: "refining", weights: {}, progress: 0 }))
  const steps = 20
  for (let step = 1; step <= steps; step += 1) {
    const share = step / steps
    later(150, () =>
      update({
        progress: share,
        weights: Object.fromEntries(
          Object.entries(finalWeights).map(([name, value]) => [name, Math.round(value * share * 100) / 100]),
        ),
      }),
    )
  }
  later(200, () => update({ stage: "ready", progress: undefined }))
  return () => timers.forEach(clearTimeout)
}

/** Where the fixture's face is, in its own units, for a close-up `framing`. */
const figureFace = { center: figure.face.center as [number, number, number], radius: figure.face.radius }

export { figureFace, initialModelScan, runFakeModelEngine }
export type { FakeModelEngineOptions, FakeModelScanState }
