import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ModelScan } from "@/components/ui/model-scan"
import { ModelViewer } from "@/components/ui/model-viewer"

import {
  character,
  characterStyles,
  engineModels,
  photo,
  portrait,
  restyle,
  useFakeModelScan,
  useScanReplay,
  type EngineErrorCode,
} from "../sections/model-fixtures"
import { useModelProbe } from "./use-model-probe"

// ?demo=model-check, for tooling/model-check.mjs: the demo character, and a scan replaying its recording. ?slowdown=,
// ?fit=cover&stage=<ratio>, ?mask=off (the landmarks' hull), ?controls=below, ?photo=light|dark (the extremes the
// controls read over), ?scan-only (no viewer, for frame times); ?fail[=<code>] runs a fake engine that fails, since the
// recording has no error. A tall spacer scrolls both out of view.
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
  const replay = useScanReplay({ slowdown, mask: params.get("mask") !== "off" })
  const placement = params.get("controls") === "below" ? "below" : "overlay"
  const photoTone = params.get("photo")
  const scanOnly = params.has("scan-only")
  const fake = useFakeModelScan(engineModels, {
    speed: 4,
    fail: failCode ? (failCode as EngineErrorCode) : failing,
  })
  const scan = failing ? fake : replay
  const shot = failing ? portrait : photo
  const [expressions, setExpressions] = useState<Record<string, number>>(rest)
  const [style, setStyle] = useState<keyof typeof character>("soft")
  const [scanStyle, setScanStyle] = useState<keyof typeof character>("soft")
  const [downloads, setDownloads] = useState(0)
  return (
    <main className="flex flex-col items-start gap-section p-group">
      <section
        data-testid="viewer"
        aria-label="Viewer"
        hidden={scanOnly}
        className="flex w-full max-w-md flex-col gap-items"
      >
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
      <section
        data-testid="scan"
        aria-label="Scan"
        data-photo={photoTone ?? undefined}
        data-downloads={downloads}
        // What the run has sent so far, for model-check's dump when a scan stalls.
        data-replay={JSON.stringify({
          stage: scan.props.stage,
          running: scan.running,
          points: (scan.props.points ?? []).length,
          model: scan.props.model !== undefined,
          progress: scan.props.progress,
          masks: "masks" in scan.props ? (scan.props.masks?.length ?? 0) : null,
        })}
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- the brightest and darkest photo the controls must read over
        className="flex w-full max-w-sm flex-col gap-items data-[photo=dark]:[&_[data-slot=model-scan-photo]_img]:brightness-[.22] data-[photo=light]:[&_[data-slot=model-scan-photo]_img]:brightness-[1.8] data-[photo=light]:[&_[data-slot=model-scan-photo]_img]:saturate-[.3]"
      >
        <ModelScan
          src={shot.src}
          alt="A full-length photo of a person"
          width={shot.width}
          height={shot.height}
          {...scan.props}
          model={!failing && scan.props.stage === "ready" ? { glb: character[scanStyle] } : scan.props.model}
          modelAlt="A 3D character"
          idleClip="wave"
          fit={fit}
          aspectRatio={stageRatio}
          controls={placement}
          viewer={{ onModelLoad: failing ? undefined : restyle }}
          labels={{ play: "Wave" }}
          styles={characterStyles}
          selectedStyle={scanStyle}
          onStyleChange={(next) => setScanStyle(next as keyof typeof character)}
          onStart={scan.start}
          onCancel={scan.running ? scan.cancel : undefined}
          onRetry={failing && fake.canRetry ? fake.start : undefined}
          onStartOver={scan.cancel}
          onDownload={() => setDownloads((count) => count + 1)}
        />
      </section>
      <div data-testid="spacer" className="h-750 w-px" />
    </main>
  )
}

export { ModelCheck }
