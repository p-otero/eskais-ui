import { Profiler, useState } from "react"

import { Button } from "@/components/ui/button"
import { ModelScan } from "@/components/ui/model-scan"
import { ModelViewer } from "@/components/ui/model-viewer"

import { figureUrl, portrait, useFakeModelScan } from "../sections/model-fixtures"

declare global {
  var modelViewerCommits: number | undefined
}

const countCommit = () => {
  globalThis.modelViewerCommits = (globalThis.modelViewerCommits ?? 0) + 1
}

// ?demo=model-check: a ModelViewer whose weights a button changes, inside a Profiler that counts its commits, and a
// ModelScan run by the fake engine (?speed= scales its waits), above a tall spacer to scroll them out of view, for
// tooling/model-check.mjs.
function ModelCheck() {
  const speed = Number(new URLSearchParams(location.search).get("speed") ?? "1")
  const { state, start, cancel } = useFakeModelScan(figureUrl, { speed })
  const [weights, setWeights] = useState<Record<string, number>>({})
  return (
    <main className="flex flex-col items-start gap-section p-group">
      <section data-testid="viewer" aria-label="Viewer" className="flex w-full max-w-md flex-col gap-items">
        <Profiler id="model-viewer" onRender={countCommit}>
          <ModelViewer
            model={figureUrl}
            alt="A stylised figure"
            poster={portrait.src}
            aspectRatio={3 / 4}
            weights={weights}
            summary="A standing figure in a teal shirt."
          />
        </Profiler>
        <div className="flex flex-wrap gap-items">
          <Button size="sm" onClick={() => setWeights({ Build: 1, HeadSize: 1, Smile: 1 })}>
            Morph
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeights({})}>
            Unmorph
          </Button>
        </div>
      </section>
      <section data-testid="scan" aria-label="Scan" className="flex w-full max-w-sm flex-col gap-items">
        <ModelScan
          src={portrait.src}
          alt="A front photo of a stylised figure"
          width={portrait.width}
          height={portrait.height}
          {...state}
          modelAlt="A 3D stylised figure"
          onCancel={state.stage === "photo" ? undefined : cancel}
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
