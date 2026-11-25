import { minutesPerDay, skyAt, solarDay, sunAltitude, type SolarPlace } from "@/components/ui/sun-arc-solar"

const edgeInset = 0.04
const horizonAt = 0.76
const skyTopAt = 0.08
const nightDepth = 0.16
const nightAltitudeSpan = 60

/** Where a time of day sits across the stage, from 0 to 1. */
const timeToX = (minutes: number) => edgeInset + (minutes / minutesPerDay) * (1 - 2 * edgeInset)

/** The altitude that reaches the top of the sky: the day's highest sun with some headroom, never flatter than 45°. */
const domeScale = (place: SolarPlace) => Math.max(45, sunAltitude(place, solarDay(place).noon) * 1.15)

function altitudeToY(altitude: number, scale: number) {
  if (altitude >= 0) return horizonAt - (Math.min(altitude, scale) / scale) * (horizonAt - skyTopAt)
  return horizonAt + Math.min(1, -altitude / nightAltitudeSpan) * nightDepth
}

type SunArcVars = Record<`--sun-arc-${string}`, string>

// Perf: the sky repaints the whole stage, so its colours move in half-degree steps of altitude, about two minutes of the
// sun: an arrow key in between only moves the sun, the glow and the glint, which sit on their own layers.
const skyStepDegrees = 0.5

/** The CSS variables the stage paints from at one moment: sky colours, light levels and the sun's place. */
function sceneVars(place: SolarPlace, scale: number, minutes: number): SunArcVars {
  const altitude = sunAltitude(place, minutes)
  const sky = skyAt(Math.round(altitude / skyStepDegrees) * skyStepDegrees)
  const x = timeToX(minutes)
  const y = altitudeToY(altitude, scale)
  return {
    "--sun-arc-zenith": sky.zenith,
    "--sun-arc-horizon": sky.horizon,
    "--sun-arc-sun": sky.sun,
    "--sun-arc-glow": sky.glow,
    "--sun-arc-dusk": sky.dusk.toFixed(2),
    "--sun-arc-night": sky.night.toFixed(2),
    "--sun-arc-daylight": sky.daylight.toFixed(2),
    "--sun-arc-fx": x.toFixed(5),
    "--sun-arc-fy": y.toFixed(5),
  }
}

const pathStepMinutes = 10

/** The sun's path over the day in a 1000 × 1000 box stretched over the stage. */
function sunPath(place: SolarPlace, scale: number) {
  const points: string[] = []
  for (let minutes = 0; minutes <= minutesPerDay; minutes += pathStepMinutes) {
    const x = timeToX(minutes) * 1000
    const y = altitudeToY(sunAltitude(place, minutes), scale) * 1000
    points.push(`${points.length === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return points.join(" ")
}

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const skylineWidth = 2400
const skylineHeight = 300

type SkylineLayer = { outline: string; windows: string }

type LayerShape = {
  seed: number
  minHeight: number
  maxHeight: number
  minWidth: number
  maxWidth: number
  lit: number
}

function skylineLayer({ seed, minHeight, maxHeight, minWidth, maxWidth, lit }: LayerShape): SkylineLayer {
  const random = seeded(seed)
  const outline: string[] = [`M0 ${String(skylineHeight)}`]
  const windows: string[] = []
  let x = 0
  while (x < skylineWidth) {
    const width = Math.round(minWidth + random() * (maxWidth - minWidth))
    const height = Math.round(minHeight + random() ** 1.6 * (maxHeight - minHeight))
    const top = skylineHeight - height
    const setback = random() < 0.35 ? Math.round(width * 0.18) : 0
    const setbackDrop = setback ? Math.round(height * 0.12) : 0
    outline.push(`L${String(x)} ${String(top + setbackDrop)}`)
    if (setback)
      outline.push(`L${String(x + setback)} ${String(top + setbackDrop)}`, `L${String(x + setback)} ${String(top)}`)
    const spire = height > maxHeight * 0.72 && random() < 0.5
    if (spire) {
      const middle = x + Math.round(width / 2)
      outline.push(
        `L${String(middle - 3)} ${String(top)}`,
        `L${String(middle - 1)} ${String(top - 26)}`,
        `L${String(middle + 1)} ${String(top - 26)}`,
        `L${String(middle + 3)} ${String(top)}`,
      )
    }
    if (setback)
      outline.push(
        `L${String(x + width - setback)} ${String(top)}`,
        `L${String(x + width - setback)} ${String(top + setbackDrop)}`,
      )
    outline.push(`L${String(x + width)} ${String(top + setbackDrop)}`, `L${String(x + width)} ${String(skylineHeight)}`)
    for (let row = top + setbackDrop + 8; row < skylineHeight - 8; row += 11) {
      for (let column = x + 5; column < x + width - 7; column += 8) {
        if (random() < lit) windows.push(`M${String(column)} ${String(row)}h4v6h-4z`)
      }
    }
    x += width + Math.round(random() * 6)
  }
  outline.push(`L${String(skylineWidth)} ${String(skylineHeight)}Z`)
  return { outline: outline.join(""), windows: windows.join("") }
}

const skyline = {
  viewBox: `0 0 ${String(skylineWidth)} ${String(skylineHeight)}`,
  far: skylineLayer({ seed: 7, minHeight: 70, maxHeight: 230, minWidth: 40, maxWidth: 110, lit: 0 }),
  middle: skylineLayer({ seed: 19, minHeight: 50, maxHeight: 260, minWidth: 46, maxWidth: 120, lit: 0.08 }),
  near: skylineLayer({ seed: 31, minHeight: 30, maxHeight: 130, minWidth: 60, maxWidth: 150, lit: 0.16 }),
}

const stars = (() => {
  const random = seeded(3)
  return Array.from({ length: 70 }, (_, index) => ({
    key: index,
    x: (random() * 100).toFixed(2),
    y: (random() * horizonAt * 92).toFixed(2),
    r: (0.6 + random() ** 3 * 1.4).toFixed(2),
    o: (0.35 + random() * 0.65).toFixed(2),
  }))
})()

export { domeScale, horizonAt, sceneVars, skyline, stars, sunPath, timeToX }
export type { SunArcVars }
