import type { ModelScanPointGroup, ModelScanProps, ModelScanStage } from "@/components/ui/model-scan"

type RecordedEvent = { at: number } & (
  | { type: "stage"; stage: string; ms?: number }
  | { type: "landmarks"; source: "face" | "body"; aspect: number; points: number[] }
  | { type: "model"; glb: string; targetNames: string[] }
  | { type: "progress"; value: number; weights: number[] }
  | {
      type: "done"
      character: { glb: string; weights: number[]; colors: Record<string, string | null>; hair: string }
    }
)

type ScanRecording = {
  subject: string
  targetNames: string[]
  /** What each weight is already multiplied by: the GLBs' `extras.targetScales`. */
  targetScales: number[]
  events: RecordedEvent[]
}

type ScanEvent =
  | { type: "stage"; stage: string; ms?: number }
  | { type: "landmarks"; source: "face" | "body"; aspect: number; points: Float32Array }
  | { type: "model"; glb: string; targetNames: string[] }
  | { type: "progress"; value: number; weights: Float32Array }
  | { type: "done"; character: { glb: string; weights: Float32Array; hair: string } }

type ReplayOptions = {
  /** The URL of a GLB the recording names by file. */
  glb: (file: string) => string
  /** How many times slower than recorded: the engine ran the whole scan in 340 ms. */
  slowdown?: number
  /** Stops the replay: nothing more is emitted, and it rejects with an AbortError. */
  signal?: AbortSignal
}

const abortError = () => new DOMException("The run was cancelled.", "AbortError")

function toLive(event: RecordedEvent, glb: (file: string) => string): ScanEvent {
  switch (event.type) {
    case "stage":
      return { type: "stage", stage: event.stage, ms: event.ms }
    case "landmarks":
      return { type: "landmarks", source: event.source, aspect: event.aspect, points: Float32Array.from(event.points) }
    case "model":
      return { type: "model", glb: glb(event.glb), targetNames: event.targetNames }
    case "progress":
      return { type: "progress", value: event.value, weights: Float32Array.from(event.weights) }
    case "done":
      return {
        type: "done",
        character: {
          glb: glb(event.character.glb),
          weights: Float32Array.from(event.character.weights),
          hair: event.character.hair,
        },
      }
  }
}

function replayScan(recording: ScanRecording, emit: (event: ScanEvent) => void, options: ReplayOptions) {
  const { signal, slowdown = 1 } = options
  if (signal?.aborted) return Promise.reject(abortError())
  const timers: ReturnType<typeof setTimeout>[] = []
  return new Promise<void>((resolve, reject) => {
    signal?.addEventListener(
      "abort",
      () => {
        timers.forEach(clearTimeout)
        reject(abortError())
      },
      { once: true },
    )
    const last = recording.events.at(-1)?.at ?? 0
    for (const event of recording.events)
      timers.push(setTimeout(() => emit(toLive(event, options.glb)), event.at * slowdown))
    timers.push(setTimeout(resolve, last * slowdown))
  })
}

type ScanState = {
  started: boolean
  /** The engine's own name for what it's doing now, like `fit-face`. */
  step?: string
  landmarks: readonly Extract<ScanEvent, { type: "landmarks" }>[]
  model?: Extract<ScanEvent, { type: "model" }>
  progress?: Extract<ScanEvent, { type: "progress" }>
  character?: Extract<ScanEvent, { type: "done" }>["character"]
}

const idleScan: ScanState = { started: false, landmarks: [] }

function reduceScan(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case "stage":
      return { ...state, started: true, step: event.stage }
    case "landmarks":
      return { ...state, landmarks: [...state.landmarks.filter((group) => group.source !== event.source), event] }
    case "model":
      return { ...state, model: event }
    case "progress":
      return { ...state, progress: event }
    case "done":
      return { ...state, character: event.character }
  }
}

function scanStage(state: ScanState): ModelScanStage {
  if (state.character) return "ready"
  if (state.progress) return "refining"
  if (state.model) return "building"
  return state.started ? "detecting" : "photo"
}

function toModelScanProps(state: ScanState): Pick<
  ModelScanProps,
  "stage" | "points" | "model" | "weights" | "scaledWeights" | "progress" | "expressions"
> & {
  stage: ModelScanStage
} {
  const stage = scanStage(state)
  return {
    stage,
    points: state.landmarks as readonly ModelScanPointGroup[],
    model: state.character ?? state.model,
    weights: state.character?.weights ?? state.progress?.weights,
    scaledWeights: true,
    progress: stage === "refining" ? state.progress?.value : undefined,
    expressions: stage === "ready" ? { mouthSmileLeft: 0.6, mouthSmileRight: 0.6 } : undefined,
  }
}

const faceContours = [
  10, 297, 284, 389, 454, 361, 397, 379, 400, 152, 176, 150, 172, 132, 234, 162, 54, 67, 33, 133, 159, 145, 263, 362,
  386, 374, 70, 105, 107, 336, 334, 300, 168, 1, 61, 291, 0, 17,
]

const ring = (from: number, to: number): [number, number][] =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, i === to - from ? from : from + i + 1])

const faceContourEdges: readonly (readonly [number, number])[] = [
  ...ring(0, 17),
  [18, 20],
  [20, 19],
  [19, 21],
  [21, 18],
  [22, 24],
  [24, 23],
  [23, 25],
  [25, 22],
  [26, 27],
  [27, 28],
  [29, 30],
  [30, 31],
  [32, 33],
  [34, 36],
  [36, 35],
  [35, 37],
  [37, 34],
]

const sharedFeatures: readonly (readonly [face: number, body: number])[] = [
  [1, 0],
  [362, 1],
  [263, 3],
  [133, 4],
  [33, 6],
  [291, 9],
  [61, 10],
]

function placeFaceOnBody(
  face: { points: Float32Array; aspect: number },
  body: { points: Float32Array; aspect: number },
): Float32Array {
  const fx = (i: number) => (face.points[i * 2] ?? 0) * face.aspect
  const fy = (i: number) => face.points[i * 2 + 1] ?? 0
  const bx = (i: number) => (body.points[i * 2] ?? 0) * body.aspect
  const by = (i: number) => body.points[i * 2 + 1] ?? 0
  const n = sharedFeatures.length
  const mean = (read: (i: number) => number, side: 0 | 1) =>
    sharedFeatures.reduce((sum, pair) => sum + read(pair[side]), 0) / n
  const [zx, zy, wx, wy] = [mean(fx, 0), mean(fy, 0), mean(bx, 1), mean(by, 1)]
  let real = 0
  let imaginary = 0
  let norm = 0
  for (const [f, b] of sharedFeatures) {
    const [ax, ay, cx, cy] = [fx(f) - zx, fy(f) - zy, bx(b) - wx, by(b) - wy]
    real += cx * ax + cy * ay
    imaginary += cy * ax - cx * ay
    norm += ax * ax + ay * ay
  }
  const [a, b] = [real / norm, imaginary / norm]
  const placed = new Float32Array(faceContours.length * 2)
  faceContours.forEach((index, i) => {
    const [x, y] = [fx(index) - zx, fy(index) - zy]
    placed[i * 2] = (a * x - b * y + wx) / body.aspect
    placed[i * 2 + 1] = b * x + a * y + wy
  })
  return placed
}

function onBodyPhoto(recording: ScanRecording) {
  const recorded = (source: "face" | "body") => {
    const event = recording.events.find((item) => item.type === "landmarks" && item.source === source)
    return event?.type === "landmarks" ? { points: Float32Array.from(event.points), aspect: event.aspect } : undefined
  }
  const [face, body] = [recorded("face"), recorded("body")]
  const placed = face && body ? placeFaceOnBody(face, body) : undefined
  return (landmarks: ScanState["landmarks"]): ScanState["landmarks"] =>
    landmarks.flatMap((group) => {
      if (group.source !== "face") return [group]
      return placed && body ? [{ ...group, aspect: body.aspect, points: placed, edges: faceContourEdges }] : []
    })
}

export { faceContourEdges, idleScan, onBodyPhoto, placeFaceOnBody, reduceScan, replayScan, scanStage, toModelScanProps }
export type { RecordedEvent, ScanEvent, ScanRecording, ScanState }
