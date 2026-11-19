"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts, usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { useMemo, type ComponentProps, type ReactNode } from "react"

import {
  clampBox,
  imageScan,
  mapRegionBox,
  type ImageScanActionReason,
  type ImageScanAnnouncements,
  type ImageScanBox,
  type ImageScanFit,
  type ImageScanSelectReason,
  type ImageScanStatus,
} from "@/components/ui/image-scan-primitive"
import {
  imageScanLabels,
  ImageScanStatusBar,
  type ImageScanLabels,
  type ImageScanStep,
} from "@/components/ui/image-scan-status"
import type { Tone } from "@/lib/tone"
import { cn, cnState } from "@/lib/utils"

const {
  Frame: ImageScanFrame,
  Image: ImageScanImage,
  Layer: ImageScanLayer,
  Effect: ImageScanEffect,
  Regions: ImageScanRegions,
  Region: ImageScanRegionButton,
  Legend: ImageScanLegend,
  LegendItem: ImageScanLegendItem,
} = createParts(imageScan, {
  frame: "div",
  image: "img",
  layer: "div",
  effect: "div",
  regions: "ol",
  region: "button",
  legend: "ul",
  "legend-item": "li",
})

/** Something the scan found, with its box on the image as fractions of the image's width and height. */
type ImageScanRegion = {
  id: string
  label: string
  box: ImageScanBox
  /** Extra text after the label, like a confidence: `"92%"`. */
  description?: string
  tone?: Tone
}

type ImageScanProps = Omit<PartProps<"div">, "children"> & {
  src: string
  /** Describes the image. Required: the scan is about what it shows. */
  alt: string
  /** The image's size in pixels, so the frame keeps its ratio before the image loads. */
  width?: number
  height?: number
  /** More props for the image element, like `srcSet`, `sizes` or `crossOrigin`. */
  imageProps?: Omit<ComponentProps<"img">, "src" | "alt" | "width" | "height">
  status?: ImageScanStatus
  /** From 0 to 1 while scanning; leave it out while the scan can't tell how far it is. */
  progress?: number
  /** What the scan is doing now, shown as the progress bar's label; `labels.scanning` by default. */
  statusText?: string
  steps?: readonly ImageScanStep[]
  /** The id of the step running now; the steps before it show as done. */
  step?: string
  regions?: readonly ImageScanRegion[]
  selectedRegion?: string | null
  defaultSelectedRegion?: string | null
  onSelectedRegionChange?: (region: string | null, details: ImageScanChangeDetails) => void
  /** Shows Cancel while scanning; agents call `cancel`. */
  onCancel?: (details: ImageScanEventDetails) => void
  /** Shows Retry after an error; agents call `retry`. */
  onRetry?: (details: ImageScanEventDetails) => void
  /** Shows a Scan button while the image waits; agents call `scan`. */
  onScan?: (details: ImageScanEventDetails) => void
  /** What went wrong, shown and read at once in the error state; `labels.error` by default. */
  error?: string
  /** How the image fills a frame of another ratio. Regions follow it. */
  fit?: ImageScanFit
  /** The frame's width over its height; the image's own by default, which leaves nothing to fit. */
  aspectRatio?: number
  /** Lists the regions under the image, linked to their boxes on hover. On by default. */
  legend?: boolean
  /** More controls beside the state's own, like a button to choose another image. */
  actions?: ReactNode
  labels?: Partial<ImageScanLabels>
}

type ImageScanEventDetails = ChangeDetails<ImageScanActionReason>
type ImageScanChangeDetails = ChangeDetails<ImageScanSelectReason>

// The image's drawn box: a frame of another ratio letterboxes it (contain) or crops it (cover), and regions are
// placed in fractions of this box, so they land on the pixels the image shows without measuring anything.
const layerClassName =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- the drawn image's size from the frame's container units and the image's ratio, for both fits
  "pointer-events-none absolute top-1/2 left-1/2 h-[min(100cqh,calc(100cqw/var(--image-scan-ratio)))] w-[min(100cqw,calc(100cqh*var(--image-scan-ratio)))] -translate-x-1/2 -translate-y-1/2 data-[fit=cover]:h-[max(100cqh,calc(100cqw/var(--image-scan-ratio)))] data-[fit=cover]:w-[max(100cqw,calc(100cqh*var(--image-scan-ratio)))]"

const regionColor =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- one colour per tone, read by the border, the fill and the legend's swatch
  "[--region-color:var(--primary)] data-[tone=neutral]:[--region-color:var(--muted-foreground)] data-[tone=info]:[--region-color:var(--info)] data-[tone=success]:[--region-color:var(--success)] data-[tone=warning]:[--region-color:var(--warning)] data-[tone=destructive]:[--region-color:var(--destructive)] data-[tone=violet]:[--region-color:var(--violet)]"

const regionClassName = cn(
  regionColor,
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- a hairline of the background on both sides keeps the box visible on any photo; the stagger reads the region's index
  "group/region pointer-events-auto absolute cursor-pointer rounded-sm border-2 border-(--region-color) shadow-[0_0_0_1px_var(--background),inset_0_0_0_1px_var(--background)] outline-none transition delay-[calc(var(--image-scan-region-index)*60ms)] duration-panel ease-standard starting:scale-95 starting:opacity-0",
  "before:absolute before:inset-0 before:bg-(--region-color) before:opacity-0 before:transition-opacity before:duration-micro hover:before:opacity-20 data-highlighted:before:opacity-20 data-selected:border-3 data-selected:before:opacity-30",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
)

const chipClassName =
  "pointer-events-none absolute bottom-full left-0 flex max-w-48 items-center gap-inline truncate rounded-sm bg-popover px-inset-chip py-inset-chip text-caption font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-floating transition-opacity duration-micro group-hover/region:opacity-100 group-focus-visible/region:opacity-100 group-data-highlighted/region:opacity-100 group-data-selected/region:opacity-100 group-data-[align=end]/region:right-0 group-data-[align=end]/region:left-auto group-data-[edge=top]/region:top-0 group-data-[edge=top]/region:bottom-auto"

/* oxlint-disable shadcn/no-arbitrary-values -- the effect follows the progress and container variables, and draws a wedge and a halo no token describes */
const effectClassNames = {
  // The accent the sweep, the line and the brackets draw in: scanning is work in progress, the info tone's meaning.
  root: "group/effect absolute inset-0 overflow-hidden [--image-scan-accent:var(--info)]",
  // Dims the image, and once progress is known only the part still to scan: a scale, so nothing lays out.
  veil: "absolute inset-0 origin-bottom bg-overlay opacity-50 transition-transform duration-panel ease-standard group-data-determinate/effect:scale-y-[calc(1-var(--image-scan-progress,0))]",
  // While progress is unknown a wedge turns around the centre: one rotation on the compositor, gone under reduced
  // motion. 150cqmax covers the frame's diagonal from its centre.
  sweep:
    "absolute top-1/2 left-1/2 hidden size-[150cqmax] -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg_250deg,color-mix(in_oklch,var(--image-scan-accent)_40%,transparent)_356deg,var(--image-scan-accent)_360deg)] [animation-duration:2.4s] group-not-data-determinate/effect:motion-safe:block",
  // With progress, a line that has scanned that far down: a translate of a box the height of the image.
  line: "absolute inset-x-0 bottom-full hidden h-full translate-y-[calc(var(--image-scan-progress,0)*100%)] border-b-2 border-(--image-scan-accent) bg-linear-to-b from-transparent to-(--image-scan-accent)/25 transition-transform duration-panel ease-standard group-data-determinate/effect:block",
  bracket:
    "absolute size-6 border-(--image-scan-accent) drop-shadow-[0_0_1px_var(--background)] motion-safe:animate-pulse",
}

// The frame is a size container (Tailwind's @container is inline-size only), so the layer and the sweep can size
// themselves from it in CSS.
const frameClassName =
  "relative aspect-(--image-scan-frame-ratio) w-full overflow-hidden rounded-surface border bg-muted [container-type:size]"
/* oxlint-enable shadcn/no-arbitrary-values */

const noRegions: readonly ImageScanRegion[] = []

function readingOrder(regions: readonly ImageScanRegion[]) {
  return regions.toSorted((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
}

/**
 * An image under analysis, from a controlled `status`: `uploaded` (a preview), `scanning` (a sweep over the image, a
 * progress bar and Cancel), `result` (the detected regions as buttons over the image and a legend) or `error` (the
 * message and Retry). Screen readers hear each change, progress at most every tenth, errors at once.
 */
function ImageScan({
  src,
  alt,
  width,
  height,
  imageProps,
  status = "uploaded",
  progress,
  statusText,
  steps,
  step,
  regions = noRegions,
  selectedRegion,
  defaultSelectedRegion,
  onSelectedRegionChange,
  onCancel,
  onRetry,
  onScan,
  error,
  fit = "contain",
  aspectRatio,
  legend = true,
  actions,
  labels: ownLabels,
  className,
  ...props
}: ImageScanProps) {
  const labels = { ...imageScanLabels, ...ownLabels }
  const ordered = useMemo(() => readingOrder(regions), [regions])
  const items = useMemo(() => ordered.map((region) => ({ value: region.id, label: region.label })), [ordered])
  const announcements: ImageScanAnnouncements = {
    scanning: statusText ?? labels.scanning,
    progress: labels.progress,
    result: labels.found,
    error: error ?? labels.error,
  }
  const scan = usePrimitive(imageScan, {
    status,
    progress,
    regions: items,
    selectedRegion,
    defaultSelectedRegion,
    onSelectedRegionChange,
    onCancel: onCancel && ((_value, details) => onCancel(details)),
    onRetry: onRetry && ((_value, details) => onRetry(details)),
    onScan: onScan && ((_value, details) => onScan(details)),
    ratio: width && height ? width / height : undefined,
    aspectRatio,
    fit,
    announcements,
  })

  const content = (
    <>
      <ImageScanFrame className={frameClassName}>
        <ImageScanImage
          {...imageProps}
          src={src}
          alt={alt}
          width={width}
          height={height}
          draggable={false}
          className={cnState(
            "absolute inset-0 size-full object-contain transition duration-panel ease-standard select-none data-[fit=cover]:object-cover data-[status=error]:opacity-60 data-[status=error]:grayscale",
            imageProps?.className,
          )}
        />
        <ImageScanLayer className={layerClassName}>
          <ImageScanEffect className={effectClassNames.root}>
            <span className={effectClassNames.veil} />
            <span className={effectClassNames.sweep} />
            <span className={effectClassNames.line} />
            <span
              className={cn(effectClassNames.bracket, "top-group left-group rounded-tl-sm border-t-2 border-l-2")}
            />
            <span
              className={cn(effectClassNames.bracket, "top-group right-group rounded-tr-sm border-t-2 border-r-2")}
            />
            <span
              className={cn(effectClassNames.bracket, "right-group bottom-group rounded-br-sm border-r-2 border-b-2")}
            />
            <span
              className={cn(effectClassNames.bracket, "bottom-group left-group rounded-bl-sm border-b-2 border-l-2")}
            />
          </ImageScanEffect>
          <ImageScanRegions label={labels.regions} className="absolute inset-0">
            {ordered.map((region, index) => (
              <li key={region.id} className="contents">
                <ImageScanRegionButton
                  value={region.id}
                  box={region.box}
                  tone={region.tone}
                  index={index}
                  className={regionClassName}
                >
                  <span className={chipClassName}>
                    <span className="truncate">{region.label}</span>
                    {region.description ? (
                      <>
                        {" "}
                        <span className="text-muted-foreground tabular-nums">{region.description}</span>
                      </>
                    ) : null}
                  </span>
                </ImageScanRegionButton>
              </li>
            ))}
          </ImageScanRegions>
        </ImageScanLayer>
      </ImageScanFrame>
      <ImageScanStatusBar
        status={status}
        progress={progress}
        statusText={statusText}
        steps={steps}
        step={step}
        count={regions.length}
        error={error}
        labels={labels}
        actions={actions}
        scan={onScan ? (event) => scan.api.scan(event) : undefined}
        cancel={onCancel ? (event) => scan.api.cancel(event) : undefined}
        retry={onRetry ? (event) => scan.api.retry(event) : undefined}
      />
      {legend ? (
        <ImageScanLegend className="flex flex-wrap gap-items">
          {ordered.map((region) => (
            <ImageScanLegendItem
              key={region.id}
              value={region.id}
              tone={region.tone}
              className={cn(
                regionColor,
                "flex min-w-0 cursor-pointer items-center gap-inline rounded-full border px-inset-chip py-inset-chip text-caption transition-colors duration-micro hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:border-(--region-color) data-selected:font-medium",
              )}
            >
              <span className="size-2 shrink-0 rounded-full bg-(--region-color)" />
              <span className="truncate">{region.label}</span>
              {region.description ? (
                <span className="text-muted-foreground tabular-nums">{region.description}</span>
              ) : null}
            </ImageScanLegendItem>
          ))}
        </ImageScanLegend>
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

export { clampBox, ImageScan, imageScanLabels, mapRegionBox }
export type {
  ImageScanBox,
  ImageScanChangeDetails,
  ImageScanEventDetails,
  ImageScanFit,
  ImageScanLabels,
  ImageScanProps,
  ImageScanRegion,
  ImageScanStatus,
  ImageScanStep,
}
