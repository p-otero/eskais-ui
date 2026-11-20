import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ModelScan } from "@/components/ui/model-scan"
import { ModelViewer } from "@/components/ui/model-viewer"

import {
  character,
  engineModels,
  photo,
  portrait,
  restyle,
  useFakeModelScan,
  useScanReplay,
  type EngineErrorCode,
} from "../sections/model-fixtures"
import { useModelProbe } from "./use-model-probe"

// ?demo=model-check, for tooling/model-check.mjs: the demo character with expression and style buttons, and a scan
// replaying its recording (?slowdown= stretches it, ?fit=cover&stage=<ratio> crops the photo). ?fail[=<code>] runs a
// fake engine that fails instead, since the recording has no error. A tall spacer scrolls both out of view.
const rest = {}
const morphed = { jawOpen: 1, mouthSmileLeft: 1, mouthSmileRight: 1, browInnerUp: 1 }

function ViewerProbe() {
  useModelProbe("viewer")
  return null
}

function ModelCheck() {
  const params = new URLSearchParams(location.search)
  const slowdown = Number(params.get("slowdown") ?? "15")
  const failCode = params.get("fail")
  const failing = params.has("fail")
  const fit = params.get("fit") === "cover" ? "cover" : "contain"
  const stageRatio = params.has("stage") ? Number(params.get("stage")) : undefined
  const replay = useScanReplay({ slowdown })
  const fake = useFakeModelScan(engineModels, {
    speed: 4,
    fail: failCode ? (failCode as EngineErrorCode) : failing,
  })
  const scan = failing ? fake : replay
  const shot = failing ? portrait : photo
  const [expressions, setExpressions] = useState<Record<string, number>>(rest)
  const [style, setStyle] = useState<keyof typeof character>("soft")
  return (
    <main className="flex flex-col items-start gap-section p-group">
      <section data-testid="viewer" aria-label="Viewer" className="flex w-full max-w-md flex-col gap-items">
        <ModelViewer
          model={character[style]}
          alt="A 3D character"
          aspectRatio={3 / 4}
          expressions={expressions}
          onModelLoad={restyle}
          sceneChildren={<ViewerProbe />}
          summary="A standing character with a red bob, in a blue T-shirt and dark trousers."
        />
        <div className="flex flex-wrap gap-items">
          <Button size="sm" onClick={() => setExpressions(morphed)}>
            Morph
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpressions(rest)}>
            Unmorph
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStyle((current) => (current === "soft" ? "cel" : "soft"))}
          >
            Swap model
          </Button>
        </div>
      </section>
      <section data-testid="scan" aria-label="Scan" className="flex w-full max-w-sm flex-col gap-items">
        <ModelScan
          src={shot.src}
          alt="A full-length photo of a person"
          width={shot.width}
          height={shot.height}
          {...scan.props}
          modelAlt="A 3D character"
          idleClip="wave"
          fit={fit}
          aspectRatio={stageRatio}
          viewer={{ onModelLoad: failing ? undefined : restyle }}
          onCancel={scan.props.stage === "photo" ? undefined : scan.cancel}
          onRetry={failing && fake.canRetry ? fake.start : undefined}
          actions={
            scan.running ? null : (
              <Button size="sm" onClick={scan.start}>
                Start scan
              </Button>
            )
          }
        />
      </section>
      <div data-testid="spacer" className="h-750 w-px" />
    </main>
  )
}

export { ModelCheck }
