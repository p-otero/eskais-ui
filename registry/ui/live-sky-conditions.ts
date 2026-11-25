import {
  daylightAt,
  moonPhase,
  moonPosition,
  radiansPerDegree,
  sunPosition,
  type Daylight,
} from "@/components/ui/live-sky-astronomy"
import type { SkyLocation, SkyWeather } from "@/components/ui/live-sky-weather"

/** What WMO weather codes mean, one key per description a person reads. */
type WeatherCondition =
  | "clear"
  | "mainlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "rimeFog"
  | "lightDrizzle"
  | "drizzle"
  | "denseDrizzle"
  | "freezingDrizzle"
  | "lightRain"
  | "rain"
  | "heavyRain"
  | "freezingRain"
  | "lightSnow"
  | "snow"
  | "heavySnow"
  | "snowGrains"
  | "lightShowers"
  | "showers"
  | "violentShowers"
  | "snowShowers"
  | "thunderstorm"
  | "thunderstormHail"
  | "unknown"

const conditionsByCode: Record<number, WeatherCondition> = {
  0: "clear",
  1: "mainlyClear",
  2: "partlyCloudy",
  3: "overcast",
  45: "fog",
  48: "rimeFog",
  51: "lightDrizzle",
  53: "drizzle",
  55: "denseDrizzle",
  56: "freezingDrizzle",
  57: "freezingDrizzle",
  61: "lightRain",
  63: "rain",
  65: "heavyRain",
  66: "freezingRain",
  67: "freezingRain",
  71: "lightSnow",
  73: "snow",
  75: "heavySnow",
  77: "snowGrains",
  80: "lightShowers",
  81: "showers",
  82: "violentShowers",
  85: "snowShowers",
  86: "snowShowers",
  95: "thunderstorm",
  96: "thunderstormHail",
  99: "thunderstormHail",
}

const conditionOf = (weatherCode: number): WeatherCondition => conditionsByCode[weatherCode] ?? "unknown"

/** How rain looks: drizzle hangs as fine mist, rain falls in streaks, a downpour in sheets. */
type RainKind = "none" | "drizzle" | "rain" | "downpour"

/** Where the sun is for the summary: up in a clear sky, behind clouds, setting or rising, or down. */
type SunState = "up" | "behindClouds" | "low" | "down"

const drizzleCodes = new Set([51, 53, 55, 56, 57])
const downpourCodes = new Set([65, 67, 82, 96, 99])
const snowCodes = new Set([71, 73, 75, 77, 85, 86])
const fogCodes = new Set([45, 48])
const thunderCodes = new Set([95, 96, 99])

const downpourMmPerHour = 7.6
const rainMmPerHour = 0.5
const traceMmPerHour = 0.05
const defaultDrizzleMmPerHour = 0.25

function rainKindOf(weather: SkyWeather, falling: number): RainKind {
  if (falling < traceMmPerHour && !drizzleCodes.has(weather.weatherCode)) return "none"
  if (drizzleCodes.has(weather.weatherCode) || falling < rainMmPerHour) return "drizzle"
  if (downpourCodes.has(weather.weatherCode) || falling >= downpourMmPerHour) return "downpour"
  return "rain"
}

/** Everything the scene draws, derived from the weather, the place and the time. */
type SkyConditions = {
  condition: WeatherCondition
  daylight: Daylight
  sun: { altitude: number; azimuth: number }
  moon: { altitude: number; azimuth: number; fraction: number; waxing: boolean }
  sunState: SunState
  /** Liquid rain in mm/h, drizzle included. */
  rainRate: number
  rainKind: RainKind
  /** Snow in cm/h. */
  snowRate: number
  /** Cloud cover from 0 to 1. */
  cover: number
  /** How dark the cloud base is, from 0 (fair-weather white) to 1 (storm grey). */
  gloom: number
  /** Fog from 0 (clear air) to 1 (under 200 m visibility). */
  fog: number
  /** How far one can see, in m. */
  visibility: number
  /** The wind in m/s toward east and north. */
  wind: { east: number; north: number }
  /** How wet the façades look, from 0 to 1. */
  wetness: number
  thunder: boolean
  temperature: number
}

const kmPerHourToMetresPerSecond = 1 / 3.6
const clearAirVisibilityM = 20_000
const thickFogVisibilityM = 200
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function fogOf(weather: SkyWeather) {
  const fromVisibility = clamp01(
    Math.log(clearAirVisibilityM / Math.max(weather.visibility, 1)) /
      Math.log(clearAirVisibilityM / thickFogVisibilityM),
  )
  return fogCodes.has(weather.weatherCode) ? Math.max(0.65, fromVisibility) : fromVisibility
}

function sunStateOf(sunAltitudeDegrees: number, cover: number, falling: boolean): SunState {
  if (sunAltitudeDegrees < -0.8) return "down"
  if (cover > 0.7 || falling) return "behindClouds"
  if (sunAltitudeDegrees < 8) return "low"
  return "up"
}

const thunderGloom = 0.3
const fallingGloom = 0.35

const gloomOf = (rainRate: number, falling: boolean, thunder: boolean) =>
  clamp01((falling ? fallingGloom : 0) + Math.min(rainRate, 12) / 16 + (thunder ? thunderGloom : 0))

const wetnessOf = (rainRate: number) => clamp01(rainRate > 0 ? 0.45 + rainRate / 6 : 0)

function skyConditions(weather: SkyWeather, location: SkyLocation, at: Date): SkyConditions {
  const sun = sunPosition(at, location.latitude, location.longitude)
  const moonAt = moonPosition(at, location.latitude, location.longitude)
  const phase = moonPhase(at)
  const sunDegrees = sun.altitude / radiansPerDegree
  const snowing = snowCodes.has(weather.weatherCode) || weather.snowfall > 0.05
  const liquid = snowing
    ? weather.rain + weather.showers
    : Math.max(weather.precipitation, weather.rain + weather.showers)
  const kind = rainKindOf(weather, liquid)
  const rainRate = kind === "drizzle" ? Math.max(liquid, defaultDrizzleMmPerHour) : liquid
  const snowRate = snowing ? Math.max(weather.snowfall, 0.2) : 0
  const falling = kind !== "none" || snowRate > 0
  const cover = clamp01(Math.max(weather.cloudCover / 100, falling ? 0.85 : 0))
  const towardRadians = (weather.windDirection + 180) * radiansPerDegree
  const windSpeed = weather.windSpeed * kmPerHourToMetresPerSecond
  return {
    condition: conditionOf(weather.weatherCode),
    daylight: daylightAt(sunDegrees),
    sun,
    moon: { ...moonAt, fraction: phase.fraction, waxing: phase.waxing },
    sunState: sunStateOf(sunDegrees, cover, falling),
    rainRate,
    rainKind: kind,
    snowRate,
    cover,
    gloom: gloomOf(rainRate, falling, thunderCodes.has(weather.weatherCode)),
    fog: fogOf(weather),
    visibility: weather.visibility,
    wind: { east: Math.sin(towardRadians) * windSpeed, north: Math.cos(towardRadians) * windSpeed },
    wetness: wetnessOf(rainRate),
    thunder: thunderCodes.has(weather.weatherCode),
    temperature: weather.temperature,
  }
}

const rainStepsPerDecade = 4

/**
 * The conditions as the static layers see them: the rain rate in steps of a quarter decade, with the gloom and wetness
 * it implies. A change of rain within a step then only moves the rain, never repaints the sky or relights the street.
 */
function steppedRain(conditions: SkyConditions): SkyConditions {
  if (conditions.rainRate <= 0) return conditions
  const step = Math.round(Math.log10(conditions.rainRate) * rainStepsPerDecade) / rainStepsPerDecade
  const rainRate = 10 ** step
  const falling = conditions.rainKind !== "none" || conditions.snowRate > 0
  return {
    ...conditions,
    rainRate,
    gloom: gloomOf(rainRate, falling, conditions.thunder),
    wetness: wetnessOf(rainRate),
  }
}

export { conditionOf, skyConditions, steppedRain }
export type { RainKind, SkyConditions, SunState, WeatherCondition }
