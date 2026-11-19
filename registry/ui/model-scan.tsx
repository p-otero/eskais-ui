"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { lazy, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { CircleAlertIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { modelScanLabels, type ModelScanLabels } from "@/components/ui/model-scan-labels"
import {
  modelScan,
  type ModelScanActionReason,
  type ModelScanAnnouncements,
  type ModelScanStage,
} from "@/components/ui/model-scan-primitive"
import {
  isOnPhoto,
  pointGroups,
  pointsAspect,
  type ModelScanDrawnGroup,
  type ModelScanPoint,
  type ModelScanPointGroup,
  type ModelScanPointList,
  type ModelScanPoints,
} from "@/components/ui/model-scan-points"
import {
  ModelViewer,
  type ModelViewerExpressions,
  type ModelViewerProps,
  type ModelViewerSource,
  type ModelViewerWeights,
} from "@/components/ui/model-viewer"
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"
import { useModelScanFocus } from "@/components/ui/use-model-scan-focus"
import { cn, cnState } from "@/lib/utils"

const {
  Photo: ModelScanPhoto,
  Effect: ModelScanEffect,
  Points: ModelScanPointLayer,
} = createParts(modelScan, { photo: "div", effect: "div", points: "div" })

// Loaded inside the viewer's canvas, after the viewer's own scene: only ModelScan pays for the photo transition.
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
  | "targetNames"
  | "expressions"
  | "poster"
  | "controls"
  | "load"
  | "overlay"
  | "sceneChildren"
  | "aspectRatio"
>

type ModelScanProps = Omit<PartProps<"div">, "children"> & {
  /** The photo. */
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
   * x, y in a `Float32Array`, or `{ x, y }` objects), or groups of them, `{ source, points, aspect? }`, each lighting
   * up on its own, in the order the sources arrived. Points past the photo's edges (landmarks a crop cut off) are
   * kept but not drawn.
   */
  points?: ModelScanPoints
  /** The base model (a GLB with morph targets), from the building stage on. */
  model?: ModelViewerSource | ModelScanModel
  /** Morph target weights from the engine, eased as they stream in: aligned with the target names, or by name. */
  weights?: ModelViewerWeights
  /** The order aligned `weights` follow, when `model` doesn't carry it; the GLB's `extras.targetNames` by default. */
  targetNames?: readonly string[]
  /** Expression weights by ARKit name, like a smile at the end. */
  expressions?: ModelViewerExpressions
  /** From 0 to 1 within the stage; leave it out while the engine can't tell. */
  progress?: number
  /** What the engine is doing now, as the progress bar's label; the stage's label by default. */
  statusText?: string
  /** What went wrong, shown and read at once in the error stage. */
  error?: string
  /** Shows Cancel before the model is ready; agents call `cancel`. */
  onCancel?: (details: ModelScanEventDetails) => void
  /** Shows Retry after an error; agents call `retry`. */
  onRetry?: (details: ModelScanEventDetails) => void
  /** Describes the model once it shows; `labels.model` by default. */
  modelAlt?: string
  /** The clip to play when ready, like a wave; the model's first clip by default. */
  idleClip?: string
  /** The stage's width over its height; the photo's by default. */
  aspectRatio?: number
  /** How the photo fills a stage of another `aspectRatio`: whole (`contain`) or cropped (`cover`). Points follow it. */
  fit?: "contain" | "cover"
  /** More ModelViewer props for the model: framing, material, summary, labels… */
  viewer?: ModelScanViewerProps
  /** More controls beside Cancel and Retry. */
  actions?: ReactNode
  labels?: Partial<ModelScanLabels>
}

/* oxlint-disable shadcn/no-arbitrary-values -- the photo's drawn box and the scan effect follow the ratio, progress and container variables */
// The photo's drawn box inside the stage, as ImageScan places its regions: a stage of another ratio letterboxes it
// (contain) or crops it (cover), and points land on the pixels they name either way.
const layerClassName =
  "pointer-events-none absolute top-1/2 left-1/2 h-[min(100cqh,calc(100cqw/var(--model-scan-ratio)))] w-[min(100cqw,calc(100cqh*var(--model-scan-ratio)))] -translate-x-1/2 -translate-y-1/2 data-[fit=cover]:h-[max(100cqh,calc(100cqw/var(--model-scan-ratio)))] data-[fit=cover]:w-[max(100cqw,calc(100cqh*var(--model-scan-ratio)))]"
// A size container (Tailwind's @container is inline-size only), so the photo's box sizes from it.
const photoClassName =
  "pointer-events-none absolute inset-0 overflow-hidden [container-type:size] data-handed-off:invisible"
const effectClassNames = {
  root: "group/effect absolute inset-0 overflow-hidden [--model-scan-accent:var(--info)]",
  veil: "absolute inset-0 origin-bottom bg-overlay opacity-40 transition-transform duration-panel ease-standard group-data-determinate/effect:scale-y-[calc(1-var(--model-scan-progress,0))]",
  line: "absolute inset-x-0 bottom-full hidden h-full translate-y-[calc(var(--model-scan-progress,0)*100%)] border-b-2 border-(--model-scan-accent) bg-linear-to-b from-transparent to-(--model-scan-accent)/25 transition-transform duration-panel ease-standard group-data-determinate/effect:block",
  bracket:
    "absolute size-6 border-(--model-scan-accent) drop-shadow-[0_0_1px_var(--background)] motion-safe:animate-pulse",
}
// Each point grows in after the one before it in its group, at most 0.4 s behind the first, so a group (the face,
// the body) lights up on its own when it arrives. Groups take the info, violet and success colours in turn.
const pointClassName =
  "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--model-scan-point) shadow-[0_0_0_1.5px_var(--background),0_0_6px_var(--model-scan-point)] transition-[scale,opacity] delay-[min(calc(var(--model-scan-point-index)*4ms),400ms)] duration-micro ease-standard starting:scale-0 starting:opacity-0"
const groupClassName =
  "absolute inset-0 [--model-scan-point:var(--info)] data-[order=1]:[--model-scan-point:var(--violet)] data-[order=2]:[--model-scan-point:var(--success)]"
/* oxlint-enable shadcn/no-arbitrary-values */

const working: readonly ModelScanStage[] = ["detecting", "building", "refining"]
const threeD: readonly ModelScanStage[] = ["building", "refining", "ready"]

/**
 * A photo turning into a 3D character, driven by an engine's events through props: points light up over the photo
 * (`detecting`), the photo burns into particles while the camera turns and the base model appears where it stood
 * (`building`), streamed weights reshape it (`refining`), and it plays its idle clip and turns freely (`ready`).
 * Reduced motion crossfades the photo into the model instead. Every stage is announced, errors at once.
 */
function ModelScan({
  src,
  alt,
  width,
  height,
  stage,
  points,
  model,
  weights,
  targetNames,
  expressions,
  progress,
  statusText,
  error,
  onCancel,
  onRetry,
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
  // The loaded photo's own ratio; until then the given size's, or the engine's `aspect`.
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
  const groups = useMemo(() => pointGroups(points), [points])
  const statusRow = useModelScanFocus(stage)
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
  // A new run (back to the photo, or detecting again) starts over in 2D.
  if ((stage === "photo" || stage === "detecting") && (handedOff || introDone)) {
    setHandedOff(false)
    setIntroDone(false)
  }
  const scan = usePrimitive(modelScan, {
    stage,
    progress,
    onCancel: onCancel && ((_value, details) => onCancel(details)),
    onRetry: onRetry && ((_value, details) => onRetry(details)),
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
        className={cn("absolute inset-0 size-full", fit === "cover" ? "object-cover" : "object-contain")}
      />
      <div data-fit={fit} className={layerClassName}>
        <ModelScanEffect className={effectClassNames.root}>
          <span className={effectClassNames.veil} />
          <span className={effectClassNames.line} />
          <span className={cn(effectClassNames.bracket, "top-group left-group rounded-tl-sm border-t-2 border-l-2")} />
          <span className={cn(effectClassNames.bracket, "top-group right-group rounded-tr-sm border-t-2 border-r-2")} />
          <span
            className={cn(effectClassNames.bracket, "right-group bottom-group rounded-br-sm border-r-2 border-b-2")}
          />
          <span
            className={cn(effectClassNames.bracket, "bottom-group left-group rounded-bl-sm border-b-2 border-l-2")}
          />
        </ModelScanEffect>
        <ModelScanPointLayer handedOff={handedOff} className="absolute inset-0">
          {groups.map((group, order) => (
            <ModelScanPointGroupLayer key={group.source} group={group} order={order} />
          ))}
        </ModelScanPointLayer>
      </div>
    </ModelScanPhoto>
  )

  const content = (
    <>
      <ModelViewer
        {...viewerProps}
        model={glb}
        targetNames={targetNames ?? modelNames}
        expressions={expressions}
        aria-label={modelAlt ?? labels.model}
        alt={shownModel ? (modelAlt ?? labels.model) : alt}
        poster={src}
        aspectRatio={aspectRatio ?? ratio}
        weights={weights}
        load={stage !== "photo"}
        controls={stage === "ready"}
        playing={stage === "ready" && introDone ? playing : false}
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
              onHandOff={() => setHandedOff(true)}
              onDone={() => setIntroDone(true)}
            />
          ) : null
        }
      />
      <div ref={statusRow} data-slot="model-scan-status" className="contents">
        <ModelScanStatus
          stage={stage}
          progress={progress}
          statusText={statusText}
          error={error}
          labels={labels}
          actions={actions}
          cancel={onCancel && stage !== "ready" && stage !== "error" ? (event) => scan.api.cancel(event) : undefined}
          retry={onRetry && stage === "error" ? (event) => scan.api.retry(event) : undefined}
        />
      </div>
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

/**
 * One group's points, drawn as dots at their fractions of the photo; decorative, inside the hidden points layer.
 * Points past the photo's edges aren't drawn: clamped, they would pile up on the border where no landmark is. They
 * don't count in the stagger either, so a group lights up over the same time however many a crop cut off.
 */
function ModelScanPointGroupLayer({ group, order }: { group: ModelScanDrawnGroup; order: number }) {
  const dots: ReactNode[] = []
  for (let i = 0; i + 1 < group.coords.length; i += 2) {
    const x = group.coords[i] ?? -1
    const y = group.coords[i + 1] ?? -1
    if (!isOnPhoto(x, y)) continue
    // Points of a group only arrive, never move or reorder: their place in the list is their identity.
    dots.push(
      <span
        key={i / 2}
        className={pointClassName}
        style={
          {
            left: `${String((x * 100).toFixed(2))}%`,
            top: `${String((y * 100).toFixed(2))}%`,
            "--model-scan-point-index": String(dots.length),
          } as CSSProperties
        }
      />,
    )
  }
  return (
    <span data-source={group.source} data-order={order % 3} data-count={group.onPhoto} className={groupClassName}>
      {dots}
    </span>
  )
}

type ModelScanStatusProps = {
  stage: ModelScanStage
  progress?: number
  statusText?: string
  error?: string
  labels: ModelScanLabels
  actions?: ReactNode
  cancel?: (event: Event) => void
  retry?: (event: Event) => void
}

/** Under the stage: the progress and Cancel while working, the error and Retry after a failure. */
function ModelScanStatus({ stage, progress, statusText, error, labels, actions, cancel, retry }: ModelScanStatusProps) {
  if (stage === "error") {
    return (
      <div className="flex flex-wrap items-center gap-items">
        <p className="flex min-w-0 flex-1 basis-48 items-center gap-inline text-body-sm text-destructive-soft-foreground">
          <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0">{error ?? labels.error}</span>
        </p>
        {retry ? (
          <Button variant="outline" size="sm" onClick={(event) => retry(event.nativeEvent)}>
            <RotateCcwIcon />
            {labels.retry}
          </Button>
        ) : null}
        {actions}
      </div>
    )
  }
  if (!working.includes(stage)) {
    if (!cancel && !actions) return null
    return (
      <div className="flex flex-wrap items-center justify-end gap-items">
        {cancel ? (
          <Button variant="outline" size="sm" onClick={(event) => cancel(event.nativeEvent)}>
            <XIcon />
            {labels.cancel}
          </Button>
        ) : null}
        {actions}
      </div>
    )
  }
  const label = statusText ?? labels.stage[stage as Exclude<ModelScanStage, "photo" | "error">]
  return (
    <div className="flex items-end gap-items">
      <Progress value={progress === undefined ? null : Math.round(progress * 1000) / 10} className="min-w-0 flex-1">
        <ProgressLabel className="min-w-0 truncate">{label}</ProgressLabel>
        <ProgressValue />
        <ProgressTrack />
      </Progress>
      {cancel ? (
        <Button variant="outline" size="sm" onClick={(event) => cancel(event.nativeEvent)}>
          <XIcon />
          {labels.cancel}
        </Button>
      ) : null}
      {actions}
    </div>
  )
}

export { ModelScan, modelScanLabels }
export type {
  ModelScanEventDetails,
  ModelScanLabels,
  ModelScanModel,
  ModelScanPoint,
  ModelScanPointGroup,
  ModelScanPointList,
  ModelScanPoints,
  ModelScanProps,
  ModelScanStage,
}
