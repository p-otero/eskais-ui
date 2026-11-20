"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import type { ReactNode } from "react"
import { CircleAlertIcon, DownloadIcon, PlayIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import type { ModelScanLabels } from "@/components/ui/model-scan-labels"
import type { ModelScanStage } from "@/components/ui/model-scan-primitive"
import type { ModelViewerLabels } from "@/components/ui/model-viewer-labels"
import type { ModelViewerView } from "@/components/ui/model-viewer-math"
import type { ModelViewerControlsState, ModelViewerHandle } from "@/components/ui/model-viewer-primitive"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Toggle } from "@/components/ui/toggle"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** A look the finished model can take, offered over the photo and the model. */
type ModelScanStyle = { value: string; label: string }

/** `overlay`: floating bars over the stage, as a camera app keeps its controls on the picture. `below`: under it. */
type ModelScanControlsPlacement = "overlay" | "below"

type Press = (event: Event) => void

type ModelScanControlsProps = {
  stage: ModelScanStage
  /** The model has taken the photo's place at `ready`: the toolbar replaces the progress. */
  ready: boolean
  progress?: number
  statusText?: string
  error?: string
  labels: ModelScanLabels
  viewerLabels: ModelViewerLabels
  placement: ModelScanControlsPlacement
  styles?: readonly ModelScanStyle[]
  selectedStyle?: string
  onStyleChange?: (style: string, details: ChangeDetails) => void
  start?: Press
  cancel?: Press
  retry?: Press
  startOver?: Press
  download?: Press
  handle: ModelViewerHandle | null
  viewer: ModelViewerControlsState | null
  actions?: ReactNode
}

const steps: readonly ModelScanStage[] = ["detecting", "building", "refining", "ready"]
// The toolbar's views: the back of a character tells little, and three fit a phone's width with the other controls.
const toolbarViews: readonly ModelViewerView[] = ["front", "three-quarter", "side"]

// On a coarse pointer the gaps grow so neighbouring 44px hit areas don't overlap.
const floatingBar =
  "pointer-events-auto flex max-w-full items-center gap-inline surface-floating p-inline pointer-coarse:gap-items"
const inlineBar = "flex max-w-full flex-wrap items-center gap-items"

/** How far the stage is through the run, as a ring: full at `value` 1, a turning quarter while unknown. */
function ProgressRing({ value }: { value?: number }) {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- a progress ring drawn from the value, not an icon
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      data-indeterminate={value === undefined ? "" : undefined}
      className="size-5 shrink-0 -rotate-90 data-indeterminate:motion-safe:animate-spin"
    >
      <circle cx="10" cy="10" r="8.5" className="fill-none stroke-foreground/15 stroke-3" />
      <circle
        cx="10"
        cy="10"
        r="8.5"
        pathLength={1}
        strokeDasharray={value === undefined ? "0.25 0.75" : "1"}
        strokeDashoffset={value === undefined ? 0 : 1 - Math.min(1, Math.max(0, value))}
        strokeLinecap="round"
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- the ring fills by its dash offset
        className="fill-none stroke-info stroke-3 transition-[stroke-dashoffset] duration-panel ease-standard"
      />
    </svg>
  )
}

function StylePicker({
  styles,
  selectedStyle,
  onStyleChange,
  labels,
  placement,
}: Pick<ModelScanControlsProps, "styles" | "selectedStyle" | "onStyleChange" | "labels" | "placement">) {
  if (!styles || styles.length === 0 || !onStyleChange) return null
  return (
    <SegmentedControl
      aria-label={labels.styles}
      value={selectedStyle}
      onValueChange={(next, details) => {
        if (next) onStyleChange(next, details)
        else details.cancel()
      }}
      className={
        placement === "overlay"
          ? "pointer-events-auto max-w-full border-floating-border bg-floating shadow-floating backdrop-floating"
          : "max-w-full"
      }
    >
      <SegmentedControlIndicator />
      {styles.map((option) => (
        <SegmentedControlItem key={option.value} value={option.value} className="px-inset-item">
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

function WorkingBar({
  stage,
  progress,
  statusText,
  labels,
  cancel,
  actions,
  className,
}: Pick<ModelScanControlsProps, "stage" | "progress" | "statusText" | "labels" | "cancel" | "actions"> & {
  className: string
}) {
  const value = stage === "ready" ? 1 : progress
  const step = Math.max(0, steps.indexOf(stage)) + 1
  const label = statusText ?? labels.stage[stage as Exclude<ModelScanStage, "photo" | "error">]
  return (
    <div data-slot="model-scan-progress" className={cn(className, "w-full ps-(--item-padding-x)")}>
      <Progress
        value={value === undefined ? null : Math.round(value * 1000) / 10}
        className="min-w-0 flex-1 flex-nowrap items-center justify-start gap-items"
      >
        <ProgressRing value={value} />
        <span className="flex min-w-0 flex-col">
          <ProgressLabel className="truncate text-body-sm">{label}</ProgressLabel>
          <span className="text-caption text-muted-foreground">
            {labels.step(step, steps.length)}
            {value === undefined ? null : (
              <>
                {" · "}
                <ProgressValue className="text-caption" />
              </>
            )}
          </span>
        </span>
      </Progress>
      {cancel ? (
        <Button variant="ghost" size="sm" data-model-scan-primary="" onClick={(event) => cancel(event.nativeEvent)}>
          <XIcon />
          {labels.cancel}
        </Button>
      ) : null}
      {actions}
    </div>
  )
}

function ModelToolbar({
  labels,
  viewerLabels,
  handle,
  viewer,
  download,
  startOver,
  actions,
  className,
}: Pick<
  ModelScanControlsProps,
  "labels" | "viewerLabels" | "handle" | "viewer" | "download" | "startOver" | "actions"
> & { className: string }) {
  const loaded = viewer?.status === "ready"
  return (
    <Toolbar aria-label={labels.toolbar} data-model-scan-bar="" className={className}>
      <SegmentedControl<ModelViewerView>
        aria-label={viewerLabels.views}
        value={viewer?.view ?? null}
        disabled={!loaded}
        onValueChange={(next, details) => {
          if (next && handle) handle.api.setView(next, details.event)
          else details.cancel()
        }}
      >
        <SegmentedControlIndicator />
        {toolbarViews.map((name) => (
          <SegmentedControlItem key={name} value={name} className="px-inset-item pointer-coarse:min-w-11">
            {viewerLabels.view[name]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      {loaded && viewer.clips.length > 0 ? (
        <Toggle
          variant="outline"
          size="icon"
          aria-label={labels.play}
          pressed={viewer.playing}
          onPressedChange={(pressed, details) => {
            if (!handle) return
            if (pressed) handle.api.play(details.event)
            else handle.api.pause(details.event)
          }}
        >
          <PlayIcon />
        </Toggle>
      ) : null}
      {download || startOver ? <ToolbarSeparator className="mx-inline h-5 w-px shrink-0 bg-border" /> : null}
      {download ? (
        <ControlTooltip label={labels.download}>
          <ToolbarButton
            aria-label={labels.download}
            onClick={(event) => download(event.nativeEvent)}
            className={buttonVariants({ size: "icon" })}
          >
            <DownloadIcon />
          </ToolbarButton>
        </ControlTooltip>
      ) : null}
      {startOver ? (
        <ControlTooltip label={labels.startOver}>
          <ToolbarButton
            aria-label={labels.startOver}
            onClick={(event) => startOver(event.nativeEvent)}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <RotateCcwIcon />
          </ToolbarButton>
        </ControlTooltip>
      ) : null}
      {actions}
    </Toolbar>
  )
}

function ErrorCard({
  error,
  labels,
  retry,
  startOver,
  actions,
  placement,
}: Pick<ModelScanControlsProps, "error" | "labels" | "retry" | "startOver" | "actions" | "placement">) {
  return (
    <div
      data-slot="model-scan-error"
      className={
        placement === "overlay"
          ? "pointer-events-auto flex w-full max-w-xs flex-col gap-items surface-floating px-inset-item py-inset-item"
          : "flex flex-col gap-items rounded-surface border border-destructive-border bg-destructive-soft px-inset-item py-inset-item text-destructive-soft-foreground"
      }
    >
      <p className="flex items-start gap-inline text-body-sm">
        <CircleAlertIcon
          aria-hidden
          className={cn("mt-px size-4 shrink-0", placement === "overlay" && "text-destructive")}
        />
        <span className="min-w-0">{error ?? labels.error}</span>
      </p>
      {retry || startOver || actions ? (
        <div className="flex flex-wrap justify-end gap-items">
          {startOver ? (
            <Button variant="ghost" size="sm" onClick={(event) => startOver(event.nativeEvent)}>
              {labels.startOver}
            </Button>
          ) : null}
          {retry ? (
            <Button size="sm" data-model-scan-primary="" onClick={(event) => retry(event.nativeEvent)}>
              <RotateCcwIcon />
              {labels.retry}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}

/**
 * ModelScan's controls for each stage: the style picker and Make 3D over the photo, the progress and Cancel while
 * it works, the error with Try again, and over the finished model the style picker and a toolbar of views, the clip,
 * Download and Start over.
 */
function ModelScanControls(props: ModelScanControlsProps) {
  const { stage, ready, placement, start, labels, actions } = props
  const overlay = placement === "overlay"
  const bar = overlay ? floatingBar : inlineBar
  if (stage === "error") {
    if (!overlay) return <ErrorCard {...props} />
    return (
      <div className="flex size-full items-end justify-center rounded-surface bg-overlay/40 p-items">
        <ErrorCard {...props} />
      </div>
    )
  }
  let top: ReactNode = null
  let bottom: ReactNode = null
  if (stage === "photo") {
    top = <StylePicker {...props} />
    // The ring keeps the button's edge visible over a photo as dark or light as its fill.
    bottom =
      start || actions ? (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-items">
          {start ? (
            <Button
              size={overlay ? "lg" : "default"}
              data-model-scan-primary=""
              onClick={(event) => start(event.nativeEvent)}
              className={overlay ? "rounded-full shadow-floating ring-2 ring-floating-border" : undefined}
            >
              <SparklesIcon />
              {labels.start}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null
  } else if (stage !== "ready" || !ready) {
    bottom = <WorkingBar {...props} className={bar} />
  } else {
    top = <StylePicker {...props} />
    bottom = <ModelToolbar {...props} className={bar} />
  }
  if (!overlay) {
    if (!top && !bottom) return null
    return (
      <div className="flex flex-col items-start gap-items">
        {top}
        {bottom}
      </div>
    )
  }
  return (
    <div className="flex size-full flex-col items-center justify-between p-items">
      <div className="flex max-w-full justify-center">{top}</div>
      <div className="flex w-full justify-center">{bottom}</div>
    </div>
  )
}

export { ModelScanControls }
export type { ModelScanControlsPlacement, ModelScanControlsProps, ModelScanStyle }
