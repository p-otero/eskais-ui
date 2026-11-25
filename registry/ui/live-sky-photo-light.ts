import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { smoothstep, type SkyLight } from "@/components/ui/live-sky-light"
import { mix, scale, type Rgb, type SkyPalette } from "@/components/ui/live-sky-palette"

/** How a photo of the place is relit for the weather now, whatever light it was taken in. */
type PhotoLighting = {
  /** How bright the scene is, 1 for the light a photo is usually taken in. */
  exposure: number
  /** Overcast's flat, cool, desaturated light, from 0 to 1. */
  overcast: number
  /** A low sun's warm light, from 0 to 1, with `warmTint`. */
  warmth: number
  warmTint: Rgb
  /** Night, from 0 to 1: the scene dims and cools, street lamps wash the lower part and windows light up. */
  night: number
  nightTint: Rgb
  streetLight: Rgb
  wetness: number
  /** What wet ground reflects. */
  sheen: Rgb
  /** Haze toward the horizon, from 0 to 1. */
  haze: number
  hazeColour: Rgb
  windowLight: Rgb
  /** How much of the found windows' glow shows, from 0 by day to 1 at night. */
  windowsOn: number
  /** How much windows glow into the air, as in the street's bloom. */
  bloom: number
}

const hazeByRain = { none: 0, drizzle: 0.05, rain: 0.04, downpour: 0.1 }

function photoLightingFor(conditions: SkyConditions, light: SkyLight, palette: SkyPalette): PhotoLighting {
  const sunDegrees = (conditions.sun.altitude * 180) / Math.PI
  const daylight = smoothstep(-9, 3, sunDegrees)
  const clearness = (1 - conditions.cover * 0.88) * (1 - conditions.fog)
  const night = 1 - daylight
  const visibilityHaze = Math.min(1, 450 / Math.max(60, conditions.visibility))
  return {
    exposure: (1 - 0.22 * conditions.cover * (0.4 + conditions.gloom)) * (0.55 + 0.45 * smoothstep(-2, 12, sunDegrees)),
    overcast: Math.min(1, conditions.cover ** 2 * (0.75 + conditions.gloom * 0.4)),
    warmth: (1 - smoothstep(3, 18, sunDegrees)) * daylight * clearness,
    warmTint: [1.14, 0.94, 0.74],
    night,
    nightTint: [0.72, 0.82, 1.15],
    streetLight: palette["street-light"],
    wetness: conditions.wetness,
    sheen: scale(mix(light.horizon, light.zenith, 0.4), 0.8 + daylight * 0.4),
    haze: Math.min(0.85, visibilityHaze * 0.9 + hazeByRain[conditions.rainKind] + conditions.snowRate * 0.05),
    hazeColour: light.haze,
    windowLight: scale(palette["window-warm"], 1.15),
    windowsOn: smoothstep(0.35, 0.9, night),
    bloom: night * (0.45 + 0.55 * Math.max(conditions.wetness, conditions.fog)) + conditions.fog * 0.1,
  }
}

export { photoLightingFor }
export type { PhotoLighting }
