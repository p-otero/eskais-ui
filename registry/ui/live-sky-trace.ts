import type { Building, Street } from "@/components/ui/live-sky-street"

/** What a ray met, as a small number so a million rays allocate nothing. */
const surfaces = {
  wall: 1,
  reveal: 2,
  glass: 3,
  slabUnder: 4,
  slabEdge: 5,
  railing: 6,
  galleryFront: 7,
  galleryUnder: 8,
  corniceFront: 9,
  corniceUnder: 10,
  gable: 11,
  lamp: 12,
} as const

type SurfaceCode = (typeof surfaces)[keyof typeof surfaces]

/** Which way a surface faces: the street, up, down, north (+z) or south (-z). */
const normals = { street: 0, up: 1, down: 2, north: 3, south: 4 } as const

type NormalCode = (typeof normals)[keyof typeof normals]

/** The nearest hit of one ray, rewritten in place for every pixel. */
type Hit = {
  t: number
  surface: SurfaceCode | 0
  normal: NormalCode
  building: Building | null
  x: number
  y: number
  z: number
  floor: number
  bay: number
  /** Across and up the element hit (a window, a gallery front, a block), from 0 to 1. */
  u: number
  v: number
  /** How far into a window's recess a reveal hit lies, from 0 at the wall to 1 at the glass. */
  depth: number
}

const createHit = (): Hit => ({
  t: 0,
  surface: 0,
  normal: 0,
  building: null,
  x: 0,
  y: 0,
  z: 0,
  floor: 0,
  bay: 0,
  u: 0,
  v: 0,
  depth: 0,
})

const nearM = 0.3
const blockDepthM = 14
const balconyFloorsAbove = 3
const galleryDepthM = 0.85
const balconyDepth = { windows: 0.62, continuous: 1.35 }
const slabThickness = { windows: 0.14, continuous: 0.22 }
const railingHeightM = 0.95
const railingBarEveryM = 0.13
const railingBarM = 0.028
const lampHeightM = 4.1

let eyeX = 0
let eyeY = 0
let eyeZ = 0
let rayX = 0
let rayY = 0
let rayZ = 0
let best: Hit = createHit()

function consider(
  t: number,
  surface: SurfaceCode,
  normal: NormalCode,
  building: Building,
  floor: number,
  bay: number,
  u: number,
  v: number,
  depth = 0,
) {
  if (t <= nearM || t >= best.t) return
  best.t = t
  best.surface = surface
  best.normal = normal
  best.building = building
  best.x = eyeX + rayX * t
  best.y = eyeY + rayY * t
  best.z = eyeZ + rayZ * t
  best.floor = floor
  best.bay = bay
  best.u = u
  best.v = v
  best.depth = depth
}

const floorsOf = (building: Building) => Math.max(1, Math.floor((building.height - 1) / building.floorHeight))
const baysOf = (building: Building) => Math.max(1, Math.floor((building.end - building.start) / building.bayWidth))
const wallOf = (street: Street, building: Building) => building.side * (street.halfWidth + building.setback)

function bayAt(building: Building, z: number) {
  const bays = baysOf(building)
  const width = (building.end - building.start) / bays
  const bay = Math.min(bays - 1, Math.max(0, Math.floor((z - building.start) / width)))
  return { bay, centre: building.start + width * (bay + 0.5), width }
}

function windowRect(building: Building, floor: number, centre: number, bayWidth: number) {
  if (floor === 0) return { z0: centre - bayWidth * 0.4, z1: centre + bayWidth * 0.4, y0: 0.4, y1: 3 }
  const { width, height, sill } = building.window
  const doorway = hasWindowBalcony(building, floor)
  const bottom = floor * building.floorHeight + (doorway ? 0.12 : sill)
  return {
    z0: centre - width / 2,
    z1: centre + width / 2,
    y0: bottom,
    y1: floor * building.floorHeight + sill + height,
  }
}

const hasWindowBalcony = (building: Building, floor: number) =>
  building.balconies === "windows" && floor >= 1 && floor <= Math.min(floorsOf(building) - 1, balconyFloorsAbove)

const hasGallery = (building: Building, floor: number) =>
  building.style === "galeria" && floor >= 1 && floor < floorsOf(building)

function traceWindow(street: Street, building: Building, tWall: number, wallY: number, wallZ: number) {
  const floor = Math.floor(wallY / building.floorHeight)
  const { bay, centre, width } = bayAt(building, wallZ)
  const rect = windowRect(building, floor, centre, width)
  if (wallZ < rect.z0 || wallZ > rect.z1 || wallY < rect.y0 || wallY > rect.y1) return false
  const recess = floor === 0 ? 0.15 : building.window.recess
  const tGlass = (wallOf(street, building) + building.side * recess - eyeX) / rayX
  const glassY = eyeY + rayY * tGlass
  const glassZ = eyeZ + rayZ * tGlass
  if (glassY <= rect.y1 && glassZ >= rect.z0 && glassZ <= rect.z1) {
    consider(
      tGlass,
      surfaces.glass,
      normals.street,
      building,
      floor,
      bay,
      (glassZ - rect.z0) / (rect.z1 - rect.z0),
      (glassY - rect.y0) / (rect.y1 - rect.y0),
    )
    return true
  }
  const crossings: [number, NormalCode, number][] = []
  if (glassY > rect.y1) crossings.push([(rect.y1 - eyeY) / rayY, normals.down, 0])
  if (glassZ < rect.z0) crossings.push([(rect.z0 - eyeZ) / rayZ, normals.north, 1])
  if (glassZ > rect.z1) crossings.push([(rect.z1 - eyeZ) / rayZ, normals.south, 2])
  let first: [number, NormalCode, number] | null = null
  for (const crossing of crossings) if (crossing[0] >= tWall && (!first || crossing[0] < first[0])) first = crossing
  if (!first) return false
  const depth = Math.min(1, Math.max(0, (first[0] - tWall) / Math.max(1e-6, tGlass - tWall)))
  consider(first[0], surfaces.reveal, first[1], building, floor, bay, first[2], 0, depth)
  return true
}

let entryT = 0
let entryAxis = 0
let leaveT = 0

function slab(low: number, high: number, origin: number, direction: number, axis: number) {
  if (Math.abs(direction) < 1e-9) return origin >= low && origin <= high
  const near = (low - origin) / direction
  const far = (high - origin) / direction
  const entry = near < far ? near : far
  const exit = near < far ? far : near
  if (entry > entryT) {
    entryT = entry
    entryAxis = axis
  }
  if (exit < leaveT) leaveT = exit
  return entryT <= leaveT
}

function boxEntry(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  entryT = -Infinity
  leaveT = Infinity
  entryAxis = 0
  return slab(x0, x1, eyeX, rayX, 0) && slab(y0, y1, eyeY, rayY, 1) && slab(z0, z1, eyeZ, rayZ, 2) && entryT > nearM
}

function zNormal(): NormalCode {
  return rayZ > 0 ? normals.south : normals.north
}

function traceBox(
  building: Building,
  wall: number,
  depth: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  faces: { front: SurfaceCode; under: SurfaceCode; side: SurfaceCode },
  floor: number,
  bay: number,
) {
  const front = wall - building.side * depth
  if (!boxEntry(Math.min(front, wall), Math.max(front, wall), y0, y1, z0, z1) || entryT >= best.t) return
  const entry = { t: entryT, axis: entryAxis }
  const y = eyeY + rayY * entry.t
  const z = eyeZ + rayZ * entry.t
  if (entry.axis === 0)
    consider(entry.t, faces.front, normals.street, building, floor, bay, (z - z0) / (z1 - z0), (y - y0) / (y1 - y0))
  else if (entry.axis === 1)
    consider(
      entry.t,
      faces.under,
      normals.down,
      building,
      floor,
      bay,
      (z - z0) / (z1 - z0),
      Math.abs((eyeX + rayX * entry.t - wall) / depth),
    )
  else consider(entry.t, faces.side, zNormal(), building, floor, bay, 0, (y - y0) / (y1 - y0))
}

function traceRailing(
  building: Building,
  front: number,
  top: number,
  z0: number,
  z1: number,
  floor: number,
  bay: number,
) {
  const t = (front - eyeX) / rayX
  const y = eyeY + rayY * t
  const z = eyeZ + rayZ * t
  if (y < top || y > top + railingHeightM || z < z0 || z > z1) return
  const rail = y > top + railingHeightM - 0.05 || y < top + 0.06
  const glazed = building.balconies === "continuous"
  const bar = (z - z0) % railingBarEveryM < railingBarM
  if (glazed || rail || bar)
    consider(
      t,
      surfaces.railing,
      normals.street,
      building,
      floor,
      bay,
      (z - z0) / (z1 - z0),
      (y - top) / railingHeightM,
    )
}

const galleryFaces = {
  front: surfaces.galleryFront,
  under: surfaces.galleryUnder,
  side: surfaces.galleryUnder,
} as const
const slabFaces = { front: surfaces.slabEdge, under: surfaces.slabUnder, side: surfaces.slabEdge } as const
const corniceFaces = {
  front: surfaces.corniceFront,
  under: surfaces.corniceUnder,
  side: surfaces.corniceUnder,
} as const
const lampFaces = { front: surfaces.lamp, under: surfaces.lamp, side: surfaces.lamp } as const

function traceProjections(street: Street, building: Building, firstFloor: number, lastFloor: number) {
  const wall = wallOf(street, building)
  const { start, end, floorHeight } = building
  for (let floor = Math.max(1, firstFloor); floor <= lastFloor; floor++) {
    const base = floor * floorHeight
    if (hasGallery(building, floor)) {
      traceBox(
        building,
        wall,
        galleryDepthM,
        base + 0.05,
        base + floorHeight - 0.02,
        start + 0.25,
        end - 0.25,
        galleryFaces,
        floor,
        0,
      )
      continue
    }
    const slabs = building.balconies === "continuous" ? floor < floorsOf(building) : hasWindowBalcony(building, floor)
    if (!slabs || building.balconies === "none") continue
    const kind = building.balconies
    const depth = balconyDepth[kind]
    const top = base + 0.12
    if (kind === "continuous") {
      traceBox(building, wall, depth, top - slabThickness[kind], top, start + 0.3, end - 0.3, slabFaces, floor, 0)
      traceRailing(building, wall - building.side * depth, top, start + 0.3, end - 0.3, floor, 0)
      continue
    }
    const bays = baysOf(building)
    const bayWidth = (end - start) / bays
    const bay = Math.min(bays - 1, Math.max(0, Math.floor((eyeZ + rayZ * ((wall - eyeX) / rayX) - start) / bayWidth)))
    for (let near = Math.max(0, bay - 1); near <= Math.min(bays - 1, bay + 1); near++) {
      const centre = start + bayWidth * (near + 0.5)
      const z0 = centre - building.window.width / 2 - 0.35
      const z1 = centre + building.window.width / 2 + 0.35
      traceBox(building, wall, depth, top - slabThickness[kind], top, z0, z1, slabFaces, floor, near)
      traceRailing(building, wall - building.side * depth, top, z0, z1, floor, near)
    }
  }
}

function traceBuilding(street: Street, building: Building) {
  const wall = wallOf(street, building)
  const tWall = (wall - eyeX) / rayX
  const wallY = eyeY + rayY * tWall
  const wallZ = eyeZ + rayZ * tWall
  const reach = Math.max(galleryDepthM, balconyDepth.continuous, building.cornice) + 0.1
  const tOuter = (wall - building.side * reach - eyeX) / rayX
  const lowY = Math.min(eyeY + rayY * tOuter, wallY)
  const highY = Math.max(eyeY + rayY * tOuter, wallY)
  const floors = floorsOf(building)
  traceProjections(
    street,
    building,
    Math.floor(lowY / building.floorHeight) - 1,
    Math.min(floors, Math.floor(highY / building.floorHeight) + 1),
  )
  traceBox(
    building,
    wall,
    building.cornice,
    building.height - 0.6,
    building.height - 0.05,
    building.start,
    building.end,
    corniceFaces,
    floors,
    0,
  )
  if (building.lamp !== null) {
    traceBox(
      building,
      wall - building.side * 0.15,
      0.32,
      lampHeightM,
      lampHeightM + 0.38,
      building.lamp - 0.13,
      building.lamp + 0.13,
      lampFaces,
      1,
      0,
    )
  }
  if (wallZ >= building.start && wallZ <= building.end && wallY >= 0 && wallY <= building.height) {
    if (!traceWindow(street, building, tWall, wallY, wallZ)) {
      const floor = Math.floor(wallY / building.floorHeight)
      consider(tWall, surfaces.wall, normals.street, building, floor, bayAt(building, wallZ).bay, 0, 0)
    }
  }
  for (const [edge, lower, normal] of [
    [building.start, building.neighbours[0], normals.south],
    [building.end, building.neighbours[1], normals.north],
  ] as const) {
    if (lower >= building.height - 0.3 || Math.abs(rayZ) < 1e-6) continue
    const t = (edge - eyeZ) / rayZ
    const x = (eyeX + rayX * t) * building.side
    const y = eyeY + rayY * t
    const inner = street.halfWidth + building.setback
    if (x >= inner && x <= inner + blockDepthM && y >= lower && y <= building.height)
      consider(t, surfaces.gable, normal, building, 0, 0, (x - inner) / blockDepthM, y / building.height)
  }
}

type StreetIndex = { street: Street; rows: Record<-1 | 1, Building[]> }

/** Sorts each side's buildings by where they start, for the tracer to look up the few a ray can reach. */
function indexStreet(street: Street): StreetIndex {
  const row = (side: -1 | 1) =>
    street.buildings.filter((building) => building.side === side).toSorted((a, b) => a.start - b.start)
  return { street, rows: { [-1]: row(-1), 1: row(1) } }
}

/** Finds the nearest surface along a ray from the eye, writing it into `into`; `into.surface` stays 0 for open sky. */
function traceRay(
  index: StreetIndex,
  eye: { x: number; y: number; z: number },
  x: number,
  y: number,
  z: number,
  into: Hit,
) {
  best = into
  best.t = Infinity
  best.surface = 0
  best.building = null
  if (Math.abs(x) < 1e-5) return into
  eyeX = eye.x
  eyeY = eye.y
  eyeZ = eye.z
  rayX = x
  rayY = y
  rayZ = z
  const side: -1 | 1 = x < 0 ? -1 : 1
  const { street } = index
  const tNear = (street.halfWidth - 1.6) / Math.abs(x)
  const tFar = (street.halfWidth + 2 + blockDepthM) / Math.abs(x)
  const zA = eye.z + z * tNear
  const zB = eye.z + z * tFar
  const low = Math.min(zA, zB) - 0.5
  const high = Math.max(zA, zB) + 0.5
  for (const building of index.rows[side]) {
    if (building.start > high) break
    if (building.end >= low) traceBuilding(street, building)
  }
  return into
}

export { createHit, floorsOf, indexStreet, normals, surfaces, traceRay, windowRect, bayAt, hasGallery }
export type { Hit, NormalCode, StreetIndex, SurfaceCode }
