import { radiansPerDegree } from "@/components/ui/live-sky-astronomy"
import { skyDirection, type Vec3 } from "@/components/ui/live-sky-camera"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { add, luminance, mix, scale, type Rgb, type SkyPalette } from "@/components/ui/live-sky-palette"

/** The light of one moment: the sky's colours, where the sun and moon are, and how bright the street is. */
type SkyLight = {
  zenith: Rgb
  horizon: Rgb
  glow: Rgb
  glowStrength: number
  sun: Vec3
  sunUp: boolean
  moon: Vec3
  /** The sky's brightness at the zenith, from about 0.02 at night to 1 at noon. */
  ambient: number
  cloudLit: Rgb
  cloudShade: Rgb
  haze: Rgb
  starlight: number
}

type Keyframe = { altitude: number; zenith: Rgb; horizon: Rgb; glow: Rgb; glowStrength: number }

function keyframes(palette: SkyPalette): Keyframe[] {
  return [
    {
      altitude: -18,
      zenith: palette["night-zenith"],
      horizon: palette["night-horizon"],
      glow: palette["night-horizon"],
      glowStrength: 0,
    },
    {
      altitude: -8,
      zenith: palette["blue-zenith"],
      horizon: palette["blue-horizon"],
      glow: palette["dawn-glow"],
      glowStrength: 0.2,
    },
    {
      altitude: -1.5,
      zenith: palette["dawn-zenith"],
      horizon: palette["dawn-horizon"],
      glow: palette["dawn-glow"],
      glowStrength: 0.9,
    },
    {
      altitude: 5,
      zenith: palette["golden-zenith"],
      horizon: palette["golden-horizon"],
      glow: palette["golden-glow"],
      glowStrength: 0.85,
    },
    {
      altitude: 22,
      zenith: palette["day-zenith"],
      horizon: palette["day-horizon"],
      glow: palette["day-glow"],
      glowStrength: 0.45,
    },
  ]
}

function keyframeAt(frames: Keyframe[], altitude: number): Keyframe {
  const first = frames[0]!
  const last = frames.at(-1)!
  if (altitude <= first.altitude) return first
  if (altitude >= last.altitude) return last
  const next = frames.findIndex((frame) => frame.altitude > altitude)
  const from = frames[next - 1]!
  const to = frames[next]!
  const t = (altitude - from.altitude) / (to.altitude - from.altitude)
  return {
    altitude,
    zenith: mix(from.zenith, to.zenith, t),
    horizon: mix(from.horizon, to.horizon, t),
    glow: mix(from.glow, to.glow, t),
    glowStrength: from.glowStrength + (to.glowStrength - from.glowStrength) * t,
  }
}

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function lightFor(conditions: SkyConditions, palette: SkyPalette): SkyLight {
  const sunDegrees = conditions.sun.altitude / radiansPerDegree
  const frame = keyframeAt(keyframes(palette), sunDegrees)
  const grey = mix(palette["cloud-dark"], palette["cloud-light"], 0.55)
  const veil = Math.min(0.92, conditions.cover ** 3 * 0.85 + conditions.gloom * 0.25 + conditions.fog * 0.75)
  const daylight = smoothstep(-14, 14, sunDegrees)
  const ambient = Math.max(0.02, daylight * (1 - 0.3 * conditions.cover * (0.3 + conditions.gloom)))
  const nightCloud = mix(scale(palette["cloud-dark"], 0.18), palette["city-glow"], 0.7)
  const sunTint = mix(palette["cloud-light"], frame.glow, Math.min(1, frame.glowStrength * 0.5))
  const cloudLit = mix(nightCloud, mix(sunTint, palette["cloud-dark"], conditions.gloom * 0.6), daylight)
  const cloudShade = mix(
    scale(nightCloud, 0.6),
    mix(palette["cloud-dark"], scale(palette["cloud-dark"], 0.55), conditions.gloom),
    daylight,
  )
  const veiled = (colour: Rgb) => mix(colour, scale(grey, Math.max(0.08, ambient)), veil)
  return {
    zenith: veiled(frame.zenith),
    horizon: veiled(frame.horizon),
    glow: frame.glow,
    glowStrength: frame.glowStrength * (1 - conditions.cover * 0.6) * (1 - conditions.fog * 0.8),
    sun: skyDirection(conditions.sun.altitude, conditions.sun.azimuth),
    sunUp: sunDegrees > -0.8,
    moon: skyDirection(conditions.moon.altitude, conditions.moon.azimuth),
    ambient,
    cloudLit,
    cloudShade,
    haze: mix(palette.fog, scale(palette.fog, 0.08), 1 - Math.max(ambient, 0.15)),
    starlight: (1 - smoothstep(-16, -7, sunDegrees)) * (1 - conditions.fog),
  }
}

const angleBetween = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z)))

/** The clear sky's colour in a direction: zenith to horizon by elevation, and a glow around a low sun. */
function skyColourAt(light: SkyLight, direction: Vec3): Rgb {
  const elevation = Math.max(0, direction.y)
  const base = mix(light.horizon, light.zenith, Math.pow(elevation, 0.55))
  const toSun = angleBetween(direction, light.sun)
  const glow = light.glowStrength * (Math.exp(-toSun * 1.4) * 0.55 + Math.exp(-toSun * 6) * 0.6) * (1 - elevation * 0.4)
  return add(base, scale(light.glow, glow))
}

const brightness = (light: SkyLight) => luminance(light.zenith) + light.ambient * 0.5

export { brightness, lightFor, skyColourAt, smoothstep }
export type { SkyLight }
