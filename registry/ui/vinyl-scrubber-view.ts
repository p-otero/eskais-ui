type Vector = { x: number; y: number; z: number }

/** One turn of a record at 33⅓ rpm, in seconds. */
const secondsPerTurn = 1.8

const cameraFovDegrees = 26
const cameraDistance = 112
const cameraElevationDegrees = 26
const cameraTarget: Vector = { x: 0, y: 16, z: 0 }
const cameraLift = 14

const deckTop = 11.65
const recordRadius = 15
const labelRadius = 5
const recordCenter: Vector = { x: -5.5, y: deckTop + 1.4, z: 2 }
const recordTop = recordCenter.y + 0.09

const armOuterGrooveRadians = -0.324
const armSweepRadians = 0.5

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

const elevation = (cameraElevationDegrees * Math.PI) / 180
const cameraPosition: Vector = {
  x: 0,
  y: cameraLift + Math.sin(elevation) * cameraDistance,
  z: Math.cos(elevation) * cameraDistance,
}
const forward = unit(add(cameraTarget, cameraPosition, -1))
const right = unit(cross(forward, { x: 0, y: 1, z: 0 }))
const up = cross(right, forward)
const halfHeight = Math.tan((cameraFovDegrees * Math.PI) / 360)

/** Where a point of the scene lands on a stage of this width-to-height ratio: 0 to 1 from the left and the top. */
function projectToStage(point: Vector, aspect: number) {
  const offset = add(point, cameraPosition, -1)
  const depth = dot(offset, forward)
  return {
    x: (dot(offset, right) / (depth * halfHeight * aspect) + 1) / 2,
    y: (1 - dot(offset, up) / (depth * halfHeight)) / 2,
  }
}

/**
 * The point of the record's face under a point of the stage (0 to 1 from the left and the top): its angle around the
 * spindle in radians, growing clockwise as seen from above, and its distance from the spindle relative to the
 * record's radius (over 1 off the record). `null` when the point looks above the horizon.
 */
function recordPointAt(stageX: number, stageY: number, aspect: number) {
  const across = (stageX * 2 - 1) * halfHeight * aspect
  const along = (1 - stageY * 2) * halfHeight
  const ray = add(add(forward, right, across), up, along)
  if (ray.y >= 0) return null
  const hit = add(cameraPosition, ray, (recordTop - cameraPosition.y) / ray.y)
  const dx = hit.x - recordCenter.x
  const dz = hit.z - recordCenter.z
  return { angle: Math.atan2(dz, dx), distance: Math.hypot(dx, dz) / recordRadius }
}

/** A point on the record's face at an angle (clockwise from above) and a distance relative to its radius. */
function pointOnRecord(angle: number, distance: number): Vector {
  return {
    x: recordCenter.x + Math.cos(angle) * distance * recordRadius,
    y: recordTop,
    z: recordCenter.z + Math.sin(angle) * distance * recordRadius,
  }
}

/** The record's turn at a time, in radians clockwise. */
const recordTurn = (seconds: number) => ((seconds / secondsPerTurn) % 1) * Math.PI * 2

/** The tonearm's swing over the record: the outer groove at progress 0, the inner one at 1. */
const armAngle = (progress: number) => armOuterGrooveRadians - Math.max(0, Math.min(1, progress)) * armSweepRadians

export {
  armAngle,
  cameraFovDegrees,
  cameraPosition,
  cameraTarget,
  deckTop,
  labelRadius,
  pointOnRecord,
  projectToStage,
  recordCenter,
  recordPointAt,
  recordRadius,
  recordTurn,
  secondsPerTurn,
}
export type { Vector }
