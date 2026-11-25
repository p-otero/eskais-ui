"use client"

import type { ReactNode } from "react"
import { CheckIcon, CircleAlertIcon, RotateCcwIcon, ScanSearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ImageScanStatus } from "@/components/ui/image-scan-primitive"
import { Progress, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type ImageScanStep = { id: string; label: string }

type ImageScanLabels = {
  regions: string
  steps: string
  scan: string
  scanning: string
  cancel: string
  retry: string
  error: string
  found: (count: number) => string
  progress: (percent: number) => string
}

const imageScanLabels: ImageScanLabels = {
  regions: "Detected regions",
  steps: "Scan steps",
  scan: "Scan image",
  scanning: "Scanning image",
  cancel: "Cancel scan",
  retry: "Retry scan",
  error: "The scan failed",
  found: (count) => (count === 1 ? "1 item found" : `${String(count)} items found`),
  progress: (percent) => `Scan ${String(percent)}%`,
}

type ImageScanStatusBarProps = {
  status: ImageScanStatus
  progress?: number
  statusText?: string
  steps?: readonly ImageScanStep[]
  step?: string
  error?: string
  actions?: ReactNode
  count: number
  labels: ImageScanLabels
  scan?: (event: Event) => void
  cancel?: (event: Event) => void
  retry?: (event: Event) => void
}

function ImageScanStatusBar({
  status,
  progress,
  statusText,
  steps,
  step,
  count,
  error,
  labels,
  actions,
  scan,
  cancel,
  retry,
}: ImageScanStatusBarProps) {
  if (status === "scanning") {
    return (
      <div className="flex flex-col gap-items">
        <div className="flex items-end gap-items">
          <Progress value={progress === undefined ? null : Math.round(progress * 1000) / 10} className="min-w-0 flex-1">
            <ProgressLabel className="min-w-0 truncate">{statusText ?? labels.scanning}</ProgressLabel>
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
        {steps && steps.length > 0 ? <ImageScanSteps steps={steps} step={step} label={labels.steps} /> : null}
      </div>
    )
  }
  if (status === "error") {
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
  const summary = status === "result" ? labels.found(count) : null
  if (!summary && !scan && !actions) return null
  return (
    <div className="flex flex-wrap items-center gap-items">
      {summary ? <p className="min-w-0 flex-1 text-body-sm text-muted-foreground">{summary}</p> : null}
      {status === "uploaded" && scan ? (
        <Button size="sm" onClick={(event) => scan(event.nativeEvent)}>
          <ScanSearchIcon />
          {labels.scan}
        </Button>
      ) : null}
      {actions}
    </div>
  )
}

function ImageScanSteps({ steps, step, label }: { steps: readonly ImageScanStep[]; step?: string; label: string }) {
  const current = steps.findIndex((item) => item.id === step)
  return (
    <ol aria-label={label} className="flex flex-wrap gap-x-group gap-y-inline text-caption">
      {steps.map((item, index) => {
        const state = index < current ? "done" : index === current ? "current" : "pending"
        return (
          <li
            key={item.id}
            aria-current={state === "current" ? "step" : undefined}
            data-state={state}
            className="flex items-center gap-inline text-muted-foreground data-[state=current]:font-medium data-[state=current]:text-foreground"
          >
            {state === "done" ? (
              <CheckIcon aria-hidden strokeWidth={3} className="size-3 text-success" />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full border border-current",
                  state === "current" && "border-info bg-info",
                )}
              />
            )}
            {item.label}
          </li>
        )
      })}
    </ol>
  )
}

export { imageScanLabels, ImageScanStatusBar, ImageScanSteps }
export type { ImageScanLabels, ImageScanStatusBarProps, ImageScanStep }
