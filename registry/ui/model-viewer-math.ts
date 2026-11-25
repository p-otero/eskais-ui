type ModelViewerView = "front" | "side" | "back" | "three-quarter"

type Vec3 = readonly [number, number, number]

/** A sphere around what to frame, in the model's own units, like a face for a close-up. */
type ModelViewerBounds = { center: Vec3; radius: number }

type ModelViewerFraming = "full" | ModelViewerBounds

/** Where the camera sits around its target: degrees around the vertical axis and above the horizon, and a zoom. */
type ModelViewerOrbit = { yaw: number; pitch: number; zoom: number }

const modelViewerViews: readonly ModelViewerView[] = ["front", "three-quarter", "side", "back"]

// Spec: a glTF model faces +Z.
const viewAngles: Record<ModelViewerView, { yaw: number; pitch: number }> = {
  front: { yaw: 0, pitch: 0 },
  "three-quarter": { yaw: 35, pitch: 8 },
  side: { yaw: 90, pitch: 0 },
  back: { yaw: 180, pitch: 0 },
}

const pitchRange = [-60, 75] as const
const zoomRange = [0.5, 3] as const
const fieldOfView = 30
const framingMarginRatio = 1.1

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
 * Morph weights as an engine sends them: a `Float32Array` (or numbers) aligned with the target names, or a map by
 * name. Values aren't clamped to 0..1: a principal component's coefficient can be negative or past 1.
 */
type ModelViewerWeights = Float32Array | readonly number[] | WeightMap

/** Expression weights by name; a name without a dot is an ARKit name and reaches the `expr.<name>` target. */
type ModelViewerExpressions = WeightMap

const expressionPrefix = "expr."

const finite = (value: number | undefined) => (value !== undefined && Number.isFinite(value) ? value : 0)

const isAligned = (weights: ModelViewerWeights): weights is Float32Array | readonly number[] =>
  ArrayBuffer.isView(weights) || Array.isArray(weights)

const unscale = (value: number, scale: number | undefined) => (scale ? value / scale : 0)

/**
 * Writes the weights and expressions into `target`, by the index of each name in `names`, and marks in `active` the
 * targets they set, which the rig then writes every frame. A target set before and missing now goes back to 0; one
 * never set stays free for clips to animate. `scaledBy`, for weights already multiplied by each target's
 * `extras.targetScales`, divides them back first. Runs once per new weights, never per frame.
 */
function writeTargets(
  index: ReadonlyMap<string, number>,
  target: Float32Array,
  active: Uint8Array,
  weights: ModelViewerWeights | undefined,
  expressions: ModelViewerExpressions | undefined,
  scaledBy?: Float32Array,
) {
  for (let i = 0; i < target.length; i += 1) if (active[i]) target[i] = 0
  const write = (i: number, value: number | undefined) => {
    target[i] = scaledBy ? unscale(finite(value), scaledBy[i]) : finite(value)
    active[i] = 1
  }
  if (weights && isAligned(weights)) {
    const count = Math.min(weights.length, target.length)
    for (let i = 0; i < count; i += 1) write(i, weights[i])
  } else if (weights) {
    for (const [name, value] of Object.entries(weights)) {
      const i = index.get(name)
      if (i !== undefined) write(i, value)
    }
  }
  for (const [name, value] of Object.entries(expressions ?? {})) {
    const i = index.get(name.includes(".") ? name : `${expressionPrefix}${name}`)
    if (i === undefined) continue
    target[i] = finite(value)
    active[i] = 1
  }
}

/**
 * One frame of the active weights toward their targets, in place: no allocation, so it runs every frame for
 * hundreds of targets. Returns whether every one has arrived, so the caller stops asking for frames.
 */
function dampInto(current: Float32Array, target: Float32Array, active: Uint8Array, rate: number, dt: number) {
  const keep = Math.exp(-rate * Math.max(0, dt))
  let settled = true
  for (let i = 0; i < current.length; i += 1) {
    if (!active[i]) continue
    const goal = target[i] ?? 0
    const value = goal + ((current[i] ?? 0) - goal) * keep
    if (Math.abs(value - goal) < settleEpsilon) current[i] = goal
    else {
      current[i] = value
      settled = false
    }
  }
  return settled
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
  const vertical = (height * framingMarginRatio) / 2 / halfTan(fov)
  const horizontal = (width * framingMarginRatio) / 2 / (halfTan(fov) * aspect)
  return Math.max(vertical, horizontal) + depth / 2
}

/** The distance that fits a sphere of `radius`, with the margin, in the narrower side of the view. */
function fitSphereDistance(radius: number, fov: number, aspect: number) {
  return (radius * framingMarginRatio) / (halfTan(fov) * Math.min(1, aspect))
}

/** The world size of the view at `distance` from a camera with a vertical `fov` and `aspect`. */
function viewSizeAt(distance: number, fov: number, aspect: number) {
  const height = 2 * distance * halfTan(fov)
  return { width: height * aspect, height }
}

/**
 * The size an image of `ratio` (width over height) takes drawn with `object-fit` in a box: inside it with `contain`,
 * past it along one axis with `cover`.
 */
function fitSize(ratio: number, box: { width: number; height: number }, fit: "contain" | "cover" = "contain") {
  const wider = box.width / box.height > ratio
  return wider === (fit === "contain")
    ? { width: box.height * ratio, height: box.height }
    : { width: box.width, height: box.width / ratio }
}

export {
  clampNumber,
  clampPitch,
  clampZoom,
  damp,
  dampInto,
  expressionPrefix,
  fieldOfView,
  fitBoxDistance,
  fitSize,
  fitSphereDistance,
  framingMarginRatio,
  modelViewerViews,
  nearestAngle,
  orbitPosition,
  pitchRange,
  viewAngles,
  viewSizeAt,
  wrapDegrees,
  writeTargets,
  zoomRange,
}
export type {
  ModelViewerBounds,
  ModelViewerExpressions,
  ModelViewerFraming,
  ModelViewerOrbit,
  ModelViewerView,
  ModelViewerWeights,
  Vec3,
  WeightMap,
}
