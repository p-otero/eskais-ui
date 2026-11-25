// Spec: NOAA's general solar position equations (Spencer's series for the equation of time and the declination), with
// Bennett's refraction near the horizon. Within a minute or two of the almanac between the polar circles.

/** A place on a calendar day: degrees north and east, and the local clock's offset from UTC in minutes. */
type SolarPlace = {
  latitude: number
  longitude: number
  year: number
  month: number
  day: number
  utcOffset: number
}

/** The day's sun in local minutes since midnight; `sunrise` and `sunset` are missing in a polar day or night. */
type SolarDay = {
  kind: "day" | "polar-day" | "polar-night"
  sunrise: number | undefined
  sunset: number | undefined
  noon: number
}

const minutesPerDay = 1440
const radians = Math.PI / 180
const degrees = 180 / Math.PI
const sunriseZenith = 90.833

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
const dayOfYear = ({ year, month, day }: SolarPlace) =>
  (Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000

function solarTerms(place: SolarPlace, utcMinutes: number) {
  const year = (2 * Math.PI) / (isLeap(place.year) ? 366 : 365)
  const gamma = year * (dayOfYear(place) - 1 + (utcMinutes / 60 - 12) / 24)
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  return { equationOfTime, declination }
}

function refraction(altitude: number) {
  if (altitude < -1) return 0
  return 1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * radians) / 60
}

/** The sun's apparent position at a local minute of the day: altitude in degrees, negative below the horizon, and
 * azimuth in degrees clockwise from true north. */
function sunPosition(place: SolarPlace, minutes: number) {
  const utc = minutes - place.utcOffset
  const { equationOfTime, declination } = solarTerms(place, utc)
  const trueSolarTime = utc + equationOfTime + 4 * place.longitude
  const hourAngle = (trueSolarTime / 4 - 180) * radians
  const latitude = place.latitude * radians
  const cosZenith =
    Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
  const altitude = 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) * degrees
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude),
    ) *
      degrees +
      540) %
    360
  return { altitude: altitude + refraction(altitude), azimuth }
}

/** The sun's apparent altitude in degrees at a local minute of the day: negative below the horizon. */
const sunAltitude = (place: SolarPlace, minutes: number) => sunPosition(place, minutes).altitude

const local = (place: SolarPlace, utcMinutes: number) =>
  (((utcMinutes + place.utcOffset) % minutesPerDay) + minutesPerDay) % minutesPerDay

function solarNoonUtc(place: SolarPlace) {
  let noon = 720 - 4 * place.longitude
  for (let pass = 0; pass < 2; pass++) noon = 720 - 4 * place.longitude - solarTerms(place, noon).equationOfTime
  return noon
}

function crossingUtc(place: SolarPlace, side: -1 | 1, from: number) {
  let at = from
  for (let pass = 0; pass < 3; pass++) {
    const { equationOfTime, declination } = solarTerms(place, at)
    const latitude = place.latitude * radians
    const cosHourAngle =
      (Math.cos(sunriseZenith * radians) - Math.sin(latitude) * Math.sin(declination)) /
      (Math.cos(latitude) * Math.cos(declination))
    if (cosHourAngle > 1) return "polar-night" as const
    if (cosHourAngle < -1) return "polar-day" as const
    const hourAngle = Math.acos(cosHourAngle) * degrees
    at = 720 - 4 * (place.longitude - side * hourAngle) - equationOfTime
  }
  return at
}

/** Sunrise, solar noon and sunset for the place's day, in local minutes since midnight. */
function solarDay(place: SolarPlace): SolarDay {
  const noonUtc = solarNoonUtc(place)
  const noon = local(place, noonUtc)
  const rise = crossingUtc(place, -1, noonUtc - 360)
  const set = crossingUtc(place, 1, noonUtc + 360)
  if (typeof rise === "string" || typeof set === "string") {
    const kind = rise === "polar-day" || set === "polar-day" ? "polar-day" : "polar-night"
    return { kind, sunrise: undefined, sunset: undefined, noon }
  }
  return { kind: "day", sunrise: local(place, rise), sunset: local(place, set), noon }
}

const offsetPattern = /GMT(?:([+-])(\d{1,2})(?::?(\d{2}))?)?/

/** The calendar day and UTC offset of `date` in an IANA time zone, or in the runtime's own zone without one. */
function calendarIn(date: Date, timeZone: string | undefined) {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      utcOffset: -date.getTimezoneOffset(),
    }
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZoneName: "longOffset",
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ""
  const [, sign, hours = "0", minutes = "0"] = offsetPattern.exec(part("timeZoneName")) ?? []
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    utcOffset: (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes)),
  }
}

type Rgb = readonly [number, number, number]

/** The sky at one solar altitude: gradient stops, the sun's own colour, its glow and how dark the night is (0 to 1). */
type Sky = { zenith: string; horizon: string; sun: string; glow: string; dusk: number; night: number; daylight: number }

const skyStops: { altitude: number; zenith: Rgb; horizon: Rgb; sun: Rgb; glow: Rgb }[] = [
  { altitude: -18, zenith: [4, 6, 16], horizon: [10, 14, 32], sun: [70, 78, 110], glow: [40, 50, 90] },
  { altitude: -8, zenith: [10, 16, 44], horizon: [44, 46, 96], sun: [120, 110, 150], glow: [90, 70, 130] },
  { altitude: -2, zenith: [26, 38, 88], horizon: [214, 112, 84], sun: [255, 120, 70], glow: [255, 110, 60] },
  { altitude: 3, zenith: [48, 86, 150], horizon: [248, 164, 96], sun: [255, 170, 90], glow: [255, 150, 70] },
  { altitude: 12, zenith: [52, 116, 200], horizon: [176, 208, 234], sun: [255, 236, 190], glow: [255, 214, 150] },
  { altitude: 40, zenith: [36, 104, 206], horizon: [150, 198, 240], sun: [255, 252, 236], glow: [255, 244, 214] },
]

const mix = (from: Rgb, to: Rgb, t: number): Rgb => [
  from[0] + (to[0] - from[0]) * t,
  from[1] + (to[1] - from[1]) * t,
  from[2] + (to[2] - from[2]) * t,
]
const hex = (colour: Rgb) => `#${colour.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function skyAt(altitude: number): Sky {
  const first = skyStops[0]!
  const last = skyStops.at(-1)!
  let below = first
  let above = last
  for (let index = 0; index < skyStops.length - 1; index++) {
    const stop = skyStops[index]!
    const next = skyStops[index + 1]!
    if (altitude >= stop.altitude && altitude <= next.altitude) {
      below = stop
      above = next
    }
  }
  const span = above.altitude - below.altitude
  const t =
    altitude <= first.altitude ? 0 : altitude >= last.altitude ? 1 : span === 0 ? 0 : (altitude - below.altitude) / span
  const lowSun = 1 - Math.abs(altitude - 1) / 9
  return {
    zenith: hex(mix(below.zenith, above.zenith, t)),
    horizon: hex(mix(below.horizon, above.horizon, t)),
    sun: hex(mix(below.sun, above.sun, t)),
    glow: hex(mix(below.glow, above.glow, t)),
    dusk: clamp01(lowSun),
    night: clamp01((-altitude - 2) / 10),
    daylight: clamp01((altitude + 4) / 16),
  }
}

export { calendarIn, minutesPerDay, skyAt, solarDay, sunAltitude, sunPosition }
export type { Sky, SolarDay, SolarPlace }
