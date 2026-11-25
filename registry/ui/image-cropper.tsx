"use client"

import {
  ImageCropper as ImageCropperPrimitive,
  ImageCropperFlip as ImageCropperFlipPrimitive,
  ImageCropperGrid as ImageCropperGridPrimitive,
  ImageCropperHandle as ImageCropperHandlePrimitive,
  ImageCropperImage as ImageCropperImagePrimitive,
  ImageCropperRotate as ImageCropperRotatePrimitive,
  ImageCropperSelection as ImageCropperSelectionPrimitive,
  ImageCropperViewport as ImageCropperViewportPrimitive,
  ImageCropperZoom as ImageCropperZoomPrimitive,
  createImageCropperController,
} from "@ui-sdk/react/image-cropper"
import type { ComponentProps } from "react"
import { FlipHorizontalIcon, FlipVerticalIcon, RotateCwIcon, ZoomInIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn, cnState } from "@/lib/utils"

type ImageCropperLabels = {
  zoom: string
  rotate: string
  flip: string
  flipVertical: string
}

const imageCropperLabels: ImageCropperLabels = {
  zoom: "Zoom",
  rotate: "Rotate",
  flip: "Flip horizontally",
  flipVertical: "Flip vertically",
}

const handlePositions = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const

type ImageCropperProps = ComponentProps<typeof ImageCropperPrimitive> & {
  /** Used only by the default layout, without children. */
  alt?: string
  labels?: Partial<ImageCropperLabels>
}

/** Without children, renders the image with its selection, then zoom, rotate and flip controls. */
function ImageCropper({ className, children, alt = "", labels: ownLabels, ...props }: ImageCropperProps) {
  const labels = { ...imageCropperLabels, ...ownLabels }
  const frame = props.mode === "frame"
  return (
    <ImageCropperPrimitive className={cnState("flex w-full flex-col gap-items", className)} {...props}>
      {children ?? (
        <>
          <ImageCropperViewport>
            <ImageCropperImage alt={alt} />
            <ImageCropperSelection>
              <ImageCropperGrid />
              {frame
                ? null
                : handlePositions.map((position) => <ImageCropperHandle key={position} position={position} />)}
            </ImageCropperSelection>
          </ImageCropperViewport>
          <div className="flex flex-wrap items-center gap-items">
            <span className="flex min-w-40 flex-1 items-center gap-inline">
              <ZoomInIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <ImageCropperZoom aria-label={labels.zoom} />
            </span>
            <ImageCropperRotate>
              <RotateCwIcon />
              {labels.rotate}
            </ImageCropperRotate>
            <ImageCropperFlip>
              <FlipHorizontalIcon />
              {labels.flip}
            </ImageCropperFlip>
            <ImageCropperFlip direction="vertical">
              <FlipVerticalIcon />
              {labels.flipVertical}
            </ImageCropperFlip>
          </div>
        </>
      )}
    </ImageCropperPrimitive>
  )
}

function ImageCropperViewport({ className, ...props }: ComponentProps<typeof ImageCropperViewportPrimitive>) {
  return (
    <ImageCropperViewportPrimitive
      className={cnState(
        "w-full touch-none rounded-surface border bg-muted p-group select-none data-error:border-destructive-border data-loading:animate-pulse data-[mode=box]:aspect-(--image-cropper-aspect-ratio) data-[mode=frame]:aspect-square motion-reduce:data-loading:animate-none",
        className,
      )}
      {...props}
    />
  )
}

function ImageCropperImage({ className, ...props }: ComponentProps<typeof ImageCropperImagePrimitive>) {
  return (
    <ImageCropperImagePrimitive
      className={cnState("max-w-none select-none data-loading:opacity-0", className)}
      draggable={false}
      {...props}
    />
  )
}

function ImageCropperSelection({ className, ...props }: ComponentProps<typeof ImageCropperSelectionPrimitive>) {
  return (
    <ImageCropperSelectionPrimitive
      className={cnState(
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- a spread shadow far past the viewport dims everything outside the crop
        "cursor-move border-2 border-background shadow-[0_0_0_100vmax_var(--overlay)] outline-none focus-visible:border-ring data-disabled:cursor-not-allowed data-[mode=frame]:cursor-grab data-[shape=circle]:rounded-full data-loading:hidden",
        className,
      )}
      {...props}
    />
  )
}

function ImageCropperGrid({ className, ...props }: ComponentProps<typeof ImageCropperGridPrimitive>) {
  return (
    <ImageCropperGridPrimitive
      className={cnState(
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- lines at the thirds, drawn only while dragging
        "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-micro ease-standard data-dragging:opacity-100 bg-[linear-gradient(to_right,transparent_calc(100%/3-0.5px),var(--background)_calc(100%/3-0.5px),var(--background)_calc(100%/3+0.5px),transparent_calc(100%/3+0.5px),transparent_calc(200%/3-0.5px),var(--background)_calc(200%/3-0.5px),var(--background)_calc(200%/3+0.5px),transparent_calc(200%/3+0.5px)),linear-gradient(to_bottom,transparent_calc(100%/3-0.5px),var(--background)_calc(100%/3-0.5px),var(--background)_calc(100%/3+0.5px),transparent_calc(100%/3+0.5px),transparent_calc(200%/3-0.5px),var(--background)_calc(200%/3-0.5px),var(--background)_calc(200%/3+0.5px),transparent_calc(200%/3+0.5px))]",
        className,
      )}
      {...props}
    />
  )
}

function ImageCropperHandle({ className, ...props }: ComponentProps<typeof ImageCropperHandlePrimitive>) {
  return (
    <ImageCropperHandlePrimitive
      className={cnState(
        [
          "touch-target absolute size-3 rounded-sm border border-primary bg-background shadow-xs -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2",
          "data-[position=n]:start-1/2 data-[position=n]:top-0 data-[position=n]:cursor-ns-resize",
          "data-[position=s]:start-1/2 data-[position=s]:top-full data-[position=s]:cursor-ns-resize",
          "data-[position=e]:start-full data-[position=e]:top-1/2 data-[position=e]:cursor-ew-resize",
          "data-[position=w]:start-0 data-[position=w]:top-1/2 data-[position=w]:cursor-ew-resize",
          "data-[position=nw]:start-0 data-[position=nw]:top-0 data-[position=nw]:cursor-nwse-resize",
          "data-[position=ne]:start-full data-[position=ne]:top-0 data-[position=ne]:cursor-nesw-resize",
          "data-[position=sw]:start-0 data-[position=sw]:top-full data-[position=sw]:cursor-nesw-resize",
          "data-[position=se]:start-full data-[position=se]:top-full data-[position=se]:cursor-nwse-resize",
          "rtl:data-[position=ne]:cursor-nwse-resize rtl:data-[position=nw]:cursor-nesw-resize rtl:data-[position=se]:cursor-nesw-resize rtl:data-[position=sw]:cursor-nwse-resize",
          "data-[shape=circle]:hidden",
        ].join(" "),
        className,
      )}
      {...props}
    />
  )
}

function ImageCropperZoom({ className, ...props }: ComponentProps<typeof ImageCropperZoomPrimitive>) {
  return (
    <ImageCropperZoomPrimitive
      className={cnState(
        "h-control min-w-0 flex-1 cursor-pointer accent-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

// Spec: a disabled button can't show a tooltip, and these stay disabled until the image loads, so they carry a visible label.
const labelledButtonClassName = cn(buttonVariants({ variant: "outline", size: "sm" }), "rtl:[&_svg]:-scale-x-100")

function ImageCropperRotate({ className, children, ...props }: ComponentProps<typeof ImageCropperRotatePrimitive>) {
  return (
    <ImageCropperRotatePrimitive className={cnState(labelledButtonClassName, className)} {...props}>
      {children ?? (
        <>
          <RotateCwIcon />
          {imageCropperLabels.rotate}
        </>
      )}
    </ImageCropperRotatePrimitive>
  )
}

function ImageCropperFlip({
  className,
  children,
  direction,
  ...props
}: ComponentProps<typeof ImageCropperFlipPrimitive>) {
  const vertical = direction === "vertical"
  return (
    <ImageCropperFlipPrimitive direction={direction} className={cnState(labelledButtonClassName, className)} {...props}>
      {children ?? (
        <>
          {vertical ? <FlipVerticalIcon /> : <FlipHorizontalIcon />}
          {vertical ? imageCropperLabels.flipVertical : imageCropperLabels.flip}
        </>
      )}
    </ImageCropperFlipPrimitive>
  )
}

export {
  createImageCropperController,
  ImageCropper,
  ImageCropperFlip,
  ImageCropperGrid,
  ImageCropperHandle,
  ImageCropperImage,
  ImageCropperRotate,
  ImageCropperSelection,
  ImageCropperViewport,
  ImageCropperZoom,
  imageCropperLabels,
}
export { cropImage } from "@ui-sdk/react/image"
export type { CropImageOptions } from "@ui-sdk/react/image"
export type { ImageCropperLabels, ImageCropperProps }
export type { ImageCrop, ImageCropperController, ImageCropperCropChangeReason } from "@ui-sdk/react/image-cropper"
