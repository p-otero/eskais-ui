import type { SunState, WeatherCondition } from "@/components/ui/live-sky-conditions"

/** The words of a summary, already formatted, for `labels.summary` to put in the page's order. */
type SkySummaryParts = { condition: string; temperature: string; sun: string; place: string }

type LiveSkyLabels = {
  /** Names the place search's input. */
  search: string
  searchPlaceholder: string
  searching: string
  searchFailed: string
  /** The empty list's text, given the query. */
  noPlaces: (query: string) => string
  /** The result count screen readers hear once typing pauses. */
  places: (count: number) => string
  geolocate: string
  locating: string
  /** Why the location button is off once the person blocked location access. */
  locationDenied: string
  locationFailed: string
  /** The place name for a geolocated sky. */
  here: string
  /** The place name for a sky placed by its photo's EXIF position. */
  photoPlace: string
  refresh: string
  loading: string
  failed: string
  retry: string
  /** Shown before the sky has a place. */
  noPlace: string
  /** A badge on simulated weather. */
  simulated: string
  temperature: string
  precipitation: string
  wind: string
  conditions: Record<WeatherCondition, string>
  sun: Record<SunState, string>
  /** The sentence screen readers and agents read for the sky: "Moderate rain, 12 °C, sun behind clouds". */
  summary: (parts: SkySummaryParts) => string
}

const liveSkyLabels: LiveSkyLabels = {
  search: "Search for a place",
  searchPlaceholder: "Search a city",
  searching: "Searching…",
  searchFailed: "The place search failed.",
  noPlaces: (query) => `No place matches “${query}”.`,
  places: (count) => (count === 1 ? "1 place" : `${String(count)} places`),
  geolocate: "Use my location",
  locating: "Finding you…",
  locationDenied: "Location access is blocked in this browser.",
  locationFailed: "Your location couldn't be found.",
  here: "Your location",
  photoPlace: "Where the photo was taken",
  refresh: "Refresh the weather",
  loading: "Loading the weather…",
  failed: "The weather couldn't be loaded.",
  retry: "Try again",
  noPlace: "Choose a place, or use your location, to see its sky.",
  simulated: "Simulated",
  temperature: "Temperature",
  precipitation: "Precipitation",
  wind: "Wind",
  conditions: {
    clear: "Clear sky",
    mainlyClear: "Mainly clear",
    partlyCloudy: "Partly cloudy",
    overcast: "Overcast",
    fog: "Fog",
    rimeFog: "Freezing fog",
    lightDrizzle: "Light drizzle",
    drizzle: "Drizzle",
    denseDrizzle: "Dense drizzle",
    freezingDrizzle: "Freezing drizzle",
    lightRain: "Light rain",
    rain: "Moderate rain",
    heavyRain: "Heavy rain",
    freezingRain: "Freezing rain",
    lightSnow: "Light snow",
    snow: "Moderate snow",
    heavySnow: "Heavy snow",
    snowGrains: "Snow grains",
    lightShowers: "Light showers",
    showers: "Rain showers",
    violentShowers: "Violent showers",
    snowShowers: "Snow showers",
    thunderstorm: "Thunderstorm",
    thunderstormHail: "Thunderstorm with hail",
    unknown: "Unknown weather",
  },
  sun: {
    up: "sun out",
    behindClouds: "sun behind clouds",
    low: "sun low on the horizon",
    down: "after dark",
  },
  summary: ({ condition, temperature, sun }) => `${condition}, ${temperature}, ${sun}`,
}

export { liveSkyLabels }
export type { LiveSkyLabels, SkySummaryParts }
