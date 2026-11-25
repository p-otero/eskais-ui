import { rayThrough, type SkyCamera, type Vec3 } from "@/components/ui/live-sky-camera"
import type { SkyConditions } from "@/components/ui/live-sky-conditions"
import { smoothstep, type SkyLight } from "@/components/ui/live-sky-light"
import { noiseTile, sampleTile } from "@/components/ui/live-sky-noise"
import { mix, scale, type Rgb } from "@/components/ui/live-sky-palette"

/** The cloud deck the shader and the canvas fallback both cut from the noise tile. */
type CloudDeck = {
  /** The deck's height above the viewer, in m. */
  base: number
  /** How many metres of sky one noise tile spans. */
  tile: number
  threshold: number
  softness: number
  /** How much thick cloud darkens toward `shade`, from 0 to 1. */
  shadeBias: number
  lit: Rgb
  shade: Rgb
  horizon: Rgb
  sunGlow: Rgb
  sun: Vec3
  /** The deck's drift, in tiles per second toward east (x) and north (y). */
  drift: { x: number; y: number }
}

const tileM = 5200
const minimumDriftMetresPerSecond = 1.5
const windAloftFactor = 2.2
const aloft = (speed: number) => speed * windAloftFactor

function cloudDeckFor(conditions: SkyConditions, light: SkyLight): CloudDeck {
  const speed = Math.hypot(conditions.wind.east, conditions.wind.north)
  const east = speed > 0.1 ? aloft(conditions.wind.east) : minimumDriftMetresPerSecond
  const north = speed > 0.1 ? aloft(conditions.wind.north) : 0
  const falling = conditions.rainKind !== "none" || conditions.snowRate > 0
  return {
    base: falling ? 900 : 1600,
    tile: tileM,
    threshold: 0.8 - conditions.cover * 0.66,
    softness: 0.12 + conditions.gloom * 0.12 + (falling ? 0.12 : 0),
    shadeBias: 0.45 + conditions.gloom * 0.5,
    lit: light.cloudLit,
    shade: light.cloudShade,
    horizon: mix(light.horizon, light.cloudShade, 0.4),
    sunGlow: light.sunUp ? scale(light.glow, 0.9 * (1 - conditions.gloom)) : [0, 0, 0],
    sun: light.sun,
    drift: { x: east / tileM, y: north / tileM },
  }
}

type CloudSample = { colour: Rgb; cover: number }

/** The cloud seen in a direction at an offset, mirrored by the WebGL shader. */
function cloudAt(deck: CloudDeck, direction: Vec3, offset: { x: number; y: number }): CloudSample | null {
  if (direction.y <= 0.02) return null
  const reach = deck.base / direction.y / deck.tile
  const u = direction.x * reach + offset.x
  const v = direction.z * reach + offset.y
  const tile = noiseTile()
  const n =
    sampleTile(tile.billow, u, v) * 0.68 + sampleTile(tile.detail, u * 3.07 + offset.y, v * 3.07 + offset.x) * 0.32
  const density = smoothstep(deck.threshold, deck.threshold + deck.softness, n)
  if (density <= 0) return null
  const thick = smoothstep(deck.threshold, deck.threshold + 0.32, n)
  const towardSun = Math.max(0, direction.x * deck.sun.x + direction.y * deck.sun.y + direction.z * deck.sun.z)
  const silver = Math.pow(towardSun, 12) * (1 - thick)
  const lit: Rgb = [
    deck.lit[0] + deck.sunGlow[0] * silver,
    deck.lit[1] + deck.sunGlow[1] * silver,
    deck.lit[2] + deck.sunGlow[2] * silver,
  ]
  const far = smoothstep(0.04, 0.4, direction.y)
  return {
    colour: mix(deck.horizon, mix(lit, deck.shade, thick * deck.shadeBias), far),
    cover: density * (0.55 + 0.45 * far),
  }
}

/** Paints the clouds into a small canvas for the fallback renderer, to be stretched over the sky. */
function paintClouds(target: ImageData, camera: SkyCamera, deck: CloudDeck, offset: { x: number; y: number }) {
  const scaleX = camera.width / target.width
  const scaleY = camera.height / target.height
  const data = target.data
  for (let y = 0; y < target.height; y++) {
    for (let x = 0; x < target.width; x++) {
      const cloud = cloudAt(deck, rayThrough(camera, (x + 0.5) * scaleX, (y + 0.5) * scaleY), offset)
      const index = (y * target.width + x) * 4
      data[index] = cloud ? Math.min(255, cloud.colour[0] * 255) : 0
      data[index + 1] = cloud ? Math.min(255, cloud.colour[1] * 255) : 0
      data[index + 2] = cloud ? Math.min(255, cloud.colour[2] * 255) : 0
      data[index + 3] = cloud ? cloud.cover * 255 : 0
    }
  }
}

export { cloudAt, cloudDeckFor, paintClouds }
export type { CloudDeck }
