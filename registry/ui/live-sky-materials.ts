import { noiseTile, sampleTile } from "@/components/ui/live-sky-noise"
import type { Rgb, SkyPalette } from "@/components/ui/live-sky-palette"
import type { Building } from "@/components/ui/live-sky-street"
import { bayAt, floorsOf, hasGallery, surfaces, windowRect, type Hit } from "@/components/ui/live-sky-trace"

/** How a surface takes light: matte, glass, a blind or curtain lit from behind, painted metal or wood, a lantern, frosted glass. */
const finishes = { matte: 0, glass: 1, translucent: 2, metal: 3, lamp: 4, frosted: 5 } as const

type Finish = (typeof finishes)[keyof typeof finishes]

/** A surface's look before any light: its colour, finish, ambient occlusion and, for windows, when it lights up at night. */
type Sample = {
  r: number
  g: number
  b: number
  finish: Finish
  occlusion: number
  /** From 0 to 1: a window lights up once the share of lit windows passes it; 0 for surfaces that never glow. */
  rank: number
}

const createSample = (): Sample => ({ r: 0, g: 0, b: 0, finish: 0, occlusion: 1, rank: 0 })

const tile = noiseTile()
const broad = (u: number, v: number) => sampleTile(tile.billow, u, v)
const fine = (u: number, v: number) => sampleTile(tile.detail, u, v)

function hash(a: number, b: number, c: number) {
  let value = Math.imul(
    Math.floor(a * 7919) ^ Math.imul(b + 1, 374_761_393) ^ Math.imul(c + 7, 668_265_263),
    2_246_822_519,
  )
  value = Math.imul(value ^ (value >>> 15), 3_266_489_917)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296
}

const whitePaint: Rgb = [0.92, 0.92, 0.89]
const darkFrame: Rgb = [0.15, 0.13, 0.11]
const iron: Rgb = [0.07, 0.07, 0.08]
const frostedGlass: Rgb = [0.6, 0.68, 0.68]
const lanternLight: Rgb = [1, 0.78, 0.46]
const interiorTints: readonly Rgb[] = [
  [1, 0.76, 0.46],
  [1, 0.8, 0.55],
  [1, 0.88, 0.72],
  [0.8, 0.87, 1],
  [1, 0.72, 0.42],
]
const blindColours: readonly Rgb[] = [
  [0.78, 0.72, 0.6],
  [0.72, 0.72, 0.7],
  [0.62, 0.66, 0.6],
]

function set(sample: Sample, colour: Rgb, scale: number, finish: Finish, occlusion = 1, rank = 0) {
  sample.r = colour[0] * scale
  sample.g = colour[1] * scale
  sample.b = colour[2] * scale
  sample.finish = finish
  sample.occlusion = occlusion
  sample.rank = rank
}

function baseOf(building: Building, palette: SkyPalette): Rgb {
  const colour = palette[building.material]
  return [colour[0] * building.tint[0], colour[1] * building.tint[1], colour[2] * building.tint[2]]
}

function masonry(building: Building, along: number, height: number) {
  if (building.style === "stone") {
    const course = Math.floor(height / 0.42)
    const shifted = along + (course % 2) * 0.45
    const block = Math.floor(shifted / 0.9)
    const inBlock = shifted % 0.9
    const joint = inBlock < 0.018 || inBlock > 0.882 || height % 0.42 < 0.016
    const tone = 0.86 + hash(building.seed, course, block) * 0.2
    return (joint ? 0.72 : tone) * (0.9 + 0.2 * fine(along * 0.9, height * 0.9))
  }
  if (building.style === "modern") {
    const joint = along % 1.2 < 0.012 || height % 0.6 < 0.012
    return joint ? 0.78 : 0.94 + hash(building.seed, Math.floor(height / 0.6), Math.floor(along / 1.2)) * 0.08
  }
  return 0.9 + 0.13 * broad(along / 3.4, height / 3.4) + 0.05 * fine(along * 0.6, height * 0.6)
}

function weathering(building: Building, along: number, height: number) {
  const streaks = broad(along * 0.75, height * 0.05)
  const runoff = Math.exp(-(building.height - 0.6 - height) / 1.4)
  let stain = 0
  for (
    let floor = Math.max(1, Math.floor(height / building.floorHeight));
    floor <= Math.floor(height / building.floorHeight) + 1;
    floor++
  ) {
    if (floor >= floorsOf(building) || hasGallery(building, floor)) continue
    const { centre, width } = bayAt(building, along)
    const rect = windowRect(building, floor, centre, width)
    const below = rect.y0 - height
    if (below > 0 && below < 1.7 && along > rect.z0 + 0.06 && along < rect.z1 - 0.06) {
      stain = Math.max(stain, (1 - below / 1.7) * (0.45 + 0.55 * fine(along * 1.6, height * 0.12)))
    }
  }
  return (1 - 0.1 * streaks) * (1 - 0.12 * runoff) * (1 - 0.24 * stain)
}

function wallOcclusion(building: Building, along: number, height: number) {
  let occlusion = 1
  const above = Math.ceil(height / building.floorHeight)
  const projected = hasGallery(building, above) || (building.balconies !== "none" && above < floorsOf(building))
  if (projected) occlusion *= 1 - 0.4 * Math.exp(-(above * building.floorHeight - height) / 0.35)
  occlusion *= 1 - 0.45 * Math.exp(-(building.height - 0.6 - height) / 0.3)
  if (building.neighbours[0] > height) occlusion *= 1 - 0.35 * Math.exp(-(along - building.start) / 0.5)
  if (building.neighbours[1] > height) occlusion *= 1 - 0.35 * Math.exp(-(building.end - along) / 0.5)
  return occlusion
}

const frameM = 0.06

function windowGlass(sample: Sample, hit: Hit, building: Building, distance: number) {
  const { floor, bay } = hit
  const { centre, width } = bayAt(building, hit.z)
  const rect = windowRect(building, floor, centre, width)
  const across = hit.u * (rect.z1 - rect.z0)
  const up = hit.v * (rect.y1 - rect.y0)
  const span = rect.z1 - rect.z0
  const tall = rect.y1 - rect.y0
  const edge = Math.min(across, span - across, up, tall - up)
  const casement = building.style !== "modern" && floor > 0
  const mullion = casement && (Math.abs(across - span / 2) < frameM / 2 || Math.abs(up - tall * 0.74) < frameM / 2)
  if (edge < frameM || mullion) {
    set(
      sample,
      building.darkFrames || floor === 0 ? darkFrame : whitePaint,
      1,
      finishes.metal,
      edge < frameM * 0.5 ? 0.8 : 1,
    )
    return
  }
  const pick = hash(building.seed, floor, bay)
  const rank = floor === 0 ? 0.05 + pick * 0.3 : 0.02 + pick * 0.98
  const blinds =
    building.style === "render" || building.style === "stone"
      ? [0, 0, 0.3, 0.55, 0.85, 1][Math.floor(hash(bay, floor, building.seed * 13) * 6)]!
      : 0
  if (floor > 0 && hit.v > 1 - blinds) {
    const colour = blindColours[Math.floor(pick * blindColours.length)]!
    const slat = distance > 28 ? 0.9 : (up * 20) % 1 < 0.5 ? 0.82 : 1
    set(sample, colour, slat, finishes.translucent, 1, rank)
    return
  }
  const tint = interiorTints[Math.floor(hash(floor, bay, building.seed * 31) * interiorTints.length)]!
  set(sample, tint, 1, finishes.glass, Math.min(1, 0.75 + edge * 2), rank)
}

function galleryFront(sample: Sample, hit: Hit, building: Building) {
  const width = building.end - building.start - 0.5
  const tall = building.floorHeight - 0.07
  const across = hit.u * width
  const up = hit.v * tall
  const panel = 0.88
  if (up < panel) {
    const inset = across % 1.1 > 0.12 && across % 1.1 < 0.98 && up > 0.14 && up < panel - 0.12
    set(sample, whitePaint, inset ? 0.88 : 0.97, finishes.matte, inset ? 0.9 : 1)
    return
  }
  const mullion = across % 0.56 < 0.05
  const rail = up < panel + 0.07 || up > tall - 0.08 || (up - panel) % 0.46 < 0.035
  if (mullion || rail) {
    set(sample, whitePaint, 1, finishes.metal)
    return
  }
  const room = Math.floor(across / 2.3)
  const rank = 0.02 + hash(building.seed, hit.floor, room) * 0.98
  const curtain = hash(room, hit.floor, building.seed * 7) < 0.22 && up > tall - 1.2
  if (curtain) set(sample, [0.9, 0.89, 0.86], 0.92, finishes.translucent, 1, rank)
  else
    set(
      sample,
      interiorTints[Math.floor(hash(hit.floor, room, building.seed) * interiorTints.length)]!,
      1,
      finishes.glass,
      1,
      rank,
    )
}

/** The look of whatever a ray hit, from the building's style, place and weathering, written into `into`. */
function sampleSurface(hit: Hit, palette: SkyPalette, into: Sample) {
  const building = hit.building
  if (!building) return into
  const base = baseOf(building, palette)
  const along = hit.z - building.start
  switch (hit.surface) {
    case surfaces.wall:
      set(
        into,
        base,
        masonry(building, along, hit.y) * weathering(building, hit.z, hit.y),
        finishes.matte,
        wallOcclusion(building, hit.z, hit.y),
      )
      break
    case surfaces.reveal:
      set(
        into,
        base,
        masonry(building, along, hit.y) * 1.04,
        finishes.matte,
        (1 - 0.5 * hit.depth) * (hit.normal === 2 ? 0.75 : 0.9),
      )
      break
    case surfaces.glass:
      windowGlass(into, hit, building, hit.t)
      break
    case surfaces.slabUnder:
      set(
        into,
        building.balconies === "continuous" ? [0.8, 0.8, 0.78] : base,
        0.92,
        finishes.matte,
        0.55 + 0.45 * hit.v,
      )
      break
    case surfaces.slabEdge:
      set(into, building.balconies === "continuous" ? [0.84, 0.84, 0.82] : base, 1, finishes.matte)
      break
    case surfaces.railing:
      set(
        into,
        building.balconies === "continuous" ? frostedGlass : iron,
        1,
        building.balconies === "continuous" ? finishes.frosted : finishes.metal,
      )
      break
    case surfaces.galleryFront:
      galleryFront(into, hit, building)
      break
    case surfaces.galleryUnder:
      set(into, whitePaint, 0.95, finishes.matte, 0.6 + 0.4 * hit.v)
      break
    case surfaces.corniceFront: {
      const profile = hit.v < 0.22 ? 0.72 : hit.v < 0.5 ? 0.9 : hit.v < 0.8 ? 1.06 : 0.94
      set(into, building.style === "galeria" ? whitePaint : base, profile, finishes.matte)
      break
    }
    case surfaces.corniceUnder:
      set(into, building.style === "galeria" ? whitePaint : base, 0.85, finishes.matte, 0.45 + 0.4 * hit.v)
      break
    case surfaces.gable:
      set(
        into,
        base,
        0.9 * (0.92 + 0.12 * broad(hit.x / 4, hit.y / 4)),
        finishes.matte,
        1 - 0.35 * Math.exp(-hit.u / 0.08),
      )
      break
    case surfaces.lamp:
      set(into, lanternLight, 1, finishes.lamp, 1, 0.01)
      break
    default:
      break
  }
  return into
}

export { createSample, finishes, sampleSurface }
export type { Finish, Sample }
