import type { SkyCamera, Vec3 } from "@/components/ui/live-sky-camera"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import type { SkyLight } from "@/components/ui/live-sky-light"
import { mix, scale, type Rgb, type SkyPalette } from "@/components/ui/live-sky-palette"

/** One falling layer, rain or snow, as the particle shader and the canvas fallback both draw it. */
type Fall = {
  kind: "rain" | "snow"
  count: number
  /** Velocity in camera space, m/s: x right, y up the screen, z away from the viewer. */
  velocity: Vec3
  /** A drop's or flake's diameter, in m. */
  diameter: number
  /** How long the shutter stays open, in s: the streak is the path travelled meanwhile. */
  exposure: number
  /** How long one particle lives before it's dealt a new place, in s. */
  period: number
  /** How deep the falling volume reaches from the viewer, in m. */
  depth: number
  /** A flake's sideways sway, in m. */
  sway: number
  alpha: number
  colour: Rgb
}

/** The air between the viewer and the sky: a veil of rain or fog, and sheets of rain the wind drags across it. */
type Atmosphere = { veil: number; sheets: number; colour: Rgb }

const maxParticles = 6000

const rainLooks = {
  drizzle: {
    count: (rate: number) => 2600 + rate * 3000,
    fall: 1.8,
    diameter: 0.0007,
    exposure: 1 / 160,
    period: 2.6,
    depth: 12,
    alpha: 0.55,
  },
  rain: {
    count: (rate: number) => 2000 + rate * 450,
    fall: 6.4,
    diameter: 0.0016,
    exposure: 1 / 40,
    period: 1.1,
    depth: 26,
    alpha: 0.7,
  },
  downpour: {
    count: (rate: number) => 4200 + rate * 120,
    fall: 8.8,
    diameter: 0.0028,
    exposure: 1 / 28,
    period: 0.85,
    depth: 30,
    alpha: 0.8,
  },
}

const windFollow = { rain: 0.85, snow: 1 }

function toCameraVelocity(camera: SkyCamera, world: Vec3): Vec3 {
  const dot = (axis: Vec3) => world.x * axis.x + world.y * axis.y + world.z * axis.z
  return { x: dot(camera.right), y: dot(camera.up), z: dot(camera.forward) }
}

function litColour(light: SkyLight, palette: SkyPalette, base: Rgb, conditions: SkyConditions): Rgb {
  const night = 1 - Math.min(1, light.ambient * 3)
  const daylit = scale(base, 0.3 + Math.pow(light.ambient, 0.6) * 0.95)
  return mix(daylit, mix(palette["street-light"], base, 0.45), night * (conditions.rainKind === "none" ? 0.3 : 0.55))
}

/** The falling layers to draw for some weather, scaled down by `budget` (0 to 1) on a slow renderer. */
function fallsFor(
  camera: SkyCamera,
  conditions: SkyConditions,
  light: SkyLight,
  palette: SkyPalette,
  budget: number,
): Fall[] {
  const falls: Fall[] = []
  const wind = conditions.wind
  if (conditions.rainKind !== "none") {
    const look = rainLooks[conditions.rainKind]
    const follow = windFollow.rain
    falls.push({
      kind: "rain",
      count: Math.round(Math.min(maxParticles, look.count(conditions.rainRate)) * budget),
      velocity: toCameraVelocity(camera, { x: wind.east * follow, y: -look.fall, z: wind.north * follow }),
      diameter: look.diameter,
      exposure: look.exposure,
      period: look.period,
      depth: look.depth,
      sway: 0,
      alpha: look.alpha,
      colour: litColour(light, palette, palette.rain, conditions),
    })
  }
  if (conditions.snowRate > 0) {
    falls.push({
      kind: "snow",
      count: Math.round(Math.min(maxParticles, 900 + conditions.snowRate * 1300) * budget),
      velocity: toCameraVelocity(camera, { x: wind.east * windFollow.snow * 0.6, y: -1.1, z: wind.north * 0.6 }),
      diameter: 0.006,
      exposure: 1 / 120,
      period: 6,
      depth: 24,
      sway: 0.35,
      alpha: 0.92,
      colour: litColour(light, palette, palette.snow, conditions),
    })
  }
  return falls
}

const veilByRain = { none: 0, drizzle: 0.16, rain: 0.1, downpour: 0.26 }

function atmosphereFor(conditions: SkyConditions, light: SkyLight): Atmosphere {
  return {
    veil: Math.min(0.75, veilByRain[conditions.rainKind] + conditions.fog * 0.55 + conditions.snowRate * 0.04),
    sheets: conditions.rainKind === "downpour" ? 1 : conditions.rainKind === "rain" ? 0.35 : 0,
    colour: light.haze,
  }
}

export { atmosphereFor, fallsFor, maxParticles }
export type { Atmosphere, Fall }
