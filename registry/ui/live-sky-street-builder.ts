import type { StreetFacades } from "@/components/ui/live-sky-backdrop"
import { cameraFor } from "@/components/ui/live-sky-camera"
import { skylineOf } from "@/components/ui/live-sky-facade-light"
import { buildGBuffer, type GBufferBuild } from "@/components/ui/live-sky-gbuffer"
import type { SkyPalette } from "@/components/ui/live-sky-palette"
import { streetFor } from "@/components/ui/live-sky-street"
import type { SkyLocation } from "@/components/ui/live-sky-weather"

type StreetRequest = { width: number; height: number; ratio: number; location: SkyLocation; palette: SkyPalette }

const previewDownscale = 4

/**
 * Traces the street for a size and place once: a quarter-size preview at once from `request`, then the full size a
 * slice at a time from `work`. A new size or place starts over; the weather never does.
 */
function createStreetBuilder() {
  let key = ""
  let build: GBufferBuild | null = null
  let finish: ((build: GBufferBuild) => StreetFacades) | null = null

  return {
    /** Starts tracing the street for a size and place, and returns its preview; null when it's the street asked last. */
    request({ width, height, ratio, location, palette }: StreetRequest): StreetFacades | null {
      const next = [width, height, ratio, location.latitude, location.longitude].join(",")
      if (next === key) return null
      key = next
      const street = streetFor(location.latitude, location.longitude)
      const camera = cameraFor(width, height)
      const skyline = skylineOf(street)
      finish = (done) => ({ gbuffer: done.buffer, skyline, halfWidth: street.halfWidth })
      const preview = buildGBuffer(
        street,
        camera,
        palette,
        Math.ceil(width / previewDownscale),
        Math.ceil(height / previewDownscale),
      )
      preview.step(Number.POSITIVE_INFINITY)
      build = buildGBuffer(street, camera, palette, Math.round(width * ratio), Math.round(height * ratio))
      return finish(preview)
    },
    pending: () => build !== null,
    /** Forgets the street shown, so the next request traces it again, after a photo stood in for it. */
    forget() {
      key = ""
      build = null
    },
    /** Traces for up to `budgetMs` or until `interrupted`, and returns the full street once it's ready. */
    work(budgetMs: number, interrupted?: () => boolean): StreetFacades | null {
      if (!build || !finish) return null
      if (!build.step(budgetMs, interrupted)) return null
      const done = finish(build)
      build = null
      return done
    },
  }
}

export { createStreetBuilder }
