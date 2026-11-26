"use client"

import { useSyncExternalStore } from "react"

import { isRecord } from "@/lib/narrow"

const liquidLensId = "eskais-liquid-lens"

const edgeRamp = [
  [0, 255],
  [0.05, 196],
  [0.16, 128],
  [0.84, 128],
  [0.95, 60],
  [1, 0],
] as const

function rampImage(axis: "x" | "y") {
  const color = (value: number) => (axis === "x" ? `rgb(${String(value)},0,0)` : `rgb(0,${String(value)},0)`)
  const direction = axis === "x" ? "x2='1' y2='0'" : "x2='0' y2='1'"
  const stops = edgeRamp
    .map(([offset, value]) => `<stop offset='${String(offset)}' stop-color='${color(value)}'/>`)
    .join("")
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' preserveAspectRatio='none'><linearGradient id='g' ${direction}>${stops}</linearGradient><rect width='100' height='100' fill='url(#g)'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const horizontalRamp = rampImage("x")
const verticalRamp = rampImage("y")

function rendersBackdropLenses() {
  const userAgentData: unknown = Reflect.get(navigator, "userAgentData")
  return (
    isRecord(userAgentData) &&
    Array.isArray(userAgentData.brands) &&
    userAgentData.brands.some((entry: unknown) => isRecord(entry) && entry.brand === "Chromium")
  )
}

const subscribeNever = () => () => {}

type LiquidLensProps = {
  /** How far the edges shift what's behind, as a fraction of the element's size: 0 is flat glass. Defaults to 0.08. */
  refraction?: number
}

/**
 * The lens `data-theme="liquid"` refracts floating UI through: an SVG displacement filter that `backdrop-filter`
 * references by id. Render it once per page; it renders nothing where browsers can't use an SVG backdrop filter, and
 * the theme falls back to blur and saturation there.
 */
function LiquidLens({ refraction = 0.08 }: LiquidLensProps) {
  const supported = useSyncExternalStore(subscribeNever, rendersBackdropLenses, () => false)
  if (!supported) return null
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- an SVG filter that backdrop-filter references, not an icon
    <svg data-slot="liquid-lens" aria-hidden="true" width="0" height="0" className="pointer-events-none absolute">
      <filter
        id={liquidLensId}
        x="0"
        y="0"
        width="1"
        height="1"
        primitiveUnits="objectBoundingBox"
        colorInterpolationFilters="sRGB"
      >
        <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" href={horizontalRamp} result="x" />
        <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" href={verticalRamp} result="y" />
        <feComposite in="x" in2="y" operator="arithmetic" k2="1" k3="1" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={refraction} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

export { LiquidLens, liquidLensId }
export type { LiquidLensProps }
