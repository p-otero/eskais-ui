import type { SkyPaletteKey } from "@/components/ui/live-sky-palette"

type WindowStyle = "punched" | "gallery" | "ribbon"

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
  material: Extract<SkyPaletteKey, `facade${string}`>
  style: WindowStyle
  /** A 0 to 1 hash per building, for the windows lit at night and the weathering. */
  seed: number
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

const materials: Building["material"][] = ["facade", "facade-stone", "facade-concrete", "facade-gallery"]
const streetStartM = -45
const streetEndM = 230

function pick<T>(random: () => number, choices: readonly T[]): T {
  return choices[Math.floor(random() * choices.length)]!
}

function buildingsAlong(side: -1 | 1, random: () => number): Building[] {
  const buildings: Building[] = []
  let start = streetStartM
  while (start < streetEndM) {
    const width = 9 + random() * 16
    const material = pick(random, materials)
    const floors = 5 + Math.floor(random() * 6)
    const floorHeight = 2.9 + random() * 0.6
    buildings.push({
      side,
      start,
      end: start + width,
      height: floors * floorHeight + 1.2,
      setback: random() < 0.25 ? random() * 1.2 : 0,
      floorHeight,
      bayWidth: 2.4 + random() * 1.2,
      material,
      style: material === "facade-gallery" ? "gallery" : random() < 0.2 ? "ribbon" : "punched",
      seed: random(),
    })
    start += width
  }
  return buildings
}

/** The street around a place: its width and both rows of buildings, the same every time for the same rounded place. */
function streetFor(latitude: number, longitude: number): Street {
  const random = seededRandom(hashCoordinates(latitude, longitude))
  return {
    halfWidth: 6.5 + random() * 3,
    buildings: [...buildingsAlong(-1, random), ...buildingsAlong(1, random)],
  }
}

export { seededRandom, streetFor }
export type { Building, Street, WindowStyle }
