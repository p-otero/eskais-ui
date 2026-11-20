import { useState } from "react"
import type { Object3D } from "three"

import { ModelScan } from "@/components/ui/model-scan"

// A recorded scan of a synthetic person (CC0 demo assets, no real person), replayed from the open-source engine's
// own events by their timestamps, 15 times slower than it ran: the landmarks it found, the person's mask, the base
// model, the weights it streamed and the finished character. See test/fixtures/model/character/scan-replay.ts.
import cel from "../../../../test/fixtures/model/character/character-cel-outline.glb?url"
import soft from "../../../../test/fixtures/model/character/character-soft-toon.glb?url"
import photoUrl from "../../../../test/fixtures/model/character/photo-body.png?url"
import { useScanReplay } from "../../../../test/fixtures/model/character/use-scan-replay"

// The character's materials carry its style; this builds it before the first frame, loaded with the 3D chunk.
const restyle = async (scene: Object3D) =>
  (await import("../../../../test/fixtures/model/character/style")).styleCharacter(scene)

const characters = { soft, cel }
const styles = [
  { value: "soft", label: "Soft toon" },
  { value: "cel", label: "Cel outline" },
]

function download(url: string, name: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
}

export default function ModelScanDemo() {
  // The engine's events reduced to the last of each, as ModelScan's props: stage, points, masks, model, weights,
  // progress. Its weights come multiplied by the GLB's extras.targetScales already, so they go with `scaledWeights`.
  const { props, start, cancel, running } = useScanReplay()
  const [style, setStyle] = useState<keyof typeof characters>("soft")

  return (
    <div className="flex w-full max-w-sm flex-col gap-group">
      <ModelScan
        src={photoUrl}
        alt="A full-length photo of a person with a red bob, in a grey top and shorts"
        width={540}
        height={960}
        {...props}
        // The finished character in the chosen style: the engine hands over one GLB per style.
        model={props.stage === "ready" ? { glb: characters[style] } : props.model}
        modelAlt="A 3D character made from the photo"
        idleClip="wave"
        viewer={{ onModelLoad: restyle }}
        labels={{ play: "Wave" }}
        styles={styles}
        selectedStyle={style}
        onStyleChange={(next) => setStyle(next as keyof typeof characters)}
        onStart={start}
        onCancel={running ? cancel : undefined}
        onStartOver={cancel}
        onDownload={() => download(characters[style], `character-${style}.glb`)}
      />
    </div>
  )
}
