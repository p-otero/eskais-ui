import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ModelScan } from "@/components/ui/model-scan"
import { ModelViewer } from "@/components/ui/model-viewer"

import {
  engineModels,
  figureFinalUrl,
  figureTargetNames,
  figureUrl,
  portrait,
  tallPortrait,
  useFakeModelScan,
  type EngineErrorCode,
} from "../sections/model-fixtures"

// ?demo=model-check: a ModelViewer whose weights a button changes, and a ModelScan run by the fake engine (?speed=
// scales its waits, ?fail ends it in an error, ?fail=<code> in that one, ?photo=tall takes a 9:16 photo, ?fit=cover and
// ?stage=<ratio> crop it into a stage of another ratio) whose Start scan hides while a run goes, above a tall spacer to scroll them out of view, for tooling/model-check.mjs.
// Weights as the engine sends them: a Float32Array aligned with the GLB's target names.
const rest = new Float32Array(figureTargetNames.length)
const morphed = Float32Array.from(figureTargetNames, (name) => (name.endsWith(".decr") ? 0 : 1))

function ModelCheck() {
  const params = new URLSearchParams(location.search)
  const speed = Number(params.get("speed") ?? "1")
  const failCode = params.get("fail")
  const photo = params.get("photo") === "tall" ? "tall" : "portrait"
  const shot = photo === "tall" ? tallPortrait : portrait
  const fit = params.get("fit") === "cover" ? "cover" : "contain"
  const stageRatio = params.has("stage") ? Number(params.get("stage")) : undefined
  const { props, start, cancel, running, canRetry } = useFakeModelScan(engineModels, {
    speed,
    fail: failCode ? (failCode as EngineErrorCode) : params.has("fail"),
    photo,
  })
  const [weights, setWeights] = useState(rest)
  const [model, setModel] = useState(figureUrl)
  return (
    <main className="flex flex-col items-start gap-section p-group">
      <section data-testid="viewer" aria-label="Viewer" className="flex w-full max-w-md flex-col gap-items">
        <ModelViewer
          model={model}
          alt="A stylised figure"
          poster={portrait.src}
          aspectRatio={3 / 4}
          weights={weights}
          summary="A standing figure in a teal shirt."
        />
        <div className="flex flex-wrap gap-items">
          <Button size="sm" onClick={() => setWeights(morphed)}>
            Morph
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeights(rest)}>
            Unmorph
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModel((current) => (current === figureUrl ? figureFinalUrl : figureUrl))}
          >
            Swap model
          </Button>
        </div>
      </section>
      <section data-testid="scan" aria-label="Scan" className="flex w-full max-w-sm flex-col gap-items">
        <ModelScan
          src={shot.src}
          alt="A front photo of a stylised figure"
          width={shot.width}
          height={shot.height}
          {...props}
          modelAlt="A 3D stylised figure"
          fit={fit}
          aspectRatio={stageRatio}
          onCancel={props.stage === "photo" ? undefined : cancel}
          onRetry={canRetry ? start : undefined}
          actions={
            running ? null : (
              <Button size="sm" onClick={start}>
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
