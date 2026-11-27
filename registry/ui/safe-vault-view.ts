import { openDegrees, type Pose } from "@/components/ui/safe-vault-timeline"

type Vector = { x: number; y: number; z: number }
type StagePoint = { x: number; y: number }
type Rect = { left: number; top: number; width: number; height: number }

/** Where the camera looks from: degrees around and above `target`, and its distance, in centimetres. */
type Framing = {
  azimuthDegrees: number
  elevationDegrees: number
  distance: number
  target: Vector
}

const cameraFovDegrees = 26
const halfFovTan = Math.tan((cameraFovDegrees * Math.PI) / 360)

const width = 56
const height = 78
const depth = 54
const lift = 2.2
const frame = 3.5
const openingWidth = width - frame * 2
const openingHeight = height - frame * 2
const bodyCenterY = lift + height / 2
const doorGap = 0.35
const doorWidth = openingWidth - doorGap * 2
const doorHeight = openingHeight - doorGap * 2
const doorDepth = 9
const doorFrontZ = depth + 0.15
const pivot: Vector = { x: width / 2 + 1.1, y: bodyCenterY, z: depth + 1.3 }
const doorCenter: Vector = {
  x: -pivot.x,
  y: 0,
  z: doorFrontZ - doorDepth / 2 - pivot.z,
}
const backInside = 2.5
const liningFront = depth - doorDepth - 0.6
const floorInside = bodyCenterY - openingHeight / 2
const ceilingInside = bodyCenterY + openingHeight / 2
const panelSeam = 0.35
const panelDepth = 0.5
const panelFace = backInside + 0.05 + panelDepth
const panelRows = [20, 27, 23.9] as const
const plaqueRowCenter = floorInside + 0.05 + panelRows[0] + panelRows[1] / 2
const plaqueWidth = 36
const plaqueMinHeight = 14
const plaqueMaxHeight = 24
const plaqueFace = panelFace + 0.25
const screwInset = 1.5
const dialRadius = 9.8
const dialOnDoor: Vector = { x: doorCenter.x, y: 4, z: doorFrontZ - pivot.z }
const boltCount = 5

const closedFraming: Framing = {
  azimuthDegrees: -24,
  elevationDegrees: 11,
  distance: 245,
  target: { x: 3, y: 33, z: 44 },
}
const openFraming: Framing = {
  azimuthDegrees: -15,
  elevationDegrees: 9,
  distance: 232,
  target: { x: 10, y: 32, z: 44 },
}
const closedSpan = 70
const openSpan = 82
const minPlaquePixels = 340

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixVector = (a: Vector, b: Vector, t: number): Vector => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  z: mix(a.z, b.z, t),
})
const mixFraming = (a: Framing, b: Framing, t: number): Framing => ({
  azimuthDegrees: mix(a.azimuthDegrees, b.azimuthDegrees, t),
  elevationDegrees: mix(a.elevationDegrees, b.elevationDegrees, t),
  distance: mix(a.distance, b.distance, t),
  target: mixVector(a.target, b.target, t),
})

const backedOffToFit = (framing: Framing, spanCm: number, aspect: number): Framing => ({
  ...framing,
  distance: Math.max(framing.distance, spanCm / (2 * halfFovTan * aspect)),
})

/**
 * The camera at rest on the plaque: nearly square to the back wall, close enough that the plaque is at least
 * `minPlaquePixels` wide (or 86% of a narrow stage), and on a wide stage far enough to keep a sliver of the frame.
 */
function settledFraming(aspect: number, stageWidth: number): Framing {
  const frontPlane = depth - backInside
  const frameSliverDistance = frontPlane + (openingWidth * 1.22) / (2 * halfFovTan * aspect)
  const plaqueShare = Math.min(0.86, minPlaquePixels / Math.max(1, stageWidth))
  const readableDistance = plaqueWidth / plaqueShare / (2 * halfFovTan * aspect)
  return {
    azimuthDegrees: 4,
    elevationDegrees: 2,
    distance: Math.min(frameSliverDistance, readableDistance),
    target: { x: -1, y: plaqueRowCenter, z: backInside },
  }
}

/** The camera for a pose on a stage: from the closed safe to the open door as it swings, then into the plaque. */
function framingFor(pose: Pose, aspect: number, stageWidth: number): Framing {
  const swung = mixFraming(
    backedOffToFit(closedFraming, closedSpan, aspect),
    backedOffToFit(openFraming, openSpan, aspect),
    clamp01(pose.doorDegrees / openDegrees),
  )
  return pose.zoom > 0 ? mixFraming(swung, settledFraming(aspect, stageWidth), easeInOutCubic(pose.zoom)) : swung
}

const add = (a: Vector, b: Vector, scale = 1): Vector => ({
  x: a.x + b.x * scale,
  y: a.y + b.y * scale,
  z: a.z + b.z * scale,
})
const dot = (a: Vector, b: Vector) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vector, b: Vector): Vector => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const unit = (a: Vector): Vector => {
  const length = Math.hypot(a.x, a.y, a.z) || 1
  return { x: a.x / length, y: a.y / length, z: a.z / length }
}

/** Where the camera of a framing stands, in the scene's centimetres. */
function cameraPosition({ azimuthDegrees, elevationDegrees, distance, target }: Framing): Vector {
  const azimuth = (azimuthDegrees * Math.PI) / 180
  const elevation = (elevationDegrees * Math.PI) / 180
  return {
    x: target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
    y: target.y + Math.sin(elevation) * distance,
    z: target.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
  }
}

type Projection = (point: Vector) => StagePoint & { depth: number }

/** Projects scene points onto a stage of this width-to-height ratio: 0 to 1 from the left and the top. */
function projection(framing: Framing, aspect: number): Projection {
  const position = cameraPosition(framing)
  const forward = unit(add(framing.target, position, -1))
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = cross(right, forward)
  return (point) => {
    const offset = add(point, position, -1)
    const along = dot(offset, forward)
    return {
      x: (dot(offset, right) / (along * halfFovTan * aspect) + 1) / 2,
      y: (1 - dot(offset, up) / (along * halfFovTan)) / 2,
      depth: along,
    }
  }
}

/** A point fixed to the door, in the door's own frame, where the door's swing takes it. */
function onDoor(point: Vector, doorDegrees: number): Vector {
  const angle = (doorDegrees * Math.PI) / 180
  return {
    x: pivot.x + point.x * Math.cos(angle) + point.z * Math.sin(angle),
    y: pivot.y + point.y,
    z: pivot.z - point.x * Math.sin(angle) + point.z * Math.cos(angle),
  }
}

/** The plaque's corners, clockwise from the top left, for a plaque `plaqueHeightCm` tall. */
function plaqueCorners(plaqueHeightCm: number): Vector[] {
  const top = plaqueRowCenter + plaqueHeightCm / 2
  const bottom = plaqueRowCenter - plaqueHeightCm / 2
  return [
    { x: -plaqueWidth / 2, y: top, z: plaqueFace },
    { x: plaqueWidth / 2, y: top, z: plaqueFace },
    { x: plaqueWidth / 2, y: bottom, z: plaqueFace },
    { x: -plaqueWidth / 2, y: bottom, z: plaqueFace },
  ]
}

const openingCorners: Vector[] = [
  { x: -openingWidth / 2, y: ceilingInside, z: depth },
  { x: openingWidth / 2, y: ceilingInside, z: depth },
  { x: openingWidth / 2, y: floorInside, z: depth },
  { x: -openingWidth / 2, y: floorInside, z: depth },
]

/** The door's free edge, on its front and on its back face: two lines that bound what it hides. */
function doorEdges(doorDegrees: number): [Vector, Vector][] {
  const x = doorCenter.x - doorWidth / 2
  return [doorCenter.z + doorDepth / 2, doorCenter.z - doorDepth / 2].map((z) => [
    onDoor({ x, y: doorHeight / 2, z }, doorDegrees),
    onDoor({ x, y: -doorHeight / 2, z }, doorDegrees),
  ])
}

function clipBy(polygon: StagePoint[], [a, b]: [StagePoint, StagePoint], keep: StagePoint): StagePoint[] {
  const side = (p: StagePoint) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  const keepSign = Math.sign(side(keep))
  const inside = (p: StagePoint) => side(p) * keepSign >= 0
  const result: StagePoint[] = []
  polygon.forEach((current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length] ?? current
    const crossing = () => {
      const t = side(previous) / (side(previous) - side(current))
      return {
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
      }
    }
    if (inside(current)) {
      if (!inside(previous)) result.push(crossing())
      result.push(current)
    } else if (inside(previous)) result.push(crossing())
  })
  return result
}

/** The part of the opening the camera sees past the frame and the door, in stage pixels. */
function visibleOpening(project: Projection, doorDegrees: number, stage: { width: number; height: number }) {
  const toPixels = (point: Vector) => {
    const projected = project(point)
    return {
      x: projected.x * stage.width,
      y: projected.y * stage.height,
      depth: projected.depth,
    }
  }
  const opening = openingCorners.map(toPixels)
  const corner = opening[0]
  if (!corner) return []
  let visible: StagePoint[] = opening
  for (const [top, bottom] of doorEdges(doorDegrees)) {
    const from = toPixels(top)
    const to = toPixels(bottom)
    if (from.depth > 0 && to.depth > 0) visible = clipBy(visible, [from, to], corner)
  }
  return visible
}

/** The area of a polygon in square pixels. */
function polygonArea(points: StagePoint[]) {
  let twice = 0
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length] ?? point
    twice += point.x * next.y - next.x * point.y
  })
  return Math.abs(twice) / 2
}

/**
 * The CSS `matrix3d` values that map a `width` × `height` box, from its top left corner, onto four stage points,
 * clockwise from the top left: the projective map of a plane, exact for a flat plaque.
 */
function planeMatrix(corners: StagePoint[], boxWidth: number, boxHeight: number): number[] | null {
  const [p0, p1, p2, p3] = corners
  if (!p0 || !p1 || !p2 || !p3) return null
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const denominator = dx1 * dy2 - dx2 * dy1
  if (Math.abs(denominator) < 1e-9) return null
  const g = (sx * dy2 - dx2 * sy) / denominator
  const h = (dx1 * sy - sx * dy1) / denominator
  const a = p1.x - p0.x + g * p1.x
  const b = p3.x - p0.x + h * p3.x
  const d = p1.y - p0.y + g * p1.y
  const e = p3.y - p0.y + h * p3.y
  return [
    a / boxWidth,
    d / boxWidth,
    0,
    g / boxWidth,
    b / boxHeight,
    e / boxHeight,
    0,
    h / boxHeight,
    0,
    0,
    1,
    0,
    p0.x,
    p0.y,
    0,
    1,
  ]
}

/** Where `matrix3d` values take a point of the box, as the browser draws it. */
function applyMatrix(matrix: number[], x: number, y: number): StagePoint {
  const at = (index: number) => matrix[index] ?? 0
  const w = at(3) * x + at(7) * y + at(15)
  return {
    x: (at(0) * x + at(4) * y + at(12)) / w,
    y: (at(1) * x + at(5) * y + at(13)) / w,
  }
}

/** The bounding box of the dial on the closed door, in stage pixels. */
function dialRect(project: Projection, stage: { width: number; height: number }): Rect {
  const center = onDoor(dialOnDoor, 0)
  const points = [
    { ...center, x: center.x - dialRadius },
    { ...center, x: center.x + dialRadius },
    { ...center, y: center.y - dialRadius },
    { ...center, y: center.y + dialRadius },
  ].map(project)
  const xs = points.map((point) => point.x * stage.width)
  const ys = points.map((point) => point.y * stage.height)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  }
}

/** The plaque's width in CSS pixels once the camera has settled, the width its contents lay out at. */
function plaqueLayoutWidth(stage: { width: number; height: number }) {
  const aspect = stage.width / stage.height
  const project = projection(settledFraming(aspect, stage.width), aspect)
  const [topLeft, topRight, bottomRight, bottomLeft] = plaqueCorners(plaqueMinHeight).map(project)
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return minPlaquePixels
  const across = (a: StagePoint, b: StagePoint) => Math.hypot((b.x - a.x) * stage.width, (b.y - a.y) * stage.height)
  return Math.round((across(topLeft, topRight) + across(bottomLeft, bottomRight)) / 2)
}

/** The plaque's height in centimetres for contents `contentPixels` tall at `pixelsPerCm`, within the panel. */
const plaqueHeightFor = (contentPixels: number, pixelsPerCm: number) =>
  Math.max(plaqueMinHeight, Math.min(plaqueMaxHeight, contentPixels / Math.max(0.001, pixelsPerCm)))

export {
  applyMatrix,
  backInside,
  bodyCenterY,
  boltCount,
  cameraFovDegrees,
  cameraPosition,
  ceilingInside,
  depth,
  dialOnDoor,
  dialRadius,
  dialRect,
  doorCenter,
  doorDepth,
  doorEdges,
  doorFrontZ,
  doorHeight,
  doorWidth,
  floorInside,
  framingFor,
  frame,
  height,
  lift,
  liningFront,
  onDoor,
  openingWidth,
  openingHeight,
  panelDepth,
  panelFace,
  panelRows,
  panelSeam,
  pivot,
  planeMatrix,
  plaqueCorners,
  plaqueFace,
  plaqueHeightFor,
  plaqueLayoutWidth,
  plaqueMaxHeight,
  plaqueMinHeight,
  plaqueRowCenter,
  plaqueWidth,
  polygonArea,
  projection,
  screwInset,
  settledFraming,
  visibleOpening,
  width,
}
export type { Framing, Projection, Rect, StagePoint, Vector }
