const radiansPerDegree = Math.PI / 180
const msPerDay = 86_400_000
const julianDayAtUnixEpoch = 2_440_587.5
const julianDayAtJ2000 = 2_451_545
const earthObliquity = 23.4397 * radiansPerDegree

/** Where a body stands in the sky, in radians: `altitude` above the horizon, `azimuth` clockwise from north. */
type SkyPosition = { altitude: number; azimuth: number }

/** The moon's lit part: `fraction` lit from 0 to 1, `phase` from 0 (new) through 0.5 (full) back to 1. */
type MoonPhase = { fraction: number; phase: number; waxing: boolean }

type Equatorial = { rightAscension: number; declination: number }

const daysSinceJ2000 = (date: Date) => date.getTime() / msPerDay + julianDayAtUnixEpoch - julianDayAtJ2000

const rightAscensionOf = (longitude: number, latitude: number) =>
  Math.atan2(
    Math.sin(longitude) * Math.cos(earthObliquity) - Math.tan(latitude) * Math.sin(earthObliquity),
    Math.cos(longitude),
  )

const declinationOf = (longitude: number, latitude: number) =>
  Math.asin(
    Math.sin(latitude) * Math.cos(earthObliquity) + Math.cos(latitude) * Math.sin(earthObliquity) * Math.sin(longitude),
  )

const siderealTime = (days: number, westLongitude: number) =>
  radiansPerDegree * (280.16 + 360.985_623_5 * days) - westLongitude

function horizontal(body: Equatorial, days: number, latitude: number, longitude: number): SkyPosition {
  const phi = latitude * radiansPerDegree
  const hourAngle = siderealTime(days, -longitude * radiansPerDegree) - body.rightAscension
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(body.declination) + Math.cos(phi) * Math.cos(body.declination) * Math.cos(hourAngle),
  )
  const azimuthFromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(body.declination) * Math.cos(phi),
  )
  return { altitude, azimuth: (azimuthFromSouth + Math.PI) % (2 * Math.PI) }
}

const solarMeanAnomaly = (days: number) => radiansPerDegree * (357.5291 + 0.985_600_28 * days)

function sunEquatorial(days: number): Equatorial & { eclipticLongitude: number } {
  const anomaly = solarMeanAnomaly(days)
  const centre = radiansPerDegree * (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly))
  const perihelion = radiansPerDegree * 102.9372
  const eclipticLongitude = anomaly + centre + perihelion + Math.PI
  return {
    eclipticLongitude,
    rightAscension: rightAscensionOf(eclipticLongitude, 0),
    declination: declinationOf(eclipticLongitude, 0),
  }
}

function moonEquatorial(days: number): Equatorial & { distanceKm: number } {
  const meanLongitude = radiansPerDegree * (218.316 + 13.176_396 * days)
  const meanAnomaly = radiansPerDegree * (134.963 + 13.064_993 * days)
  const meanDistance = radiansPerDegree * (93.272 + 13.22935 * days)
  const longitude = meanLongitude + radiansPerDegree * 6.289 * Math.sin(meanAnomaly)
  const latitude = radiansPerDegree * 5.128 * Math.sin(meanDistance)
  return {
    rightAscension: rightAscensionOf(longitude, latitude),
    declination: declinationOf(longitude, latitude),
    distanceKm: 385_001 - 20_905 * Math.cos(meanAnomaly),
  }
}

/** The sun's altitude and azimuth at a place and time, to about a tenth of a degree. */
function sunPosition(date: Date, latitude: number, longitude: number): SkyPosition {
  const days = daysSinceJ2000(date)
  return horizontal(sunEquatorial(days), days, latitude, longitude)
}

/** The moon's altitude and azimuth at a place and time, to about a degree. */
function moonPosition(date: Date, latitude: number, longitude: number): SkyPosition {
  const days = daysSinceJ2000(date)
  return horizontal(moonEquatorial(days), days, latitude, longitude)
}

const sunDistanceKm = 149_598_000

/** How much of the moon is lit at a time, from the sun and moon's elongation. */
function moonPhase(date: Date): MoonPhase {
  const days = daysSinceJ2000(date)
  const sun = sunEquatorial(days)
  const moon = moonEquatorial(days)
  const elongation = Math.acos(
    Math.sin(sun.declination) * Math.sin(moon.declination) +
      Math.cos(sun.declination) * Math.cos(moon.declination) * Math.cos(sun.rightAscension - moon.rightAscension),
  )
  const incidence = Math.atan2(
    sunDistanceKm * Math.sin(elongation),
    moon.distanceKm - sunDistanceKm * Math.cos(elongation),
  )
  const brightLimb = Math.atan2(
    Math.cos(sun.declination) * Math.sin(sun.rightAscension - moon.rightAscension),
    Math.sin(sun.declination) * Math.cos(moon.declination) -
      Math.cos(sun.declination) * Math.sin(moon.declination) * Math.cos(sun.rightAscension - moon.rightAscension),
  )
  const waxing = brightLimb < 0
  const phase = 0.5 + (0.5 * incidence * (waxing ? -1 : 1)) / Math.PI
  return { fraction: (1 + Math.cos(incidence)) / 2, phase, waxing }
}

/** Light from the sun's altitude, in degrees: night below -12°, twilight to 0°, golden hour to 8°, day above. */
type Daylight = "night" | "twilight" | "golden" | "day"

function daylightAt(sunAltitudeDegrees: number): Daylight {
  if (sunAltitudeDegrees < -12) return "night"
  if (sunAltitudeDegrees < 0) return "twilight"
  if (sunAltitudeDegrees < 8) return "golden"
  return "day"
}

export { daylightAt, moonPhase, moonPosition, radiansPerDegree, sunPosition }
export type { Daylight, MoonPhase, SkyPosition }
