import { Button } from "@/components/ui/button"
import { ModelScan, type ModelScanProps, type ModelScanStage } from "@/components/ui/model-scan"
import { modelViewerLabels } from "@/components/ui/model-viewer-labels"

// A fake engine replays fixed events in the engine's shapes (stage, landmarks, model, progress, done, error): no ML,
// and a figure generated in code. The two GLBs are the base model and the final character.
import type { EngineErrorCode, EngineState } from "../../../../test/fixtures/model/fake-engine"
import figureFinalUrl from "../../../../test/fixtures/model/figure-final.glb?url"
import figureUrl from "../../../../test/fixtures/model/figure.glb?url"
import portraitUrl from "../../../../test/fixtures/model/portrait.svg?url"
import { useFakeModelScan } from "../../../../test/fixtures/model/use-fake-model-scan"

// The engine's stages are its own; the UI's are ModelScan's. Map one onto the other.
const stages: Record<EngineState["stage"], ModelScanStage> = {
  idle: "photo",
  detect: "detecting",
  fit: "building",
  refine: "refining",
  done: "ready",
  error: "error",
}

// The engine's last event of a failed run is { type: "error", error: { code, message } }; its message is for logs.
// What a person reads is yours, per code (pass your own to translate). Cancelling isn't an error: the run rejects with
// an AbortError, which you ignore.
const errorMessages: Record<EngineErrorCode, string> = {
  "no-face": "No face found. Try a photo that faces the camera.",
  "unreadable-image": "This photo can't be read. Try a JPEG or PNG.",
  // The browser can't draw the model at all: ModelViewer's own line for a browser without WebGL, and no Retry.
  "webgl2-unavailable": modelViewerLabels.unsupported,
  "asset-integrity": "The 3D engine's files didn't load correctly. Try again.",
  "asset-load": "The 3D engine couldn't load. Check the connection and try again.",
  worker: "The 3D engine stopped. Try again.",
  internal: "Something went wrong making the 3D model. Try again.",
}

/** The engine's last events as ModelScan's props: the final character replaces the base model, keeping its weights. */
function toModelScanProps(
  state: EngineState,
  messages: Partial<Record<EngineErrorCode, string>> = {},
): Partial<ModelScanProps> & { stage: ModelScanStage } {
  return {
    stage: stages[state.stage],
    points: state.landmarks, // [{ source: "face" | "body", points: Float32Array, aspect }], fractions of the photo
    model: state.character ?? state.model, // { glb, targetNames }
    weights: state.character?.weights ?? state.progress?.weights, // Float32Array aligned with targetNames
    progress: state.stage === "refine" ? state.progress?.value : undefined,
    error: state.error && (messages[state.error.code] ?? errorMessages[state.error.code]),
    expressions: state.stage === "done" ? { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } : undefined,
  }
}

export default function ModelScanDemo() {
  // The fake engine's events, reduced to the last of each (see test/fixtures/model/fake-engine.ts).
  const { state, start, cancel, running } = useFakeModelScan({ model: figureUrl, character: figureFinalUrl })
  const props = toModelScanProps(state)
  const retry = state.error?.code !== "webgl2-unavailable"

  return (
    <div className="flex w-full max-w-sm flex-col gap-group">
      <ModelScan
        src={portraitUrl}
        alt="A front photo of a stylised figure"
        width={600}
        height={800}
        {...props}
        modelAlt="A 3D stylised figure in a teal shirt"
        idleClip="Wave"
        onCancel={running ? cancel : undefined}
        onRetry={retry ? start : undefined}
        actions={
          props.stage === "photo" ? (
            <Button size="sm" onClick={start}>
              Make 3D
            </Button>
          ) : props.stage === "ready" || props.stage === "error" ? (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Start over
            </Button>
          ) : null
        }
      />
    </div>
  )
}
