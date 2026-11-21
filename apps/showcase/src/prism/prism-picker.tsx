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
import { memo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"

import "./prism-picker.css"

import {
  angleAt,
  colourName,
  defaultColourNames,
  dialMax,
  positionAtAngle,
  readingAt,
  type ColourNames,
  type Reading,
} from "./prism-dial"
import { maxWavelength, minWavelength } from "./prism-optics"
import { prismPicker } from "./prism-picker-primitive"
import { ringRadius, stageCentre } from "./prism-scene"
import { usePrismScene } from "./use-prism-scene"

const { Root: PrismPickerRoot } = createParts(prismPicker, { root: "div" })

type PrismPickerLabels = {
  /** Names the dial for people using a screen reader, and for agents. */
  dial: string
  /** Says a purple has no wavelength of its own. */
  nonSpectral: string
  hex: string
  wavelength: string
  hue: string
  prism: string
  names: ColourNames
}

const defaultLabels: PrismPickerLabels = {
  dial: "Wavelength",
  nonSpectral: "non-spectral",
  hex: "Hex",
  wavelength: "Wavelength",
  hue: "Hue",
  prism: "Prism",
  names: defaultColourNames,
}

type PrismPickerProps = {
  /** The dial position: the wavelength in nm from 380 to 700, and with `purples`, 701 to 800 past the red end. */
  value?: number
  defaultValue?: number
  onValueChange?: (value: number, details: SliderValueChangeDetails) => void
  /** Closes the dial over the top with the non-spectral purples, from red back to violet. */
  purples?: boolean
  /** The accessible name of the picker as a whole. */
  label: string
  labels?: Partial<PrismPickerLabels>
  className?: string
  /** Called with each canvas paint's duration in ms. */
  onPaint?: (milliseconds: number) => void
}

const signed = (value: number) => `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}`

function valueText(reading: Reading, labels: PrismPickerLabels) {
  const name = colourName(reading.colour.hue, labels.names)
  if (reading.wavelength !== undefined) return `${String(Math.round(reading.wavelength))} nm, ${name}`
  return `${name}, ${labels.nonSpectral}`
}

const ticks = Array.from({ length: (maxWavelength - minWavelength) / 10 + 1 }, (_, index) => minWavelength + index * 10)
const numbered = [450, 500, 550, 600, 650]
const segment = (from: number, to: number) => ({ from, to, colour: readingAt(from).colour.hex })
const arcSegments = Array.from({ length: 80 }, (_, index) =>
  segment(minWavelength + index * 4, minWavelength + (index + 1) * 4),
)
const purpleSegments = Array.from({ length: 25 }, (_, index) =>
  segment(maxWavelength + index * 4, maxWavelength + (index + 1) * 4),
)

const polar = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180
  return { x: radius * Math.cos(radians), y: radius * Math.sin(radians) }
}

function arcPath(from: number, to: number, radius: number) {
  const start = polar(angleAt(from), radius)
  const end = polar(angleAt(to), radius)
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${String(radius)} ${String(radius)} 0 0 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

// The engraved scale: the ring is 100 units in a 260-unit square, so the CSS sizes it from the ring's radius.
const DialScale = memo(function DialScale({ purples }: { purples: boolean }) {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- an instrument scale, not an icon
    <svg data-slot="prism-scale" aria-hidden="true" viewBox="-130 -130 260 260">
      <circle r="100" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.6" />
      <circle r="100" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="14" />
      {arcSegments.map(({ from, to, colour }) => (
        <path key={from} d={arcPath(from, to, 93)} fill="none" strokeWidth="1.6" stroke={colour} strokeOpacity="0.85" />
      ))}
      {purples
        ? purpleSegments.map(({ from, to, colour }) => (
            <path
              key={from}
              d={arcPath(from, to, 93)}
              fill="none"
              strokeWidth="1.6"
              stroke={colour}
              strokeOpacity="0.7"
              strokeDasharray="1.5 2"
            />
          ))
        : null}
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

function PrismPicker({
  value,
  defaultValue = 520,
  onValueChange,
  purples = false,
  label,
  labels: labelOverrides,
  className,
  onPaint,
}: PrismPickerProps) {
  const labels = { ...defaultLabels, ...labelOverrides }
  const [slider] = useState(() => createSliderController<number>())
  const [ownValue, setOwnValue] = useState(defaultValue)
  const position = value ?? ownValue
  const [instant, setInstant] = useState(false)
  const [dragging, setDragging] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const sharp = useRef<HTMLCanvasElement>(null)
  const glow = useRef<HTMLCanvasElement>(null)
  const [canvases] = useState(() => ({ stage, sharp, glow }))
  const drag = useRef<{ pointer: number; relative: boolean; from: number; dial: number } | null>(null)
  usePrismScene(canvases, { position, instant, onPaint })

  const reading = readingAt(position)
  const max = dialMax(purples)

  const moveTo = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current
    if (!current) return
    const { angle, distance } = pointerOnDial(event)
    if (current.relative && distance < 8) return
    let delta = angle - current.from
    delta = ((((delta + 180) % 360) + 360) % 360) - 180
    const dial = current.relative ? current.dial + delta : angle
    if (current.relative) {
      current.from = angle
      current.dial = dial
    }
    const next = positionAtAngle(dial, purples, slider.getValue())
    if (next !== slider.getValue()) slider.setValue(next, { reason: "drag", event: event.nativeEvent })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const { angle, distance, ring } = pointerOnDial(event)
    // The ring takes a press anywhere across a band 48px wide; inside it, the prism turns from where it's grabbed.
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
    setInstant(details.reason === "drag")
    setOwnValue(next)
    onValueChange?.(next, details)
  }

  const hue = Math.round(reading.colour.hue)
  return (
    <PrismPickerRoot
      slider={slider}
      purples={purples}
      aria-label={label}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        className,
      )}
    >
      <div
        ref={stage}
        data-slot="prism-stage"
        data-dragging={dragging ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={moveTo}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ "--prism-picked": reading.colour.hex } as CSSProperties}
        className="dark relative w-full overflow-hidden select-none"
      >
        <div data-slot="prism-grip" aria-hidden="true" />
        <canvas
          ref={glow}
          data-slot="prism-glow"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full"
        />
        <canvas ref={sharp} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />
        <DialScale purples={purples} />
        {numbered.map((nanometres) => (
          <span
            key={nanometres}
            data-slot="prism-tick"
            aria-hidden="true"
            style={{ "--prism-tick-angle": `${String(angleAt(nanometres))}deg` } as CSSProperties}
            className="font-mono tabular-nums"
          >
            {nanometres}
          </span>
        ))}
        <Slider
          controller={slider}
          value={position}
          onValueChange={onChange}
          min={minWavelength}
          max={max}
          step={1}
          largeStep={10}
          format={(next: number) => valueText(readingAt(next), labels)}
          className="pointer-events-none absolute inset-0"
        >
          <SliderControl className="absolute inset-0">
            <SliderTrack className="absolute inset-0">
              <SliderThumb aria-label={labels.dial} className="touch-target outline-none" />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </div>
      <dl className="flex flex-wrap items-start gap-group p-inset-surface">
        <div
          data-slot="prism-colour"
          style={{ "--prism-picked": reading.colour.hex } as CSSProperties}
          className="min-w-40 grow basis-0 gap-x-items"
        >
          <dt className="sr-only">{labels.hex}</dt>
          <dd className="font-mono text-title-sm tracking-tight uppercase">{reading.colour.hex}</dd>
          <dd className="text-caption text-muted-foreground">{colourName(reading.colour.hue, labels.names)}</dd>
        </div>
        <div className="flex grow basis-0 flex-col">
          <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.wavelength}</dt>
          <dd className="font-mono text-body tabular-nums">
            {reading.wavelength === undefined ? labels.nonSpectral : `${String(Math.round(reading.wavelength))} nm`}
          </dd>
        </div>
        <div className="flex grow basis-0 flex-col">
          <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.hue}</dt>
          <dd className="font-mono text-body tabular-nums">
            {String(hue)}° <span className="text-caption text-muted-foreground">OKLCH</span>
          </dd>
          <dd className="font-mono text-caption text-muted-foreground tabular-nums">
            {String(Math.round(reading.colour.hslHue))}° HSL
          </dd>
        </div>
        <div className="flex grow basis-0 flex-col">
          <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.prism}</dt>
          <dd className="font-mono text-body tabular-nums">{signed(reading.rotation)}°</dd>
        </div>
      </dl>
    </PrismPickerRoot>
  )
}

export { PrismPicker }
export type { PrismPickerLabels, PrismPickerProps }
