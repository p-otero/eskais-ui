import { rayThrough, type SkyCamera } from "@/components/ui/live-sky-camera"
import { createSample, sampleSurface } from "@/components/ui/live-sky-materials"
import type { SkyPalette } from "@/components/ui/live-sky-palette"
import type { Street } from "@/components/ui/live-sky-street"
import { createHit, indexStreet, traceRay } from "@/components/ui/live-sky-trace"

/**
 * The street's geometry and materials per pixel, independent of the weather, as three RGBA byte planes:
 * `albedo` (colour, and coverage in alpha), `surface` (normal code ×50, occlusion, finish ×40, glow rank) and
 * `place` (the distance north as 16 bits over `placeStartM` to `placeStartM + placeLengthM`, distance ÷2 in m, height ×4 in m).
 */
type GBuffer = { width: number; height: number; albedo: Uint8Array; surface: Uint8Array; place: Uint8Array }

/** A G-buffer filled a few rows at a time, so a large one never holds a frame. */
type GBufferBuild = {
  buffer: GBuffer
  done: () => boolean
  /** Traces rows until `budgetMs` runs out or `interrupted` says to stop; true once every row is traced. */
  step: (budgetMs: number, interrupted?: () => boolean) => boolean
}

const byte = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)))
const placeStartM = -64
const placeLengthM = 320
const northOf = (z: number) => Math.max(0, Math.min(65_535, Math.round(((z - placeStartM) / placeLengthM) * 65_535)))

/** Starts tracing the street for a camera at a resolution; `step` fills rows until its budget runs out. */
function buildGBuffer(
  street: Street,
  camera: SkyCamera,
  palette: SkyPalette,
  width: number,
  height: number,
): GBufferBuild {
  const pixels = width * height
  const buffer: GBuffer = {
    width,
    height,
    albedo: new Uint8Array(pixels * 4),
    surface: new Uint8Array(pixels * 4),
    place: new Uint8Array(pixels * 4),
  }
  const index = indexStreet(street)
  const hit = createHit()
  const sample = createSample()
  const scaleX = camera.width / width
  const scaleY = camera.height / height
  let row = 0

  const traceRow = (y: number) => {
    for (let x = 0; x < width; x++) {
      const ray = rayThrough(camera, (x + 0.5) * scaleX, (y + 0.5) * scaleY)
      traceRay(index, camera.eye, ray.x, ray.y, ray.z, hit)
      if (!hit.building) continue
      sampleSurface(hit, palette, sample)
      const at = (y * width + x) * 4
      buffer.albedo[at] = byte(sample.r)
      buffer.albedo[at + 1] = byte(sample.g)
      buffer.albedo[at + 2] = byte(sample.b)
      buffer.albedo[at + 3] = 255
      buffer.surface[at] = hit.normal * 50
      buffer.surface[at + 1] = byte(sample.occlusion)
      buffer.surface[at + 2] = sample.finish * 40
      buffer.surface[at + 3] = sample.rank > 0 ? Math.max(1, byte(sample.rank)) : 0
      const north = northOf(hit.z)
      buffer.place[at] = north >> 8
      buffer.place[at + 1] = north & 255
      buffer.place[at + 2] = Math.min(255, Math.round(hit.t / 2))
      buffer.place[at + 3] = Math.min(255, Math.round(hit.y * 4))
    }
  }

  return {
    buffer,
    done: () => row >= height,
    step(budgetMs, interrupted) {
      const until = performance.now() + budgetMs
      while (row < height) {
        traceRow(row)
        row += 1
        if (performance.now() >= until || interrupted?.()) break
      }
      return row >= height
    },
  }
}

export { buildGBuffer, placeLengthM, placeStartM }
export type { GBuffer, GBufferBuild }
