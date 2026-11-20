import type { Object3D } from "three"

import { Button } from "@/components/ui/button"
import { ModelScan } from "@/components/ui/model-scan"

// A recorded scan of a synthetic person (CC0 demo assets, no real person), replayed from the open-source engine's
// own events by their timestamps, 15 times slower than it ran: the landmarks it found, the base model, the weights it
// streamed and the finished character. See test/fixtures/model/character/scan-replay.ts for the mapping.
import photoUrl from "../../../../test/fixtures/model/character/photo-body.png?url"
import { useScanReplay } from "../../../../test/fixtures/model/character/use-scan-replay"

// The character's materials carry its style; this builds it before the first frame, loaded with the 3D chunk.
const restyle = async (scene: Object3D) =>
  (await import("../../../../test/fixtures/model/character/style")).styleCharacter(scene)

export default function ModelScanDemo() {
  // The engine's events reduced to the last of each, as ModelScan's props: stage, points, model, weights, progress.
  // Its weights come multiplied by the GLB's extras.targetScales already, so they go with `scaledWeights`.
  const { props, start, cancel, running } = useScanReplay()

  return (
    <div className="flex w-full max-w-sm flex-col gap-group">
      <ModelScan
        src={photoUrl}
        alt="A full-length photo of a person with a red bob, in a grey top and shorts"
        width={540}
        height={960}
        {...props}
        modelAlt="A 3D character made from the photo"
        idleClip="wave"
        viewer={{ onModelLoad: restyle }}
        onCancel={running ? cancel : undefined}
        actions={
          props.stage === "photo" ? (
            <Button size="sm" onClick={start}>
              Make 3D
            </Button>
          ) : props.stage === "ready" ? (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Start over
            </Button>
          ) : null
        }
      />
    </div>
  )
}
