import { isRecord } from "@/lib/narrow"

/** A place on Earth in decimal degrees, with the name to show for it. */
type SkyLocation = { latitude: number; longitude: number; name?: string | undefined }

/** A geocoding result: a location with the region and country that tell same-named places apart. */
type SkyPlace = SkyLocation & { id: string; name: string; region?: string | undefined; country?: string | undefined }

/** The weather over a place now. Rates are per hour, whatever interval the source sums over. */
type SkyWeather = {
  /** When it was measured or modelled, in ms since the epoch. */
  time: number
  /** Air temperature at 2 m, in °C. */
  temperature: number
  /** Everything falling, in mm/h. */
  precipitation: number
  /** Rain from large-scale systems, in mm/h. */
  rain: number
  /** Rain from convective showers, in mm/h. */
  showers: number
  /** Snow, in cm/h. */
  snowfall: number
  /** Sky covered by cloud, in % from 0 to 100. */
  cloudCover: number
  /** The WMO weather interpretation code, 0 to 99. */
  weatherCode: number
  /** Wind at 10 m, in km/h. */
  windSpeed: number
  /** Where the wind blows from, in degrees clockwise from north. */
  windDirection: number
  /** How far one can see, in m. */
  visibility: number
  /** Whether the sun is up, as the source says. */
  isDay: boolean
  /** The precipitation of each coming hour, in mm, from the current hour on. */
  nextHours: { time: number; precipitation: number }[]
}

type FetchOptions = { signal: AbortSignal }
type WeatherFetcher = (location: SkyLocation, options: FetchOptions) => Promise<SkyWeather>
type PlaceSearcher = (query: string, options: FetchOptions) => Promise<SkyPlace[]>

/** Where the Open-Meteo requests go. The free endpoints are for non-commercial use; a paid plan has its own hosts and a key. */
type OpenMeteoOptions = {
  /** The forecast endpoint; `https://customer-api.open-meteo.com/v1/forecast` with a commercial key. */
  forecastUrl?: string
  /** The geocoding endpoint; `https://customer-geocoding-api.open-meteo.com/v1/search` with a commercial key. */
  geocodingUrl?: string
  /** Sent as `apikey` on every request. */
  apiKey?: string
  /** The language of place names, as an ISO 639-1 code. */
  language?: string
  /** How many hours of precipitation to read ahead, 1 to 48. */
  hoursAhead?: number
  fetch?: typeof fetch
}

const coordinateDecimals = 2

/** Rounds a coordinate to 2 decimals, about a kilometre, before it leaves the browser. */
const roundCoordinate = (degrees: number) => Number(degrees.toFixed(coordinateDecimals))

const roundedLocation = (location: SkyLocation): SkyLocation => ({
  ...location,
  latitude: roundCoordinate(location.latitude),
  longitude: roundCoordinate(location.longitude),
})

const isValidLocation = (location: SkyLocation) =>
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude) &&
  Math.abs(location.latitude) <= 90 &&
  Math.abs(location.longitude) <= 180

const currentFields = [
  "temperature_2m",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "cloud_cover",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "is_day",
  "visibility",
] as const

const numberAt = (record: Record<string, unknown>, key: string, fallback = 0) => {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

const numbersAt = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return Array.isArray(value) ? value.map((entry) => (typeof entry === "number" ? entry : 0)) : []
}

const msPerSecond = 1000
const secondsPerHour = 3600
const unlimitedVisibilityM = 50_000

function parseForecast(body: unknown): SkyWeather {
  if (!isRecord(body) || !isRecord(body.current)) throw new Error("Open-Meteo sent no current weather.")
  const current = body.current
  const perHour = secondsPerHour / numberAt(current, "interval", secondsPerHour)
  const hourly = isRecord(body.hourly) ? body.hourly : {}
  const hourTimes = numbersAt(hourly, "time")
  const hourAmounts = numbersAt(hourly, "precipitation")
  return {
    time: numberAt(current, "time") * msPerSecond,
    temperature: numberAt(current, "temperature_2m"),
    precipitation: numberAt(current, "precipitation") * perHour,
    rain: numberAt(current, "rain") * perHour,
    showers: numberAt(current, "showers") * perHour,
    snowfall: numberAt(current, "snowfall") * perHour,
    cloudCover: numberAt(current, "cloud_cover"),
    weatherCode: numberAt(current, "weather_code"),
    windSpeed: numberAt(current, "wind_speed_10m"),
    windDirection: numberAt(current, "wind_direction_10m"),
    visibility: numberAt(current, "visibility", unlimitedVisibilityM),
    isDay: numberAt(current, "is_day", 1) === 1,
    nextHours: hourTimes.map((time, index) => ({
      time: time * msPerSecond,
      precipitation: hourAmounts[index] ?? 0,
    })),
  }
}

const textAt = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === "string" && value !== "" ? value : undefined
}

function parsePlaces(body: unknown): SkyPlace[] {
  if (!isRecord(body) || !Array.isArray(body.results)) return []
  return body.results.filter(isRecord).flatMap((result) => {
    const name = textAt(result, "name")
    const latitude = result.latitude
    const longitude = result.longitude
    if (!name || typeof latitude !== "number" || typeof longitude !== "number") return []
    return [
      {
        id: String(result.id ?? `${name}:${String(latitude)},${String(longitude)}`),
        name,
        latitude: roundCoordinate(latitude),
        longitude: roundCoordinate(longitude),
        region: textAt(result, "admin1"),
        country: textAt(result, "country"),
      },
    ]
  })
}

async function readJson(response: Response, what: string) {
  if (!response.ok) throw new Error(`${what} answered ${String(response.status)}.`)
  const body: unknown = await response.json()
  return body
}

/** Open-Meteo's forecast and geocoding behind the two fetchers LiveSky takes. No key needed on the free tier. */
function createOpenMeteo(options: OpenMeteoOptions = {}) {
  const forecastUrl = options.forecastUrl ?? "https://api.open-meteo.com/v1/forecast"
  const geocodingUrl = options.geocodingUrl ?? "https://geocoding-api.open-meteo.com/v1/search"
  const send = (url: URL, signal: AbortSignal) => {
    if (options.apiKey) url.searchParams.set("apikey", options.apiKey)
    return (options.fetch ?? fetch)(url, { signal })
  }

  const fetchWeather: WeatherFetcher = async (location, { signal }) => {
    const { latitude, longitude } = roundedLocation(location)
    const url = new URL(forecastUrl)
    url.searchParams.set("latitude", String(latitude))
    url.searchParams.set("longitude", String(longitude))
    url.searchParams.set("current", currentFields.join(","))
    url.searchParams.set("hourly", "precipitation")
    url.searchParams.set("forecast_hours", String(options.hoursAhead ?? 6))
    url.searchParams.set("timeformat", "unixtime")
    url.searchParams.set("timezone", "GMT")
    return parseForecast(await readJson(await send(url, signal), "The forecast"))
  }

  const searchPlaces: PlaceSearcher = async (query, { signal }) => {
    const name = query.trim()
    if (name.length < 2) return []
    const url = new URL(geocodingUrl)
    url.searchParams.set("name", name)
    url.searchParams.set("count", "8")
    url.searchParams.set("format", "json")
    if (options.language) url.searchParams.set("language", options.language)
    return parsePlaces(await readJson(await send(url, signal), "The place search"))
  }

  return { fetchWeather, searchPlaces }
}

const openMeteo = createOpenMeteo()

export { createOpenMeteo, isValidLocation, openMeteo, parseForecast, parsePlaces, roundCoordinate, roundedLocation }
export type { OpenMeteoOptions, PlaceSearcher, SkyLocation, SkyPlace, SkyWeather, WeatherFetcher }
