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
  useFakeModelScan,
} from "../sections/model-fixtures"

// ?demo=model-check: a ModelViewer whose weights a button changes, and a
// ModelScan run by the fake engine (?speed= scales its waits, ?fail ends it in an error), above a tall spacer to scroll them out of view, for
// tooling/model-check.mjs.
// Weights as the engine sends them: a Float32Array aligned with the GLB's target names.
const rest = new Float32Array(figureTargetNames.length)
const morphed = Float32Array.from(figureTargetNames, (name) => (name.endsWith(".decr") ? 0 : 1))

function ModelCheck() {
  const params = new URLSearchParams(location.search)
  const speed = Number(params.get("speed") ?? "1")
  const { props, start, cancel } = useFakeModelScan(engineModels, { speed, fail: params.has("fail") })
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
          src={portrait.src}
          alt="A front photo of a stylised figure"
          width={portrait.width}
          height={portrait.height}
          {...props}
          modelAlt="A 3D stylised figure"
          onCancel={props.stage === "photo" ? undefined : cancel}
          onRetry={start}
        />
        <Button size="sm" onClick={start}>
          Start scan
        </Button>
      </section>
      <div data-testid="spacer" className="h-750 w-px" />
    </main>
  )
}

export { ModelCheck }
