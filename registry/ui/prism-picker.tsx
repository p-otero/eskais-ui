"use client"

import { createParts } from "@ui-sdk/react/primitive"
import {
  createSliderController,
  Slider,
  SliderControl,
  SliderThumb,
  SliderTrack,
  type SliderValueChangeDetails,
} from "@ui-sdk/react/slider"
import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import {
  angleAt,
  colourAt,
  colourName,
  readingAt,
  wavelengthAtAngle,
  type ColourNames,
} from "@/components/ui/prism-picker-dial"
import { maxWavelength, minWavelength } from "@/components/ui/prism-picker-optics"
import { prismPicker } from "@/components/ui/prism-picker-primitive"
import { ringRadius, stageCentre } from "@/components/ui/prism-picker-scene"
import { usePrismPickerScene } from "@/components/ui/use-prism-picker-scene"
import { cn, cssVars } from "@/lib/utils"

const { Root: PrismPickerRoot } = createParts(prismPicker, { root: "div" })

type PrismPickerLabels = {
  /** Names the dial, a slider in nanometres, for screen readers and agents. */
  dial: string
  /** The readout's terms. */
  hex: string
  wavelength: string
  hue: string
  prism: string
  /** The colour names the value text and the readout use, by hue. */
  names: ColourNames
}

const prismPickerLabels: PrismPickerLabels = {
  dial: "Wavelength",
  hex: "Hex",
  wavelength: "Wavelength",
  hue: "Hue",
  prism: "Prism",
  names: {
    red: "red",
    orange: "orange",
    yellow: "yellow",
    green: "green",
    cyan: "cyan",
    blue: "blue",
    violet: "violet",
  },
}

/** The picked colour: the sRGB hex the rays and swatch show, its hues, and the wavelength behind it. */
type PrismColor = { hex: string; oklchHue: number; hslHue: number; wavelength: number }

type PrismPickerState = { disabled: boolean }

type PrismPickerProps = {
  /** The accessible name of the picker as a whole. */
  label: string
  /** The picked wavelength in nm, a whole number from 380 to 700. Pass it to control the picker. */
  value?: number
  defaultValue?: number
  /** Runs on every step of a drag or a key, with UI SDK's slider details (`reason`, `source`, `cancel()`). */
  onValueChange?: (value: number, details: SliderValueChangeDetails) => void
  /** Runs once a drag or a key press that changed the value ends, for saving. */
  onValueCommit?: (value: number) => void
  /** Runs with the colour on every change, with the same details. */
  onColorChange?: (color: PrismColor, details: SliderValueChangeDetails) => void
  disabled?: boolean
  /** Submits the wavelength under this name in a form. */
  name?: string
  /** Overrides any label; `names` overrides colour names one by one. */
  labels?: Partial<Omit<PrismPickerLabels, "names">> & { names?: Partial<ColourNames> }
  /** Classes for the root; a function gets the picker's state. */
  className?: string | ((state: PrismPickerState) => string | undefined)
  /** Called with each canvas paint's duration in ms, for measuring. */
  onPaint?: (milliseconds: number) => void
}

const prismColor = (wavelength: number): PrismColor => {
  const colour = colourAt(wavelength)
  return { hex: colour.hex, oklchHue: colour.hue, hslHue: colour.hslHue, wavelength }
}

const signed = (value: number) => `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}`

const ticks = Array.from({ length: (maxWavelength - minWavelength) / 10 + 1 }, (_, index) => minWavelength + index * 10)
const numbered = [450, 500, 550, 600, 650]
const arcSegments = Array.from({ length: 80 }, (_, index) => {
  const from = minWavelength + index * 4
  return { from, to: from + 4, colour: colourAt(from).hex }
})

const polar = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180
  return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) }
}

function arcPath(from: number, to: number, radius: number) {
  const start = polar(angleAt(from), radius)
  const end = polar(angleAt(to), radius)
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${String(radius)} ${String(radius)} 0 0 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

const DialScale = memo(function DialScale() {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- an instrument's engraved scale, not an icon
    <svg data-slot="prism-scale" aria-hidden="true" viewBox="-130 -130 260 260">
      <circle r="100" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.6" />
      <circle r="100" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="14" />
      {arcSegments.map(({ from, to, colour }) => (
        <path key={from} d={arcPath(from, to, 93)} fill="none" strokeWidth="1.6" stroke={colour} strokeOpacity="0.85" />
      ))}
      {ticks.map((nanometres) => {
        const major = nanometres % 50 === 0
        const inner = polar(angleAt(nanometres), 104)
        const outer = polar(angleAt(nanometres), major ? 112 : 108)
        return (
          <line
            key={nanometres}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="currentColor"
            strokeOpacity={major ? 0.55 : 0.22}
            strokeWidth={major ? 0.9 : 0.6}
          />
        )
      })}
    </svg>
  )
})

function pointerOnDial(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - (rect.left + rect.width * stageCentre.x)
  const y = event.clientY - (rect.top + rect.height * stageCentre.y)
  return {
    angle: (Math.atan2(y, x) * 180) / Math.PI,
    distance: Math.hypot(x, y),
    ring: ringRadius(rect.width, rect.height),
  }
}

type Drag = { pointer: number; relative: boolean; from: number; dial: number }

/**
 * A hue picker built on a prism: a white beam refracts through glass the dial turns, and the wavelength that leaves
 * through the fixed exit slit is the colour. The dial is UI SDK's slider in nanometres (arrows, Page Up and Down,
 * Home and End); a drag on the ring or on the prism turns it. Spectral colours only, 380 to 700 nm.
 */
function PrismPicker({
  label,
  value,
  defaultValue = 520,
  onValueChange,
  onValueCommit,
  onColorChange,
  disabled = false,
  name,
  labels: labelOverrides,
  className,
  onPaint,
}: PrismPickerProps) {
  const labels = { ...prismPickerLabels, ...labelOverrides }
  const names = { ...prismPickerLabels.names, ...labelOverrides?.names }
  const [slider] = useState(() => createSliderController<number>())
  const [ownValue, setOwnValue] = useState(defaultValue)
  const wavelength = value ?? ownValue
  const [instant, setInstant] = useState(false)
  const [dragging, setDragging] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const light = useRef<HTMLCanvasElement>(null)
  const [canvases] = useState(() => ({ stage, light }))
  const drag = useRef<Drag | null>(null)
  usePrismPickerScene(canvases, { wavelength, instant, onPaint })

  const reading = readingAt(wavelength)
  // Perf: what the server renders, before the hook sets the knob's own angle and colour; it never changes after, so a key
  // press doesn't restyle the stage.
  const [firstPaint] = useState(() => ({ colour: reading.colour.hex, dial: `${String(angleAt(wavelength))}deg` }))
  const colourNameOf = (nanometres: number) => colourName(colourAt(nanometres).hue, names)

  const moveTo = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    const { angle, distance } = pointerOnDial(event)
    if (current.relative && distance < 8) return
    const delta = ((((angle - current.from + 180) % 360) + 360) % 360) - 180
    const dial = current.relative ? current.dial + delta : angle
    if (current.relative) {
      current.from = angle
      current.dial = dial
    }
    const next = wavelengthAtAngle(dial, slider.getValue())
    if (next !== slider.getValue()) slider.setValue(next, { reason: "drag", event: event.nativeEvent })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return
    const { angle, distance, ring } = pointerOnDial(event)
    const onRing = Math.abs(distance - ring) <= 24
    if (!onRing && distance > ring - 24) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, relative: !onRing, from: angle, dial: angleAt(slider.getValue()) }
    setDragging(true)
    slider.focus()
    if (onRing) moveTo(event)
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    setDragging(false)
  }

  const onChange = (next: number, details: SliderValueChangeDetails) => {
    onValueChange?.(next, details)
    if (details.canceled) return
    setInstant(details.reason === "drag")
    setOwnValue(next)
    onColorChange?.(prismColor(next), details)
  }

  return (
    <PrismPickerRoot
      slider={slider}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className({ disabled }) : className,
      )}
    >
      <div
        ref={stage}
        data-slot="prism-stage"
        data-dragging={dragging ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={moveTo}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={cssVars({
          "--prism-picked": firstPaint.colour,
          "--prism-dial": firstPaint.dial,
        })}
      >
        <div data-slot="prism-grip" aria-hidden="true" />
        <canvas ref={light} data-slot="prism-light" aria-hidden="true" />
        <DialScale />
        {numbered.map((nanometres) => (
          <span
            key={nanometres}
            data-slot="prism-tick"
            aria-hidden="true"
            style={cssVars({ "--prism-tick-angle": `${String(angleAt(nanometres))}deg` })}
          >
            {nanometres}
          </span>
        ))}
        <Slider
          controller={slider}
          value={wavelength}
          onValueChange={onChange}
          onValueCommit={onValueCommit ? (next: number) => onValueCommit(next) : undefined}
          min={minWavelength}
          max={maxWavelength}
          step={1}
          largeStep={10}
          disabled={disabled}
          name={name}
          format={(next: number) => `${String(next)} nm, ${colourNameOf(next)}`}
          className="pointer-events-none absolute inset-0"
        >
          <SliderControl className="absolute inset-0">
            <SliderTrack className="absolute inset-0">
              <SliderThumb aria-label={labels.dial} className="touch-target" />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </div>
      <dl className="flex flex-wrap items-start gap-group p-inset-surface">
        <div
          data-slot="prism-colour"
          style={cssVars({ "--prism-picked": reading.colour.hex })}
          className="min-w-40 grow basis-0 gap-x-items"
        >
          <dt className="sr-only">{labels.hex}</dt>
          <dd className="font-mono text-title-sm tracking-tight uppercase">{reading.colour.hex}</dd>
          <dd className="text-caption text-muted-foreground">{colourName(reading.colour.hue, names)}</dd>
        </div>
        <div className="flex grow basis-0 flex-col">
          <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.wavelength}</dt>
          <dd className="font-mono text-body tabular-nums">{`${String(Math.round(wavelength))} nm`}</dd>
        </div>
        <div className="flex grow basis-0 flex-col">
          <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.hue}</dt>
          <dd className="font-mono text-body tabular-nums">
            {`${String(Math.round(reading.colour.hue))}°`}{" "}
            <span className="text-caption text-muted-foreground">OKLCH</span>
          </dd>
          <dd className="font-mono text-caption text-muted-foreground tabular-nums">
            {`${String(Math.round(reading.colour.hslHue))}° HSL`}
          </dd>
        </div>
        <div className="flex grow basis-0 flex-col">
          <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.prism}</dt>
          <dd className="font-mono text-body tabular-nums">{`${signed(reading.rotation)}°`}</dd>
        </div>
      </dl>
    </PrismPickerRoot>
  )
}

export { PrismPicker, prismPickerLabels }
export type { PrismColor, PrismPickerLabels, PrismPickerProps, PrismPickerState }
