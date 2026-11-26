import { projectDirection, rayThrough, type SkyCamera, type Vec3 } from "@/components/ui/live-sky-camera"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { skyColourAt, type SkyLight } from "@/components/ui/live-sky-light"
import { cssColour, type SkyPalette } from "@/components/ui/live-sky-palette"
import { seededRandom } from "@/components/ui/live-sky-street"
import { context2d, createSurface, type Surface2D } from "@/components/ui/live-sky-surface"

const skyDownscale = 6
const starCount = 520
const moonPoints = 28

type Context = Surface2D

function paintGradient(context: Context, camera: SkyCamera, light: SkyLight) {
  const width = Math.max(2, Math.ceil(camera.width / skyDownscale))
  const height = Math.max(2, Math.ceil(camera.height / skyDownscale))
  const small = createSurface(width, height)
  const smallContext = context2d(small)
  if (!smallContext) return
  const pixels = smallContext.createImageData(width, height)
  const scaleX = camera.width / width
  const scaleY = camera.height / height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colour = skyColourAt(light, rayThrough(camera, (x + 0.5) * scaleX, (y + 0.5) * scaleY))
      const offset = (y * width + x) * 4
      pixels.data[offset] = Math.min(255, colour[0] * 255)
      pixels.data[offset + 1] = Math.min(255, colour[1] * 255)
      pixels.data[offset + 2] = Math.min(255, colour[2] * 255)
      pixels.data[offset + 3] = 255
    }
  }
  smallContext.putImageData(pixels, 0, 0)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(small, 0, 0, camera.width, camera.height)
}

function paintStars(context: Context, camera: SkyCamera, light: SkyLight, palette: SkyPalette) {
  if (light.starlight < 0.02) return
  const random = seededRandom(0x57a2)
  for (let index = 0; index < starCount; index++) {
    const azimuth = random() * Math.PI * 2
    const altitude = Math.asin(random())
    const magnitude = random() ** 3
    const direction = {
      x: Math.cos(altitude) * Math.sin(azimuth),
      y: Math.sin(altitude),
      z: Math.cos(altitude) * Math.cos(azimuth),
    }
    const point = projectDirection(camera, direction)
    if (!point || point.x < 0 || point.y < 0 || point.x > camera.width || point.y > camera.height) continue
    const size = 0.6 + magnitude * 1.4
    context.fillStyle = cssColour(palette.moon, Math.min(1, (0.25 + magnitude * 0.9) * light.starlight))
    context.fillRect(point.x - size / 2, point.y - size / 2, size, size)
  }
}

function glowAt(context: Context, x: number, y: number, radius: number, colour: SkyPalette["sun"], alpha: number) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, cssColour(colour, alpha))
  gradient.addColorStop(0.25, cssColour(colour, alpha * 0.35))
  gradient.addColorStop(1, cssColour(colour, 0))
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function paintSun(
  context: Context,
  camera: SkyCamera,
  light: SkyLight,
  conditions: SkyConditions,
  palette: SkyPalette,
) {
  if (!light.sunUp) return
  const point = projectDirection(camera, light.sun)
  if (!point) return
  const clearness = (1 - conditions.cover * 0.8) * (1 - conditions.fog * 0.7)
  const reach = Math.min(camera.width, camera.height)
  glowAt(context, point.x, point.y, reach * 0.55, light.glow, 0.45 * clearness)
  glowAt(context, point.x, point.y, reach * 0.12, palette.sun, 0.9 * clearness)
  context.beginPath()
  context.arc(point.x, point.y, Math.max(3, camera.focal * 0.006), 0, Math.PI * 2)
  context.fillStyle = cssColour(palette.sun, Math.max(0.35, clearness))
  context.fill()
}

function moonOutline(context: Context, x: number, y: number, radius: number, litFraction: number, waxing: boolean) {
  const side = waxing ? 1 : -1
  const curve = 1 - 2 * litFraction
  context.beginPath()
  context.moveTo(x, y - radius)
  context.arc(x, y, radius, -Math.PI / 2, Math.PI / 2, side < 0)
  for (let step = moonPoints; step >= 0; step--) {
    const along = (step / moonPoints) * 2 - 1
    context.lineTo(x + side * curve * radius * Math.sqrt(1 - along * along), y + along * radius)
  }
  context.closePath()
}

function paintMoon(
  context: Context,
  camera: SkyCamera,
  light: SkyLight,
  conditions: SkyConditions,
  palette: SkyPalette,
) {
  if (conditions.moon.altitude < 0 || light.ambient > 0.6) return
  const point = projectDirection(camera, light.moon)
  if (!point) return
  const radius = Math.max(4, camera.focal * 0.014)
  const veil = (1 - conditions.cover * 0.6) * (1 - conditions.fog * 0.8)
  glowAt(context, point.x, point.y, radius * 9, palette.moon, 0.22 * veil * conditions.moon.fraction)
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, Math.PI * 2)
  context.fillStyle = cssColour(palette.moon, 0.08 * veil)
  context.fill()
  moonOutline(context, point.x, point.y, radius, conditions.moon.fraction, conditions.moon.waxing)
  context.fillStyle = cssColour(palette.moon, 0.95 * veil)
  context.fill()
}

/** Paints the sky behind the clouds: its gradient, the stars, the sun's glare and the moon in its phase. */
function paintSky(
  context: Context,
  camera: SkyCamera,
  light: SkyLight,
  conditions: SkyConditions,
  palette: SkyPalette,
) {
  paintGradient(context, camera, light)
  paintStars(context, camera, light, palette)
  paintMoon(context, camera, light, conditions, palette)
  paintSun(context, camera, light, conditions, palette)
}

const toward = (from: Vec3, to: Vec3): Vec3 => {
  const x = to.x - from.x
  const y = to.y - from.y
  const z = to.z - from.z
  const length = Math.hypot(x, y, z) || 1
  return { x: x / length, y: y / length, z: z / length }
}

export { paintSky, toward }
