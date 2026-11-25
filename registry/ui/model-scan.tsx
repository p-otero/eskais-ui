"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { lazy, useMemo, useState, type ReactNode } from "react"

import {
  ModelScanControls,
  type ModelScanControlsPlacement,
  type ModelScanStyle,
} from "@/components/ui/model-scan-controls"
import { modelScanLabels, type ModelScanLabels } from "@/components/ui/model-scan-labels"
import { ModelScanLandmarks } from "@/components/ui/model-scan-landmarks"
import { maskImages, personMask, type ModelScanMask } from "@/components/ui/model-scan-mask"
import {
  pointGroups,
  pointsAspect,
  type ModelScanEdges,
  type ModelScanPoint,
  type ModelScanPointGroup,
  type ModelScanPointList,
  type ModelScanPoints,
} from "@/components/ui/model-scan-points"
import {
  modelScan,
  type ModelScanActionReason,
  type ModelScanAnnouncements,
  type ModelScanStage,
} from "@/components/ui/model-scan-primitive"
import {
  ModelViewer,
  useModelViewerControls,
  type ModelViewerExpressions,
  type ModelViewerHandle,
  type ModelViewerProps,
  type ModelViewerSource,
  type ModelViewerWeights,
} from "@/components/ui/model-viewer"
import { modelViewerLabels } from "@/components/ui/model-viewer-labels"
import { useModelScanFocus } from "@/components/ui/use-model-scan-focus"
import { cn, cnState, cssVars } from "@/lib/utils"

const {
  Photo: ModelScanPhoto,
  Effect: ModelScanEffect,
  Points: ModelScanPointLayer,
} = createParts(modelScan, { photo: "div", effect: "div", points: "div" })

// Perf: only ModelScan loads the photo transition, inside the viewer's canvas after its own scene.
const ModelScanIntro = lazy(() =>
  import("@/components/ui/model-scan-intro").then((module) => ({ default: module.ModelScanIntro })),
)

type ModelScanEventDetails = ChangeDetails<ModelScanActionReason>

/**
 * A model as an engine sends it: the GLB (bytes or a URL) and its target names. A new one (a refined character) fades
 * in over the last, or replaces it at once when it looks the same, keeping its weights.
 */
type ModelScanModel = { glb: ArrayBuffer | string; targetNames?: readonly string[] }

const isScanModel = (model: ModelViewerSource | ModelScanModel): model is ModelScanModel =>
  typeof model === "object" && "glb" in model

type ModelScanViewerProps = Omit<
  ModelViewerProps,
  | "model"
  | "alt"
  | "weights"
  | "scaledWeights"
  | "targetNames"
  | "expressions"
  | "poster"
  | "controls"
  | "handleRef"
  | "load"
  | "overlay"
  | "sceneChildren"
  | "aspectRatio"
>

type ModelScanProps = Omit<PartProps<"div">, "children"> & {
  src: string
  /** Describes the photo, and names the scan. */
  alt: string
  /**
   * The photo's size in pixels: its ratio sizes the stage until the photo loads, which then gives its own. Without
   * it, the points' `aspect` does, or 3:4.
   */
  width?: number
  height?: number
  stage: ModelScanStage
  /**
   * Points the engine found, as fractions of the original photo, lighting up while detecting: one list (interleaved
   * x, y in a `Float32Array`, or `{ x, y }` objects), or groups of them, `{ source, points, aspect?, edges? }`, each
   * lighting up on its own, in the order the sources arrived, with lines along its `edges`. Points past the photo's
   * edges (landmarks a crop cut off) are kept but not drawn.
   */
  points?: ModelScanPoints
  /**
   * The engine's person masks (`{ source?, width, height, data }`, 0–255 confidence per pixel, the photo's aspect):
   * the background dims around the person while detecting, and only the person's pixels fly onto the model. Without
   * one, a hull around the body's 33 pose landmarks stands in.
   */
  masks?: readonly ModelScanMask[]
  /** The base model (a GLB with morph targets), from the building stage on. */
  model?: ModelViewerSource | ModelScanModel
  /** Morph target weights from the engine, eased as they stream in: aligned with the target names, or by name. */
  weights?: ModelViewerWeights
  /** `weights` come already multiplied by the GLB's `extras.targetScales`, as the engine may send them. */
  scaledWeights?: boolean
  /** The order aligned `weights` follow, when `model` doesn't carry it; the GLB's `extras.targetNames` by default. */
  targetNames?: readonly string[]
  /** Expression weights by ARKit name, like a smile at the end. */
  expressions?: ModelViewerExpressions
  /** From 0 to 1 within the stage; leave it out while the engine can't tell. */
  progress?: number
  /** What the engine is doing now, as the progress label; the stage's label by default. */
  statusText?: string
  /** What went wrong, shown and read at once in the error stage. */
  error?: string
  /** Shows the start button over the photo; agents call `start`. */
  onStart?: (details: ModelScanEventDetails) => void
  /** Shows Cancel while the scan runs; agents call `cancel`. */
  onCancel?: (details: ModelScanEventDetails) => void
  /** Shows Try again after an error; agents call `retry`. */
  onRetry?: (details: ModelScanEventDetails) => void
  /** Shows Start over on the finished model and after an error; agents call `restart`. */
  onStartOver?: (details: ModelScanEventDetails) => void
  /** Shows Download on the finished model; agents call `download`. */
  onDownload?: (details: ModelScanEventDetails) => void
  /** Looks the finished model can take, picked over the photo and the model. */
  styles?: readonly ModelScanStyle[]
  /** The chosen one of `styles` (`style` stays React's inline style on the root). */
  selectedStyle?: string
  onStyleChange?: (style: string, details: ChangeDetails) => void
  /** Where the controls go: floating over the stage (`overlay`, the default) or under it (`below`). */
  controls?: ModelScanControlsPlacement
  /** Describes the model once it shows; `labels.model` by default. */
  modelAlt?: string
  /** The clip to play when ready, like a wave; the model's first clip by default. */
  idleClip?: string
  /** The stage's width over its height; the photo's by default. */
  aspectRatio?: number
  /** How the photo fills a stage of another `aspectRatio`: whole (`contain`) or cropped (`cover`). Points follow it. */
  fit?: "contain" | "cover"
  /** More ModelViewer props for the model: framing, material, floor, summary, labels… */
  viewer?: ModelScanViewerProps
  /** More controls, beside the stage's own in each one. */
  actions?: ReactNode
  labels?: Partial<ModelScanLabels>
}

/* oxlint-disable shadcn/no-arbitrary-values -- the photo's drawn box and the scan effect follow the ratio, progress and container variables */
const layerClassName =
  "pointer-events-none absolute top-1/2 left-1/2 h-[min(100cqh,calc(100cqw/var(--model-scan-ratio)))] w-[min(100cqw,calc(100cqh*var(--model-scan-ratio)))] -translate-x-1/2 -translate-y-1/2 data-[fit=cover]:h-[max(100cqh,calc(100cqw/var(--model-scan-ratio)))] data-[fit=cover]:w-[max(100cqw,calc(100cqh*var(--model-scan-ratio)))]"
// Workaround: Tailwind's @container is inline-size only; the photo's box sizes from a size container.
const photoClassName =
  "pointer-events-none absolute inset-0 overflow-hidden [container-type:size] [--model-scan-accent:var(--info)] data-handed-off:invisible"
const imageClassName =
  "absolute inset-0 size-full transition-[filter] duration-dialog ease-standard in-data-[stage=detecting]:brightness-[.92] in-data-[stage=detecting]:saturate-[.55]"
const effectClassNames = {
  root: "group/effect absolute inset-0 overflow-hidden",
  grid: "absolute inset-0 [background-image:radial-gradient(color-mix(in_oklab,var(--model-scan-accent)_55%,transparent)_1px,transparent_1.25px)] [background-size:12px_12px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)] opacity-50 transition-opacity duration-dialog ease-standard starting:opacity-0",
  beam: "absolute inset-x-0 top-0 h-[34%] -translate-y-full border-b-2 border-(--model-scan-accent) bg-linear-to-b from-transparent to-(--model-scan-accent)/25 shadow-[0_8px_22px_-4px_color-mix(in_oklab,var(--model-scan-accent)_75%,transparent)] transition-transform duration-panel ease-standard group-data-determinate/effect:translate-y-[calc(var(--model-scan-progress,0)*294%-100%)]",
  bracket:
    "absolute size-6 border-(--model-scan-accent) drop-shadow-[0_0_4px_color-mix(in_oklab,var(--model-scan-accent)_60%,transparent)] transition-[scale,opacity] duration-dialog ease-standard starting:scale-150 starting:opacity-0",
}
const maskClassNames = {
  dim: "absolute inset-0 bg-overlay/45 [mask-size:100%_100%] transition-opacity duration-dialog ease-standard starting:opacity-0",
  person:
    "absolute inset-0 bg-(--model-scan-accent)/20 mix-blend-screen [mask-size:100%_100%] transition-opacity duration-dialog ease-standard starting:opacity-0",
}
const overlayClassName = "pointer-events-none absolute inset-x-0 top-0 aspect-(--model-scan-stage)"
/* oxlint-enable shadcn/no-arbitrary-values */

const threeD: readonly ModelScanStage[] = ["building", "refining", "ready"]
const working: readonly ModelScanStage[] = ["detecting", "building", "refining"]

/**
 * A photo turning into a 3D character, from an engine's events: points light up over the photo (`detecting`), the
 * person's pixels fly onto the base model as the camera turns (`building`), weights reshape it (`refining`), and it
 * turns freely (`ready`). Reduced motion crossfades instead; every stage is announced, errors at once.
 */
function ModelScan({
  src,
  alt,
  width,
  height,
  stage,
  points,
  masks,
  model,
  weights,
  scaledWeights,
  targetNames,
  expressions,
  progress,
  statusText,
  error,
  onStart,
  onCancel,
  onRetry,
  onStartOver,
  onDownload,
  styles,
  selectedStyle,
  onStyleChange,
  controls = "overlay",
  modelAlt,
  idleClip,
  aspectRatio,
  fit = "contain",
  viewer: viewerProps,
  actions,
  labels: ownLabels,
  className,
  ...props
}: ModelScanProps) {
  const labels = { ...modelScanLabels, ...ownLabels, stage: { ...modelScanLabels.stage, ...ownLabels?.stage } }
  const viewerLabels = {
    ...modelViewerLabels,
    ...viewerProps?.labels,
    view: { ...modelViewerLabels.view, ...viewerProps?.labels?.view },
  }
  const [measured, setMeasured] = useState<{ src: string; ratio: number } | null>(null)
  const measure = (img: HTMLImageElement | null) => {
    if (!img?.complete || !img.naturalWidth || !img.naturalHeight) return
    const next = img.naturalWidth / img.naturalHeight
    if (measured?.src !== src || measured.ratio !== next) setMeasured({ src, ratio: next })
  }
  const ratio =
    (measured?.src === src ? measured.ratio : undefined) ??
    (width && height ? width / height : undefined) ??
    pointsAspect(points) ??
    3 / 4
  const stageRatio = Math.min(4, Math.max(0.25, aspectRatio ?? ratio))
  const groups = useMemo(() => pointGroups(points), [points])
  const person = useMemo(() => personMask({ masks, groups, ratio }), [masks, groups, ratio])
  const images = useMemo(() => maskImages(person.mask), [person.mask])
  const controlsRow = useModelScanFocus(stage)
  const glb = model && isScanModel(model) ? model.glb : model
  const modelNames = model && isScanModel(model) ? model.targetNames : undefined
  const announcements: ModelScanAnnouncements = {
    stage: (next) =>
      next === "photo" || next === "error" ? undefined : next === stage && statusText ? statusText : labels.stage[next],
    progress: labels.progress,
    error: error ?? labels.error,
  }
  const [playing, setPlaying] = useState<boolean | null>(null)
  const [handedOff, setHandedOff] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [handle, setHandle] = useState<ModelViewerHandle | null>(null)
  const viewerState = useModelViewerControls(handle)
  if ((stage === "photo" || stage === "detecting") && (handedOff || introDone)) {
    setHandedOff(false)
    setIntroDone(false)
  }
  const scan = usePrimitive(modelScan, {
    stage,
    progress,
    onStart: onStart && ((_value, details) => onStart(details)),
    onCancel: onCancel && ((_value, details) => onCancel(details)),
    onRetry: onRetry && ((_value, details) => onRetry(details)),
    onStartOver: onStartOver && ((_value, details) => onStartOver(details)),
    onDownload: onDownload && ((_value, details) => onDownload(details)),
    ratio,
    introDone,
    announcements,
  })
  const intro = threeD.includes(stage) || (stage === "error" && handedOff)
  const shownModel = handedOff && stage !== "photo" && stage !== "detecting"

  const overlay = (
    <ModelScanPhoto handedOff={handedOff} className={photoClassName}>
      <img
        ref={measure}
        src={src}
        alt=""
        width={width}
        height={height}
        draggable={false}
        onLoad={(event) => measure(event.currentTarget)}
        className={cn(imageClassName, fit === "cover" ? "object-cover" : "object-contain")}
      />
      <div data-fit={fit} className={layerClassName}>
        <ModelScanEffect className={effectClassNames.root}>
          <span className={effectClassNames.grid} />
          <span data-beam="" className={effectClassNames.beam} />
          <span className={cn(effectClassNames.bracket, "top-group left-group rounded-tl-sm border-t-2 border-l-2")} />
          <span className={cn(effectClassNames.bracket, "top-group right-group rounded-tr-sm border-t-2 border-r-2")} />
          <span
            className={cn(effectClassNames.bracket, "right-group bottom-group rounded-br-sm border-r-2 border-b-2")}
          />
          <span
            className={cn(effectClassNames.bracket, "bottom-group left-group rounded-bl-sm border-b-2 border-l-2")}
          />
        </ModelScanEffect>
        <ModelScanPointLayer handedOff={handedOff} data-person={person.from} className="absolute inset-0">
          {images ? (
            <>
              <span className={maskClassNames.dim} style={{ maskImage: images.background }} />
              <span className={maskClassNames.person} style={{ maskImage: images.person }} />
            </>
          ) : null}
          <ModelScanLandmarks groups={groups} ratio={ratio} />
        </ModelScanPointLayer>
      </div>
    </ModelScanPhoto>
  )

  const ready = stage === "ready" && introDone
  const stageControls = (
    <ModelScanControls
      stage={stage}
      ready={ready}
      progress={progress}
      statusText={statusText}
      error={error}
      labels={labels}
      viewerLabels={viewerLabels}
      placement={controls}
      styles={styles}
      selectedStyle={selectedStyle}
      onStyleChange={onStyleChange}
      start={onStart && stage === "photo" ? (event) => scan.api.start(event) : undefined}
      cancel={onCancel && working.includes(stage) ? (event) => scan.api.cancel(event) : undefined}
      retry={onRetry && stage === "error" ? (event) => scan.api.retry(event) : undefined}
      startOver={
        onStartOver && (stage === "error" || stage === "ready") ? (event) => scan.api.restart(event) : undefined
      }
      download={onDownload && stage === "ready" ? (event) => scan.api.download(event) : undefined}
      handle={handle}
      viewer={viewerState}
      actions={actions}
    />
  )

  const content = (
    <>
      <div className="relative" style={cssVars({ "--model-scan-stage": String(stageRatio) })}>
        <ModelViewer
          floor
          {...viewerProps}
          model={glb}
          targetNames={targetNames ?? modelNames}
          expressions={expressions}
          aria-label={modelAlt ?? labels.model}
          alt={shownModel ? (modelAlt ?? labels.model) : alt}
          poster={src}
          aspectRatio={stageRatio}
          weights={weights}
          scaledWeights={scaledWeights}
          load={stage !== "photo"}
          controls={stage === "ready" ? "gestures" : false}
          handleRef={setHandle}
          playing={ready ? playing : false}
          onPlayingChange={(next, details) => {
            viewerProps?.onPlayingChange?.(next, details)
            if (!details.canceled) setPlaying(next)
          }}
          defaultClip={idleClip ?? viewerProps?.defaultClip}
          overlay={overlay}
          sceneChildren={
            intro ? (
              <ModelScanIntro
                src={src}
                ratio={ratio}
                fit={fit}
                mask={person.mask}
                person={person.from}
                onHandOff={() => setHandedOff(true)}
                onDone={() => setIntroDone(true)}
              />
            ) : null
          }
        />
        {controls === "overlay" ? (
          <div ref={controlsRow} data-slot="model-scan-controls" className={overlayClassName}>
            {stageControls}
          </div>
        ) : null}
      </div>
      {controls === "below" ? (
        <div ref={controlsRow} data-slot="model-scan-controls">
          {stageControls}
        </div>
      ) : null}
    </>
  )

  return usePart(
    scan,
    "root",
    {},
    {
      "aria-label": alt,
      ...props,
      className: cnState("flex w-full min-w-0 flex-col gap-items", className),
      children: content,
    },
    "div",
  )
}

export { ModelScan, modelScanLabels }
export type {
  ModelScanControlsPlacement,
  ModelScanEdges,
  ModelScanEventDetails,
  ModelScanLabels,
  ModelScanMask,
  ModelScanModel,
  ModelScanPoint,
  ModelScanPointGroup,
  ModelScanPointList,
  ModelScanPoints,
  ModelScanProps,
  ModelScanStage,
  ModelScanStyle,
}
