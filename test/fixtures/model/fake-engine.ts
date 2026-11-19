import type { ModelScanPointGroup, ModelScanProps, ModelScanStage } from "@/components/ui/model-scan"
import { modelViewerLabels } from "@/components/ui/model-viewer-labels"

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
  // The last event of a run that fails. Cancelling through the AbortSignal isn't one: the run rejects with an
  // AbortError instead.
  | { type: "error"; error: { code: EngineErrorCode; message: string } }

/** Why the engine stopped: the codes are the engine's, the messages its own English for logs. */
type EngineErrorCode =
  | "no-face"
  | "unreadable-image"
  | "webgl2-unavailable"
  | "asset-integrity"
  | "asset-load"
  | "worker"
  | "internal"

const engineMessages: Record<EngineErrorCode, string> = {
  "no-face": "No face detected in the input image.",
  "unreadable-image": "The input image could not be decoded.",
  "webgl2-unavailable": "WebGL2 is not available in this context.",
  "asset-integrity": "A model asset failed its integrity check.",
  "asset-load": "A model asset could not be fetched.",
  worker: "The engine worker terminated unexpectedly.",
  internal: "An internal engine error occurred.",
}

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
  /** Ends the run with this error during the fit (`true`: no face). */
  fail?: boolean | EngineErrorCode
  /** Scales every wait, so tests and checks can run it fast. */
  speed?: number
  /** Stops the run: it emits nothing more and rejects with an AbortError. */
  signal?: AbortSignal
  /** The photo's landmarks to send: the 3:4 portrait's, or the 9:16 one's. */
  photo?: "portrait" | "tall"
}

const abortError = () => new DOMException("The run was cancelled.", "AbortError")

/**
 * Replays a run: the face, then the body landmarks over about a second, the base model, weights streamed over about
 * three seconds, then the final character. Resolves after the last event (`done`, or `error`); rejects with an
 * AbortError once `signal` aborts.
 */
function runFakeEngine(emit: (event: EngineEvent) => void, options: FakeEngineOptions) {
  const { signal } = options
  if (signal?.aborted) return Promise.reject(abortError())
  const timers: ReturnType<typeof setTimeout>[] = []
  const speed = options.speed ?? 1
  let at = 0
  let finish: (() => void) | undefined
  const finished = new Promise<void>((resolve, reject) => {
    finish = resolve
    signal?.addEventListener(
      "abort",
      () => {
        timers.forEach(clearTimeout)
        reject(abortError())
      },
      { once: true },
    )
  })
  const later = (ms: number, run: () => void) => {
    at += ms / speed
    timers.push(setTimeout(run, at))
  }
  emit({ type: "stage", stage: "detect" })
  for (const group of options.photo === "tall" ? figure.tall.landmarks : figure.landmarks) {
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
    const code = options.fail === true ? "no-face" : options.fail
    later(1600, () => {
      emit({ type: "error", error: { code, message: engineMessages[code] } })
      finish?.()
    })
    return finished
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
    finish?.()
  })
  return finished
}

/** What the consumer keeps from the events: the last of each, and every landmarks group. */
type EngineState = {
  stage: EngineStage | "idle" | "error"
  landmarks: readonly Extract<EngineEvent, { type: "landmarks" }>[]
  model?: Extract<EngineEvent, { type: "model" }>
  progress?: Extract<EngineEvent, { type: "progress" }>
  character?: Extract<EngineEvent, { type: "done" }>["character"]
  error?: Extract<EngineEvent, { type: "error" }>["error"]
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
      return { ...state, stage: "error", error: event.error }
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
 * What a person reads for each error code: the consumer's words, not the engine's log messages. Without WebGL2 it is
 * ModelViewer's own line for a browser without WebGL, and a new run can't help, so the demos offer no Retry then.
 */
const scanErrors: Record<EngineErrorCode, string> = {
  "no-face": "No face found. Try a photo that faces the camera.",
  "unreadable-image": "This photo can't be read. Try a JPEG or PNG.",
  "webgl2-unavailable": modelViewerLabels.unsupported,
  "asset-integrity": "The 3D engine's files didn't load correctly. Try again.",
  "asset-load": "The 3D engine couldn't load. Check the connection and try again.",
  worker: "The 3D engine stopped. Try again.",
  internal: "Something went wrong making the 3D model. Try again.",
}

/** Errors a new run can't fix. */
const finalErrors: readonly EngineErrorCode[] = ["webgl2-unavailable"]

/**
 * The engine's state as ModelScan's props. The UI's stage is the consumer's: here the engine's map onto it one to
 * one. The final character replaces the base model (ModelViewer crossfades, keeping the weights), and a smile plays
 * once it's done. `messages` overrides the words per error code.
 */
function toModelScanProps(
  state: EngineState,
  messages: Partial<Record<EngineErrorCode, string>> = {},
): Pick<ModelScanProps, "stage" | "points" | "model" | "weights" | "progress" | "error" | "expressions"> {
  const character = state.character
  return {
    stage: uiStage[state.stage],
    points: state.landmarks as readonly ModelScanPointGroup[],
    model: character ?? state.model,
    weights: character?.weights ?? state.progress?.weights,
    progress: state.stage === "refine" ? state.progress?.value : undefined,
    error: state.error && (messages[state.error.code] ?? scanErrors[state.error.code]),
    expressions: state.stage === "done" ? { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } : undefined,
  }
}

/** Where the fixture's face is, in its own units, for a close-up `framing`. */
const figureFace = {
  center: figure.faceBounds.center as [number, number, number],
  radius: figure.faceBounds.radius,
}

export {
  figureFace,
  figureTargetNames,
  finalErrors,
  idleEngine,
  reduceEngine,
  runFakeEngine,
  scanErrors,
  toModelScanProps,
}
export type { EngineErrorCode, EngineEvent, EngineStage, EngineState, FakeEngineOptions }
