import type { Vec3 } from "@/components/ui/live-sky-camera"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { smoothstep, type SkyLight } from "@/components/ui/live-sky-light"
import { luminance, mix, scale, type Rgb, type SkyPalette } from "@/components/ui/live-sky-palette"
import type { Street } from "@/components/ui/live-sky-street"

/** The light falling on the street for one weather state, shared by the WebGL lighting pass and the canvas fallback. */
type FacadeLighting = {
  sun: Vec3
  /** The sun's colour times how much of it gets through the clouds and fog. */
  sunColour: Rgb
  /** The diffuse sky light on a wall, before occlusion. */
  skyFill: Rgb
  /** Light bounced up from the street onto undersides. */
  bounce: Rgb
  /** Street lamps' wash on the lower floors, at full strength at night. */
  street: Rgb
  /** The share of windows lit, from 0 to 1. */
  litFraction: number
  wetness: number
  /** How many runoff streaks shine on a wet wall, from 0 to 1, with the rain rate. */
  streaks: number
  haze: Rgb
  /** Haze per metre of distance. */
  hazeDensity: number
  /** How much windows and lamps glow into the air: more at night, in rain and fog. */
  bloom: number
  zenith: Rgb
  horizon: Rgb
  glow: Rgb
  glowStrength: number
}

const hazeByRain = { none: 0, drizzle: 0.004, rain: 0.003, downpour: 0.007 }
const extinctionPerVisibility = 6
const minimumVisibilityM = 60
const skylineCells = 512
const skylineStartM = -64
const skylineLengthM = 320

function facadeLightingFor(conditions: SkyConditions, light: SkyLight, palette: SkyPalette): FacadeLighting {
  const daylight = smoothstep(0.03, 0.2, light.ambient)
  const sunDegrees = (conditions.sun.altitude * 180) / Math.PI
  const clearness = (1 - conditions.cover * 0.88) * (1 - conditions.fog) * (light.sunUp ? 1 : 0)
  const warmth = 1 - smoothstep(4, 22, sunDegrees)
  const sunColour = scale(
    mix(palette.sun, mix(light.glow, palette["dawn-glow"], 0.35), warmth),
    (1.35 + warmth * 0.5) * clearness,
  )
  const tint = mix([1, 1, 1], scale(light.horizon, 1 / Math.max(0.05, luminance(light.horizon))), 0.25)
  const skyFill = scale(tint, 0.05 + 0.85 * Math.pow(light.ambient, 0.6))
  const night = 1 - daylight
  return {
    sun: light.sun,
    sunColour,
    skyFill,
    bounce: scale(mix(skyFill, palette["street-light"], night * 0.6), 0.45),
    street: scale(palette["street-light"], night * 0.55),
    litFraction: night * 0.42 + (1 - night) * smoothstep(0.85, 1, conditions.cover) * 0.05,
    wetness: conditions.wetness,
    streaks: Math.min(1, conditions.rainRate / 6),
    haze: light.haze,
    hazeDensity:
      extinctionPerVisibility / Math.max(minimumVisibilityM, conditions.visibility) +
      hazeByRain[conditions.rainKind] +
      conditions.snowRate * 0.004,
    bloom: night * (0.45 + 0.55 * Math.max(conditions.wetness, conditions.fog)) + conditions.fog * 0.1,
    zenith: light.zenith,
    horizon: light.horizon,
    glow: light.glow,
    glowStrength: light.glowStrength,
  }
}

/**
 * Each side's roofline along the street, sampled every `skylineLengthM / skylineCells` metres from `skylineStartM`,
 * as RGBA bytes: red the west side's height and green the east's, in metres ×4. The lighting pass reads it to know
 * when the row across the street hides the sun.
 */
function skylineOf(street: Street) {
  const bytes = new Uint8Array(skylineCells * 4)
  for (const building of street.buildings) {
    const from = Math.max(0, Math.floor(((building.start - skylineStartM) / skylineLengthM) * skylineCells))
    const to = Math.min(skylineCells, Math.ceil(((building.end - skylineStartM) / skylineLengthM) * skylineCells))
    const channel = building.side === -1 ? 0 : 1
    for (let cell = from; cell < to; cell++) bytes[cell * 4 + channel] = Math.min(255, Math.round(building.height * 4))
  }
  return { cells: skylineCells, startM: skylineStartM, lengthM: skylineLengthM, bytes }
}

type Skyline = ReturnType<typeof skylineOf>

export { facadeLightingFor, skylineOf }
export type { FacadeLighting, Skyline }
