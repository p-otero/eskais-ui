type ModelViewerView = "front" | "side" | "back" | "three-quarter"

type Vec3 = readonly [number, number, number]

/** A sphere around what to frame, in the model's own units, like a face for a close-up. */
type ModelViewerBounds = { center: Vec3; radius: number }

type ModelViewerFraming = "full" | ModelViewerBounds

/** Where the camera sits around its target: degrees around the vertical axis and above the horizon, and a zoom. */
type ModelViewerOrbit = { yaw: number; pitch: number; zoom: number }

const modelViewerViews: readonly ModelViewerView[] = ["front", "three-quarter", "side", "back"]

// A glTF model faces +Z, so yaw 0 looks at its front; the three-quarter view turns a little and looks a little down.
const viewAngles: Record<ModelViewerView, { yaw: number; pitch: number }> = {
  front: { yaw: 0, pitch: 0 },
  "three-quarter": { yaw: 35, pitch: 8 },
  side: { yaw: 90, pitch: 0 },
  back: { yaw: 180, pitch: 0 },
}

const pitchRange = [-60, 75] as const
const zoomRange = [0.5, 3] as const
const fieldOfView = 30
// Room left around a framed model, as a share of the view.
const framingMargin = 1.1

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

const clampPitch = (pitch: number) => clampNumber(pitch, pitchRange[0], pitchRange[1])
const clampZoom = (zoom: number) => clampNumber(zoom, zoomRange[0], zoomRange[1])

/** The same angle in (-180, 180]. */
function wrapDegrees(angle: number) {
  const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

/** `to`, moved by whole turns to within half a turn of `from`, so a tween takes the short way round. */
function nearestAngle(from: number, to: number) {
  return from + wrapDegrees(to - from)
}

/**
 * Frame-rate independent easing: how far `current` gets toward `target` after `dt` seconds, at `rate` per second
 * (about 1/rate seconds to cover two thirds of the way).
 */
function damp(current: number, target: number, rate: number, dt: number) {
  return target + (current - target) * Math.exp(-rate * Math.max(0, dt))
}

const settleEpsilon = 1e-3

type WeightMap = Readonly<Record<string, number>>

/**
 * One step of morph weights toward their targets. Names missing from `target` ease back to 0. Returns the new
 * weights and whether every one has arrived, so the caller stops asking for frames.
 */
function dampWeights(current: WeightMap, target: WeightMap, rate: number, dt: number) {
  const next: Record<string, number> = {}
  let settled = true
  for (const name of new Set([...Object.keys(current), ...Object.keys(target)])) {
    const goal = clampNumber(target[name] ?? 0, 0, 1)
    const value = damp(current[name] ?? 0, goal, rate, dt)
    const arrived = Math.abs(value - goal) < settleEpsilon
    next[name] = arrived ? goal : value
    if (!arrived) settled = false
  }
  return { next, settled }
}

/** The camera's position around `target`, `distance` away, for a yaw and pitch in degrees. */
function orbitPosition(target: Vec3, yaw: number, pitch: number, distance: number): Vec3 {
  const y = (yaw * Math.PI) / 180
  const p = (pitch * Math.PI) / 180
  return [
    target[0] + distance * Math.sin(y) * Math.cos(p),
    target[1] + distance * Math.sin(p),
    target[2] + distance * Math.cos(y) * Math.cos(p),
  ]
}

const halfTan = (fov: number) => Math.tan(((fov / 2) * Math.PI) / 180)

/**
 * How far a camera with a vertical `fov` (degrees) and `aspect` (width over height) stands from a box's centre to
 * see all of its `width` × `height` face, with the margin around it, standing in front of its `depth`.
 */
function fitBoxDistance(size: Vec3, fov: number, aspect: number) {
  const [width, height, depth] = size
  const vertical = (height * framingMargin) / 2 / halfTan(fov)
  const horizontal = (width * framingMargin) / 2 / (halfTan(fov) * aspect)
  return Math.max(vertical, horizontal) + depth / 2
}

/** The distance that fits a sphere of `radius`, with the margin, in the narrower side of the view. */
function fitSphereDistance(radius: number, fov: number, aspect: number) {
  return (radius * framingMargin) / (halfTan(fov) * Math.min(1, aspect))
}

/** The world size of the view at `distance` from a camera with a vertical `fov` and `aspect`. */
function viewSizeAt(distance: number, fov: number, aspect: number) {
  const height = 2 * distance * halfTan(fov)
  return { width: height * aspect, height }
}

/** The size an image of `ratio` (width over height) takes drawn with `object-fit: contain` in a box. */
function containSize(ratio: number, box: { width: number; height: number }) {
  return box.width / box.height > ratio
    ? { width: box.height * ratio, height: box.height }
    : { width: box.width, height: box.width / ratio }
}

export {
  clampNumber,
  clampPitch,
  clampZoom,
  containSize,
  damp,
  dampWeights,
  fieldOfView,
  fitBoxDistance,
  fitSphereDistance,
  framingMargin,
  modelViewerViews,
  nearestAngle,
  orbitPosition,
  pitchRange,
  viewAngles,
  viewSizeAt,
  wrapDegrees,
  zoomRange,
}
export type { ModelViewerBounds, ModelViewerFraming, ModelViewerOrbit, ModelViewerView, Vec3, WeightMap }
