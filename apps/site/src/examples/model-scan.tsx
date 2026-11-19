import { Button } from "@/components/ui/button"
import { ModelScan, type ModelScanProps, type ModelScanStage } from "@/components/ui/model-scan"

// A fake engine replays fixed events in the engine's shapes (stage, landmarks, model, progress, done): no ML, and a
// figure generated in code. The two GLBs are the base model and the final character.
import type { EngineState } from "../../../../test/fixtures/model/fake-engine"
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

/** The engine's last events as ModelScan's props: the final character replaces the base model, keeping its weights. */
function toModelScanProps(state: EngineState): Partial<ModelScanProps> & { stage: ModelScanStage } {
  return {
    stage: stages[state.stage],
    points: state.landmarks, // [{ source: "face" | "body", points: Float32Array, aspect }]
    model: state.character ?? state.model, // { glb, targetNames }
    weights: state.character?.weights ?? state.progress?.weights, // Float32Array aligned with targetNames
    progress: state.stage === "refine" ? state.progress?.value : undefined,
    error: state.error,
    expressions: state.stage === "done" ? { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 } : undefined,
  }
}

export default function ModelScanDemo() {
  // The fake engine's events, reduced to the last of each (see test/fixtures/model/fake-engine.ts).
  const { state, start, cancel } = useFakeModelScan({ model: figureUrl, character: figureFinalUrl })
  const props = toModelScanProps(state)

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
        onCancel={props.stage === "photo" ? undefined : cancel}
        onRetry={start}
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
