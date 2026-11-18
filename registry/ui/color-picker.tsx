"use client"

import {
  ColorPicker as ColorPickerPrimitive,
  ColorPickerArea as ColorPickerAreaPrimitive,
  ColorPickerAreaCanvas as ColorPickerAreaCanvasPrimitive,
  ColorPickerAreaThumb as ColorPickerAreaThumbPrimitive,
  ColorPickerChannelInput as ColorPickerChannelInputPrimitive,
  ColorPickerEyeDropper as ColorPickerEyeDropperPrimitive,
  ColorPickerInput as ColorPickerInputPrimitive,
  ColorPickerSlider as ColorPickerSliderPrimitive,
  ColorPickerSliderThumb as ColorPickerSliderThumbPrimitive,
  ColorPickerSwatch as ColorPickerSwatchPrimitive,
  ColorPickerSwatches as ColorPickerSwatchesPrimitive,
  ColorPickerSwatchItem as ColorPickerSwatchItemPrimitive,
  createColorPickerController,
  type ColorPickerState,
} from "@ui-sdk/react/color-picker"
import { createContext, use, useRef, type ComponentProps } from "react"
import { PipetteIcon } from "lucide-react"

import { fieldSurfaceClassName } from "@/components/ui/input"
import { ControlTooltip, type ControlTooltipOption } from "@/components/ui/tooltip"
import { useColorAreaCanvas } from "@/components/ui/use-color-area-canvas"
import type { AreaGamut } from "@/lib/oklch-gamut"
import { cnState } from "@/lib/utils"

type ColorPickerLabels = {
  /** Names the text field that takes any CSS colour. */
  value: string
}

const colorPickerLabels: ColorPickerLabels = { value: "Colour value" }

const GamutContext = createContext<AreaGamut>("srgb")
// The area's state, inside an OKLCH area across chroma and up lightness: the one ColorPickerAreaCanvas paints itself.
const OklchAreaContext = createContext<ColorPickerState | null>(null)

type ColorPickerProps = ComponentProps<typeof ColorPickerPrimitive> & { labels?: Partial<ColorPickerLabels> }

/**
 * A group around the parts. Without children it renders an area, a hue slider, a swatch and a text field; with
 * `space="oklch"` the area paints itself on a canvas, since no gradient draws OKLCH's edge.
 */
function ColorPicker({ className, children, labels, ...props }: ColorPickerProps) {
  const oklch = props.space === "oklch"
  return (
    <GamutContext value={props.gamut === "p3" ? "p3" : "srgb"}>
      <ColorPickerPrimitive className={cnState("flex w-full flex-col gap-items", className)} {...props}>
        {children ?? (
          <>
            <ColorPickerArea>
              {oklch ? <ColorPickerAreaCanvas /> : null}
              <ColorPickerAreaThumb />
            </ColorPickerArea>
            <ColorPickerSlider channel="hue">
              <ColorPickerSliderThumb />
            </ColorPickerSlider>
            <div className="flex items-center gap-items">
              <ColorPickerSwatch />
              <ColorPickerInput aria-label={labels?.value ?? colorPickerLabels.value} />
            </div>
          </>
        )}
      </ColorPickerPrimitive>
    </GamutContext>
  )
}

function ColorPickerArea({ className, children, x, y, ...props }: ComponentProps<typeof ColorPickerAreaPrimitive>) {
  const chromaByLightness = (x ?? "chroma") === "chroma" && (y ?? "lightness") === "lightness"
  return (
    <ColorPickerAreaPrimitive
      x={x}
      y={y}
      className={cnState(
        "relative h-36 w-full shrink-0 touch-none rounded-choice border bg-(--color-area-background) has-[canvas]:bg-muted data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {(state: ColorPickerState) => (
        <OklchAreaContext value={state.space === "oklch" && chromaByLightness ? state : null}>
          {typeof children === "function" ? children(state) : children}
        </OklchAreaContext>
      )}
    </ColorPickerAreaPrimitive>
  )
}

const canvasClassName = "pointer-events-none absolute inset-0 size-full rounded-choice"

/**
 * Paints the area pixel by pixel. In an OKLCH area across chroma and up lightness, a point past the gamut's edge
 * shows the colour the picker holds there (the same lightness and hue at the most chroma the gamut allows), so the
 * whole box is colour and the thumb always sits on the colour chosen. Other channels use UI SDK's canvas.
 */
function ColorPickerAreaCanvas({ className, ...props }: ComponentProps<typeof ColorPickerAreaCanvasPrimitive>) {
  const area = use(OklchAreaContext)
  const gamut = use(GamutContext)
  const canvas = useRef<HTMLCanvasElement>(null)
  useColorAreaCanvas(area ? canvas : null, area?.color.coords[2] ?? 0, gamut)
  const classes = cnState(canvasClassName, className)
  if (!area) return <ColorPickerAreaCanvasPrimitive className={classes} {...props} />
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      data-slot="color-picker-area-canvas"
      // UI SDK places the thumb from the inline start, so the canvas mirrors with it in right to left.
      className={`${typeof classes === "function" ? classes(area) : classes} rtl:-scale-x-100`}
    />
  )
}

const thumbClassName =
  "touch-target size-4 rounded-full border-2 border-background bg-(--color-picker-color) shadow-sm ring-1 ring-foreground/50 outline-none focus-visible:ring-3 focus-visible:ring-ring data-disabled:cursor-not-allowed"

function ColorPickerAreaThumb({ className, ...props }: ComponentProps<typeof ColorPickerAreaThumbPrimitive>) {
  return (
    <ColorPickerAreaThumbPrimitive
      className={cnState(`${thumbClassName} -translate-x-1/2 -translate-y-1/2`, className)}
      {...props}
    />
  )
}

function ColorPickerSlider({ className, ...props }: ComponentProps<typeof ColorPickerSliderPrimitive>) {
  return (
    <ColorPickerSliderPrimitive
      className={cnState(
        "relative h-3 w-full shrink-0 touch-none rounded-full border border-input bg-(--color-slider-background) data-disabled:opacity-50 data-[orientation=vertical]:h-36 data-[orientation=vertical]:w-3",
        className,
      )}
      {...props}
    />
  )
}

function ColorPickerSliderThumb({ className, ...props }: ComponentProps<typeof ColorPickerSliderThumbPrimitive>) {
  return (
    <ColorPickerSliderThumbPrimitive
      className={cnState(
        `${thumbClassName} top-1/2 -translate-x-1/2 -translate-y-1/2 data-[orientation=vertical]:start-1/2 data-[orientation=vertical]:top-auto data-[orientation=vertical]:translate-y-1/2 rtl:translate-x-1/2`,
        className,
      )}
      {...props}
    />
  )
}

function ColorPickerSwatch({ className, ...props }: ComponentProps<typeof ColorPickerSwatchPrimitive>) {
  return (
    <ColorPickerSwatchPrimitive
      className={cnState(
        "size-control shrink-0 rounded-choice border border-input-strong bg-(--color-picker-color)",
        className,
      )}
      {...props}
    />
  )
}

const textFieldClassName = `${fieldSurfaceClassName} h-field-control min-w-0 rounded-control px-control-x text-entry outline-none focus-visible:ring-2 focus-visible:ring-ring data-readonly:bg-muted`

function ColorPickerInput({ className, ...props }: ComponentProps<typeof ColorPickerInputPrimitive>) {
  return (
    <ColorPickerInputPrimitive
      className={cnState(`${textFieldClassName} w-full font-mono`, className)}
      spellCheck={false}
      {...props}
    />
  )
}

function ColorPickerChannelInput({ className, ...props }: ComponentProps<typeof ColorPickerChannelInputPrimitive>) {
  return (
    <ColorPickerChannelInputPrimitive
      className={cnState(`${textFieldClassName} w-16 text-center tabular-nums`, className)}
      {...props}
    />
  )
}

function ColorPickerEyeDropper({
  className,
  children,
  "aria-label": ariaLabel = "Pick a colour from the screen",
  tooltip,
  ...props
}: ComponentProps<typeof ColorPickerEyeDropperPrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <ColorPickerEyeDropperPrimitive
        aria-label={ariaLabel}
        className={cnState(
          `${fieldSurfaceClassName} touch-target inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-unsupported:hidden [&_svg]:size-4`,
          className,
        )}
        {...props}
      >
        {children ?? <PipetteIcon />}
      </ColorPickerEyeDropperPrimitive>
    </ControlTooltip>
  )
}

function ColorPickerSwatches({ className, ...props }: ComponentProps<typeof ColorPickerSwatchesPrimitive>) {
  return <ColorPickerSwatchesPrimitive className={cnState("flex flex-wrap gap-inline", className)} {...props} />
}

// On a coarse pointer the presets grow to 44px rather than overlapping hit areas, since they sit a gap apart.
function ColorPickerSwatchItem({ className, ...props }: ComponentProps<typeof ColorPickerSwatchItemPrimitive>) {
  return (
    <ColorPickerSwatchItemPrimitive
      className={cnState(
        "size-control-sm shrink-0 cursor-pointer rounded-choice border border-input-strong bg-(--color-picker-color) outline-none pointer-coarse:size-(--control-height-touch) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-selected:ring-2 data-selected:ring-foreground data-selected:ring-offset-2 data-selected:ring-offset-background",
        className,
      )}
      {...props}
    />
  )
}

export {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaCanvas,
  ColorPickerAreaThumb,
  ColorPickerChannelInput,
  ColorPickerEyeDropper,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
  ColorPickerSwatch,
  ColorPickerSwatches,
  ColorPickerSwatchItem,
  colorPickerLabels,
  createColorPickerController,
}
export type { ColorPickerLabels, ColorPickerProps }
export type {
  ColorChannel,
  ColorFormat,
  ColorPickerController,
  ColorPickerSpace,
  ColorPickerValueChangeReason,
} from "@ui-sdk/react/color-picker"
