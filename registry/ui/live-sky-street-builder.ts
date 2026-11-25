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
 * Traces the street for a size and place once: a quarter-size preview at once, then the full size a slice at a time
 * through `work`, handing each to `onReady`. A new size or place starts over; the weather never does.
 */
function createStreetBuilder(onReady: (facades: StreetFacades) => void) {
  let key = ""
  let build: GBufferBuild | null = null
  let finish: ((build: GBufferBuild) => StreetFacades) | null = null

  return {
    request({ width, height, ratio, location, palette }: StreetRequest) {
      const next = [width, height, ratio, location.latitude, location.longitude].join(",")
      if (next === key) return
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
      onReady(finish(preview))
      build = buildGBuffer(street, camera, palette, Math.round(width * ratio), Math.round(height * ratio))
    },
    pending: () => build !== null,
    /** Traces for up to `budgetMs`; true once the full street is ready. */
    work(budgetMs: number) {
      if (!build || !finish) return true
      if (!build.step(budgetMs)) return false
      onReady(finish(build))
      build = null
      return true
    },
  }
}

export { createStreetBuilder }
