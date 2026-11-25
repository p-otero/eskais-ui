import type { SkyPaletteKey } from "@/components/ui/live-sky-palette"

/** How a building is built: granite ashlar, painted render with blinds, white glazed galleries, or modern balconies. */
type BuildingStyle = "stone" | "render" | "galeria" | "modern"

/** A window opening, in metres: its width and height, how high its sill sits above the floor, and how deep it's set in. */
type WindowShape = { width: number; height: number; sill: number; recess: number }

/** Balconies: none, one small one per window on some floors, or a slab along the whole front on every floor. */
type Balconies = "none" | "windows" | "continuous"

/** One building's street front: on the west (-1) or east (1) side, from `start` to `end` north of the viewer, in metres. */
type Building = {
  side: -1 | 1
  start: number
  end: number
  height: number
  /** How far the front stands back from the kerb line. */
  setback: number
  floorHeight: number
  bayWidth: number
  style: BuildingStyle
  material: Extract<SkyPaletteKey, `facade${string}`>
  /** A per-building shift of the material's colour, multiplied in. */
  tint: readonly [number, number, number]
  window: WindowShape
  balconies: Balconies
  /** The window frames' colour: 0 white, 1 dark wood or metal. */
  darkFrames: boolean
  /** How deep the cornice under the roof stands out. */
  cornice: number
  /** Where a wall lantern hangs, if one does. */
  lamp: number | null
  /** A 0 to 1 hash per building, for the windows lit at night and the weathering. */
  seed: number
  /** The heights of the buildings before and after it in the row, 0 at the row's ends. */
  neighbours: readonly [number, number]
}

type Street = { halfWidth: number; buildings: Building[] }

/** A small, fast, seeded generator: the same place always gets the same street. */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function hashCoordinates(latitude: number, longitude: number) {
  const text = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
  let hash = 2_166_136_261
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619)
  return hash >>> 0
}

const streetStartM = -45
const streetEndM = 230

const styleWeights: readonly (readonly [BuildingStyle, number])[] = [
  ["galeria", 0.3],
  ["stone", 0.25],
  ["render", 0.3],
  ["modern", 0.15],
]

const materialOf: Record<BuildingStyle, Building["material"]> = {
  stone: "facade-stone",
  render: "facade",
  galeria: "facade-gallery",
  modern: "facade-concrete",
}

function pickStyle(random: () => number): BuildingStyle {
  let roll = random()
  for (const [style, weight] of styleWeights) {
    roll -= weight
    if (roll <= 0) return style
  }
  return "render"
}

function windowFor(style: BuildingStyle, bayWidth: number, floorHeight: number, random: () => number): WindowShape {
  if (style === "modern") return { width: bayWidth * 0.78, height: floorHeight - 0.45, sill: 0.15, recess: 0.12 }
  if (style === "stone") return { width: 1.05 + random() * 0.2, height: 1.75, sill: 0.85, recess: 0.38 }
  return { width: 1.1 + random() * 0.3, height: 1.6 + random() * 0.25, sill: 0.9, recess: 0.2 }
}

const tintRange = 0.08

function buildingsAlong(side: -1 | 1, random: () => number): Building[] {
  const buildings: Building[] = []
  let start = streetStartM
  while (start < streetEndM) {
    const width = 9 + random() * 15
    const style = pickStyle(random)
    const floors = 5 + Math.floor(random() * 6)
    const floorHeight = style === "modern" ? 3.05 : 3.1 + random() * 0.45
    const bayWidth = style === "modern" ? 3.2 + random() * 0.8 : 2.4 + random() * 0.9
    const shade = 1 + (random() - 0.5) * tintRange * 2
    buildings.push({
      side,
      start,
      end: start + width,
      height: floors * floorHeight + 1,
      setback: style === "modern" && random() < 0.4 ? random() * 1.2 : 0,
      floorHeight,
      bayWidth,
      style,
      material: materialOf[style],
      tint: [shade * (1 + (random() - 0.5) * 0.06), shade, shade * (1 + (random() - 0.5) * 0.06)],
      window: windowFor(style, bayWidth, floorHeight, random),
      balconies:
        style === "modern" ? "continuous" : style === "galeria" ? "none" : random() < 0.55 ? "windows" : "none",
      darkFrames: style === "modern" || (style !== "galeria" && random() < 0.35),
      cornice: style === "modern" ? 0.25 : 0.45 + random() * 0.35,
      lamp: random() < 0.45 ? start + 1.5 + random() * (width - 3) : null,
      seed: random(),
      neighbours: [0, 0],
    })
    start += width
  }
  return buildings.map((building, index) => ({
    ...building,
    neighbours: [buildings[index - 1]?.height ?? 0, buildings[index + 1]?.height ?? 0],
  }))
}

/** The street around a place: its width and both rows of buildings, the same every time for the same rounded place. */
function streetFor(latitude: number, longitude: number): Street {
  const random = seededRandom(hashCoordinates(latitude, longitude))
  return {
    halfWidth: 6.5 + random() * 2.5,
    buildings: [...buildingsAlong(-1, random), ...buildingsAlong(1, random)],
  }
}

export { seededRandom, streetFor }
export type { Balconies, Building, BuildingStyle, Street, WindowShape }
