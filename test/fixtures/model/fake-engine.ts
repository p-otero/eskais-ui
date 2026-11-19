import type { ModelScanPointGroup, ModelScanProps, ModelScanStage } from "@/components/ui/model-scan"

import figure from "./figure.json"

// The events a photo-to-3D engine emits, as it emits them. Nothing here runs a model: it replays fixed data.

type EngineStage = "detect" | "fit" | "refine" | "done"

/** The bytes of a GLB, or its URL. */
type Glb = ArrayBuffer | string

type EngineEvent =
  | { type: "stage"; stage: EngineStage; ms?: number }
  | { type: "landmarks"; source: "face" | "body"; points: Float32Array; aspect: number }
  | { type: "model"; glb: Glb; targetNames: string[] }
  | { type: "progress"; value: number; weights: Float32Array }
  | {
      type: "done"
      character: {
        glb: Glb
        targetNames: string[]
        weights: Float32Array
        colors: Record<string, string>
        hair: string
        quality: number
      }
    }
  // The fake's own: how this demo ends a run that fails.
  | { type: "error"; message: string }

/** The fixture's morph targets, in the order the engine's weights follow. */
const figureTargetNames = [
  "body.pc00",
  "face.head_size.incr",
  "face.head_size.decr",
  "expr.mouthSmileLeft",
  "expr.mouthSmileRight",
  "expr.eyeBlinkLeft",
  "expr.eyeBlinkRight",
]

// Where the fit settles: a broader build and a slightly larger head.
const fitted = [0.55, 0.45, 0, 0, 0, 0, 0]

type FakeEngineOptions = {
  /** The base GLB the engine sends with `model`. */
  model: Glb
  /** The final character's GLB, sent with `done`. */
  character: Glb
  /** Ends the run with an error during the fit. */
  fail?: boolean
  /** Scales every wait, so tests and checks can run it fast. */
  speed?: number
}

/**
 * Replays a run: the face, then the body landmarks over about a second, the base model, weights streamed over about
 * three seconds, then the final character. Returns a function that stops it.
 */
function runFakeEngine(emit: (event: EngineEvent) => void, options: FakeEngineOptions) {
  const timers: ReturnType<typeof setTimeout>[] = []
  const speed = options.speed ?? 1
  let at = 0
  const later = (ms: number, run: () => void) => {
    at += ms / speed
    timers.push(setTimeout(run, at))
  }
  const stop = () => timers.forEach(clearTimeout)
  emit({ type: "stage", stage: "detect" })
  for (const group of figure.landmarks) {
    later(450, () =>
      emit({
        type: "landmarks",
        source: group.source as "face" | "body",
        points: Float32Array.from(group.points),
        aspect: group.aspect,
      }),
    )
  }
  later(300, () => {
    emit({ type: "stage", stage: "fit", ms: 1200 })
    emit({ type: "model", glb: options.model, targetNames: figureTargetNames })
  })
  if (options.fail) {
    later(1600, () => emit({ type: "error", message: "The engine could not fit a model to this photo." }))
    return stop
  }
  later(2400, () => emit({ type: "stage", stage: "refine", ms: 3000 }))
  const steps = 20
  for (let step = 1; step <= steps; step += 1) {
    const value = step / steps
    later(150, () => emit({ type: "progress", value, weights: Float32Array.from(fitted, (weight) => weight * value) }))
  }
  later(200, () => {
    emit({
      type: "done",
      character: {
        glb: options.character,
        targetNames: figureTargetNames,
        weights: Float32Array.from(fitted),
        colors: { skin: "#f1c27d", shirt: "#2f9e8f" },
        hair: "#3a2418",
        quality: 0.92,
      },
    })
    emit({ type: "stage", stage: "done" })
  })
  return stop
}

/** What the consumer keeps from the events: the last of each, and every landmarks group. */
type EngineState = {
  stage: EngineStage | "idle" | "error"
  landmarks: readonly Extract<EngineEvent, { type: "landmarks" }>[]
  model?: Extract<EngineEvent, { type: "model" }>
  progress?: Extract<EngineEvent, { type: "progress" }>
  character?: Extract<EngineEvent, { type: "done" }>["character"]
  error?: string
}

const idleEngine: EngineState = { stage: "idle", landmarks: [] }

function reduceEngine(state: EngineState, event: EngineEvent): EngineState {
  switch (event.type) {
    case "stage":
      return { ...state, stage: event.stage }
    case "landmarks":
      return { ...state, landmarks: [...state.landmarks.filter((group) => group.source !== event.source), event] }
    case "model":
      return { ...state, model: event }
    case "progress":
      return { ...state, progress: event }
    case "done":
      return { ...state, character: event.character }
    case "error":
      return { ...state, stage: "error", error: event.message }
  }
}

const uiStage: Record<EngineState["stage"], ModelScanStage> = {
  idle: "photo",
  detect: "detecting",
  fit: "building",
  refine: "refining",
  done: "ready",
  error: "error",
}

/**
 * The engine's state as ModelScan's props. The UI's stage is the consumer's: here the engine's map onto it one to
 * one. The final character replaces the base model (ModelViewer crossfades, keeping the weights), and a smile plays
 * once it's done.
 */
function toModelScanProps(
  state: EngineState,
): Pick<ModelScanProps, "stage" | "points" | "model" | "weights" | "progress" | "error" | "expressions"> {
  const character = state.character
  return {
    stage: uiStage[state.stage],
    points: state.landmarks as readonly ModelScanPointGroup[],
    model: character ?? state.model,
    weights: character?.weights ?? state.progress?.weights,
    progress: state.stage === "refine" ? state.progress?.value : undefined,
    error: state.error,
    expressions: state.stage === "done" ? { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } : undefined,
  }
}

/** Where the fixture's face is, in its own units, for a close-up `framing`. */
const figureFace = {
  center: figure.faceBounds.center as [number, number, number],
  radius: figure.faceBounds.radius,
}

export { figureFace, figureTargetNames, idleEngine, reduceEngine, runFakeEngine, toModelScanProps }
export type { EngineEvent, EngineStage, EngineState, FakeEngineOptions }
