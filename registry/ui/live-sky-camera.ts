type Vec3 = { x: number; y: number; z: number }

/** A camera standing in the street, looking north and up: x is east, y up and z north, in metres. */
type SkyCamera = {
  width: number
  height: number
  focal: number
  eye: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
}

type ScreenPoint = { x: number; y: number; depth: number }

const eyeHeightM = 1.6
const pitchRadians = (78 * Math.PI) / 180
const nearM = 0.3
const landscapeFieldOfViewRadians = (84 * Math.PI) / 180
const portraitFieldOfViewRadians = (72 * Math.PI) / 180

function cameraFor(width: number, height: number): SkyCamera {
  const portrait = height > width
  const field = portrait ? portraitFieldOfViewRadians : landscapeFieldOfViewRadians
  const focal = width / 2 / Math.tan(field / 2)
  return {
    width,
    height,
    focal,
    eye: { x: 0, y: eyeHeightM, z: 0 },
    forward: { x: 0, y: Math.sin(pitchRadians), z: Math.cos(pitchRadians) },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: Math.cos(pitchRadians), z: -Math.sin(pitchRadians) },
  }
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

function toCamera(camera: SkyCamera, point: Vec3): Vec3 {
  const offset = { x: point.x - camera.eye.x, y: point.y - camera.eye.y, z: point.z - camera.eye.z }
  return { x: dot(offset, camera.right), y: dot(offset, camera.up), z: dot(offset, camera.forward) }
}

const projectCamera = (camera: SkyCamera, local: Vec3): ScreenPoint => ({
  x: camera.width / 2 + (camera.focal * local.x) / local.z,
  y: camera.height / 2 - (camera.focal * local.y) / local.z,
  depth: local.z,
})

/** Where a direction (not a point) lands on screen, or null behind the camera. */
function projectDirection(camera: SkyCamera, direction: Vec3): ScreenPoint | null {
  const local = { x: dot(direction, camera.right), y: dot(direction, camera.up), z: dot(direction, camera.forward) }
  return local.z <= 0.01 ? null : projectCamera(camera, local)
}

/** The world direction through a pixel, normalised. */
function rayThrough(camera: SkyCamera, x: number, y: number): Vec3 {
  const sx = x - camera.width / 2
  const sy = camera.height / 2 - y
  const f = camera.focal
  const direction = {
    x: camera.forward.x * f + camera.right.x * sx + camera.up.x * sy,
    y: camera.forward.y * f + camera.right.y * sx + camera.up.y * sy,
    z: camera.forward.z * f + camera.right.z * sx + camera.up.z * sy,
  }
  const length = Math.hypot(direction.x, direction.y, direction.z)
  return { x: direction.x / length, y: direction.y / length, z: direction.z / length }
}

function clipNear(polygon: Vec3[]): Vec3[] {
  const clipped: Vec3[] = []
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index]!
    const next = polygon[(index + 1) % polygon.length]!
    const currentIn = current.z >= nearM
    if (currentIn) clipped.push(current)
    if (currentIn !== next.z >= nearM) {
      const t = (nearM - current.z) / (next.z - current.z)
      clipped.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
        z: nearM,
      })
    }
  }
  return clipped
}

/** Projects a world polygon, clipped at the near plane; empty when it's all behind the camera. */
function projectPolygon(camera: SkyCamera, polygon: Vec3[]): ScreenPoint[] {
  return clipNear(polygon.map((point) => toCamera(camera, point))).map((local) => projectCamera(camera, local))
}

function skyDirection(altitude: number, azimuth: number): Vec3 {
  return {
    x: Math.cos(altitude) * Math.sin(azimuth),
    y: Math.sin(altitude),
    z: Math.cos(altitude) * Math.cos(azimuth),
  }
}

export { cameraFor, projectDirection, projectPolygon, rayThrough, skyDirection, toCamera }
export type { ScreenPoint, SkyCamera, Vec3 }
