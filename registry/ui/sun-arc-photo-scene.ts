import type { SunArcLocate, SunArcOut } from "@/components/ui/sun-arc-scene"
import { minutesPerDay, sunPosition, type SolarPlace } from "@/components/ui/sun-arc-solar"
import { projectSky, type SkyPhotoView } from "@/lib/sky-photo-projection"

const edge = 0.035
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const wrapDegrees = (value: number) => (((value % 360) + 540) % 360) - 180

function outOf(x: number, y: number): SunArcOut | undefined {
  if (x < 0) return "left"
  if (x > 1) return "right"
  if (y < 0) return "top"
  if (y > 1) return "bottom"
  return undefined
}

const belowHorizon = -0.83

/**
 * The photo's locator: the sun at its true azimuth and altitude through the photo's lens, held at the edge it left by;
 * below the horizon it waits on the horizon, under the place where it set or will rise.
 */
function photoLocator(view: SkyPhotoView): SunArcLocate {
  return (_minutes, sun) => {
    if (sun.altitude < belowHorizon) {
      const set = projectSky(view, sun.azimuth, 0)
      if (!set.behind) {
        return { x: clamp(set.x, edge, 1 - edge), y: clamp(set.y, edge, 1 - edge), out: outOf(set.x, 0.5) ?? "bottom" }
      }
    }
    const point = projectSky(view, sun.azimuth, sun.altitude)
    if (point.behind) {
      const left = wrapDegrees(sun.azimuth - view.heading) < 0
      const y = view.horizon - (sun.altitude / view.fov) * view.aspect
      return { x: left ? edge : 1 - edge, y: clamp(y, edge, 1 - edge), out: "behind" }
    }
    return { x: clamp(point.x, edge, 1 - edge), y: clamp(point.y, edge, 1 - edge), out: outOf(point.x, point.y) }
  }
}

/** The sun every few minutes of the day on the photo, unclamped, for the arc and for dragging the sun along it. */
type PhotoPathSample = { minutes: number; x: number; y: number; altitude: number }

const sampleMinutes = 5
const farOut = 3

function photoPathSamples(place: SolarPlace, view: SkyPhotoView): (PhotoPathSample | null)[] {
  const samples: (PhotoPathSample | null)[] = []
  for (let minutes = 0; minutes <= minutesPerDay; minutes += sampleMinutes) {
    const sun = sunPosition(place, minutes)
    const point = projectSky(view, sun.azimuth, sun.altitude)
    const usable = !point.behind && Math.abs(point.x - 0.5) < farOut && Math.abs(point.y - 0.5) < farOut
    samples.push(usable ? { minutes, x: point.x, y: point.y, altitude: sun.altitude } : null)
  }
  return samples
}

/** The arc as two SVG paths in a 1000 × 1000 box over the photo: above the horizon, and below it. */
function photoPath(samples: (PhotoPathSample | null)[]) {
  const day: string[] = []
  const night: string[] = []
  let previous: PhotoPathSample | null = null
  for (const sample of samples) {
    if (sample) {
      const target = sample.altitude >= 0 ? day : night
      const continues = previous !== null && previous.altitude >= 0 === sample.altitude >= 0
      target.push(`${continues ? "L" : "M"}${(sample.x * 1000).toFixed(1)} ${(sample.y * 1000).toFixed(1)}`)
    }
    previous = sample
  }
  return { day: day.join(""), night: night.join("") }
}

/** The time whose sun sits nearest a point of the photo, measured in pixels of a `width` × `height` photo. */
function nearestMinutes(
  samples: (PhotoPathSample | null)[],
  point: { x: number; y: number },
  size: { width: number; height: number },
) {
  let best: number | undefined
  let bestDistance = Infinity
  for (const sample of samples) {
    if (!sample) continue
    const distance = ((sample.x - point.x) * size.width) ** 2 + ((sample.y - point.y) * size.height) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = sample.minutes
    }
  }
  return best
}

export { nearestMinutes, photoLocator, photoPath, photoPathSamples }
export type { PhotoPathSample }
