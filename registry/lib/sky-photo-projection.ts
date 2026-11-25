/** How a photo looks out at the sky: where the lens pointed and how wide it saw. */
type SkyPhotoView = {
  /** The compass heading of the photo's centre, in degrees clockwise from north. */
  heading: number
  /** The horizontal field of view in degrees. */
  fov: number
  /** Where the true horizon (0° altitude) crosses the photo's centre, from 0 (top) to 1 (bottom). */
  horizon: number
  /** The photo's width over its height. */
  aspect: number
}

/** A point on the photo, from 0 to 1 across and down; outside that range it is off the frame. */
type SkyPhotoPoint = { x: number; y: number; behind: boolean }

const radians = Math.PI / 180
const degrees = 180 / Math.PI
const fullFrameDiagonal = Math.hypot(36, 24)

/** The field of view a phone without focal data most likely has: a 26 mm equivalent main camera. */
const defaultSkyPhotoFov = 69

/**
 * The horizontal field of view of a photo from its 35 mm equivalent focal length, which is defined on the diagonal,
 * so it holds for any sensor shape.
 */
function fovFromFocalLength35mm(focalLength35mm: number, aspect: number) {
  const width = (fullFrameDiagonal * aspect) / Math.hypot(aspect, 1)
  return 2 * Math.atan(width / (2 * focalLength35mm)) * degrees
}

const wrapDegrees = (value: number) => (((value % 360) + 540) % 360) - 180

function lensOf(view: SkyPhotoView) {
  const focal = 0.5 / Math.tan((view.fov * radians) / 2)
  const pitch = Math.atan((view.horizon - 0.5) / view.aspect / focal)
  return { focal, pitch }
}

/**
 * Projects a direction in the sky, `azimuth` clockwise from north and `altitude` above the horizon, onto a
 * rectilinear photo. `behind` is true when the direction is behind the camera; x and y are then meaningless.
 */
function projectSky(view: SkyPhotoView, azimuth: number, altitude: number): SkyPhotoPoint {
  const { focal, pitch } = lensOf(view)
  const relative = wrapDegrees(azimuth - view.heading) * radians
  const up = altitude * radians
  const right = Math.cos(up) * Math.sin(relative)
  const height = Math.sin(up)
  const ahead = Math.cos(up) * Math.cos(relative)
  const cameraUp = height * Math.cos(pitch) - ahead * Math.sin(pitch)
  const cameraAhead = height * Math.sin(pitch) + ahead * Math.cos(pitch)
  if (cameraAhead <= 1e-6) return { x: Number.NaN, y: Number.NaN, behind: true }
  return {
    x: 0.5 + (focal * right) / cameraAhead,
    y: 0.5 - ((focal * cameraUp) / cameraAhead) * view.aspect,
    behind: false,
  }
}

/** The sky direction a point of the photo looks at: the inverse of `projectSky`. */
function unprojectSky(view: SkyPhotoView, x: number, y: number) {
  const { focal, pitch } = lensOf(view)
  const right = x - 0.5
  const cameraUp = (0.5 - y) / view.aspect
  const cameraAhead = focal
  const height = cameraUp * Math.cos(pitch) + cameraAhead * Math.sin(pitch)
  const ahead = -cameraUp * Math.sin(pitch) + cameraAhead * Math.cos(pitch)
  const azimuth = (view.heading + Math.atan2(right, ahead) * degrees + 360) % 360
  const altitude = Math.atan2(height, Math.hypot(right, ahead)) * degrees
  return { azimuth, altitude }
}

/**
 * Turns and tilts a view so a known sky direction, the sun at the photo's capture time, lands on the point a person
 * marked: the heading and the horizon that make it so, keeping the field of view.
 */
function calibrateSkyView(
  view: Pick<SkyPhotoView, "fov" | "aspect">,
  sun: { azimuth: number; altitude: number },
  marked: { x: number; y: number },
): Pick<SkyPhotoView, "heading" | "horizon"> {
  const focal = 0.5 / Math.tan((view.fov * radians) / 2)
  const right = marked.x - 0.5
  const cameraUp = (0.5 - marked.y) / view.aspect
  const elevationAt = (pitch: number) => {
    const height = cameraUp * Math.cos(pitch) + focal * Math.sin(pitch)
    const ahead = -cameraUp * Math.sin(pitch) + focal * Math.cos(pitch)
    return Math.atan2(height, Math.hypot(right, ahead))
  }
  let low = -80 * radians
  let high = 80 * radians
  for (let step = 0; step < 48; step++) {
    const middle = (low + high) / 2
    if (elevationAt(middle) < sun.altitude * radians) low = middle
    else high = middle
  }
  const pitch = (low + high) / 2
  const horizon = 0.5 + Math.tan(pitch) * focal * view.aspect
  const ahead = -cameraUp * Math.sin(pitch) + focal * Math.cos(pitch)
  const heading = (((sun.azimuth - Math.atan2(right, ahead) * degrees) % 360) + 360) % 360
  return { heading, horizon }
}

export { calibrateSkyView, defaultSkyPhotoFov, fovFromFocalLength35mm, projectSky, unprojectSky }
export type { SkyPhotoPoint, SkyPhotoView }
