import type { SkyCamera } from "@/components/ui/live-sky-camera"
import type { FacadeLighting } from "@/components/ui/live-sky-facade-light"
import type { GBuffer } from "@/components/ui/live-sky-gbuffer"
import { finishes } from "@/components/ui/live-sky-materials"
import type { PhotoLighting } from "@/components/ui/live-sky-photo-light"

const normalsByCode = [
  [0, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const

const channel = (value: number) => Math.max(0, Math.min(255, value * 255))

/**
 * The canvas fallback's lighting, a simpler twin of the WebGL pass: sky, bounce and street light, the sun on the side
 * that faces it, glass that reflects the sky's gradient, lit windows and haze. No sun shadows, no wet runoff.
 */
function lightFacadesInto(target: ImageData, gbuffer: GBuffer, lighting: FacadeLighting, camera: SkyCamera) {
  const { width, height, albedo, surface, place } = gbuffer
  const out = target.data
  const focal = (camera.focal * width) / camera.width
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      if (albedo[at + 3]! < 128) {
        out[at + 3] = 0
        continue
      }
      const sx = x + 0.5 - width / 2
      const sy = height / 2 - (y + 0.5)
      const rayX = camera.right.x * sx + camera.forward.x * focal
      const rayY = camera.forward.y * focal + camera.up.y * sy
      const rayZ = camera.forward.z * focal + camera.up.z * sy
      const length = Math.hypot(rayX, rayY, rayZ)
      const side = rayX < 0 ? -1 : 1
      const code = Math.round(surface[at]! / 50)
      const normal = code === 0 ? [-side, 0, 0] : (normalsByCode[code] ?? normalsByCode[1])
      const occlusion = surface[at + 1]! / 255
      const finish = Math.round(surface[at + 2]! / 40)
      const rank = surface[at + 3]! / 255
      const lit = rank > 0 && rank <= lighting.litFraction
      const metres = place[at + 3]! / 4
      const down = normal[1] < -0.5
      const sun = Math.max(0, normal[0] * lighting.sun.x + normal[1] * lighting.sun.y + normal[2] * lighting.sun.z)
      const wash = Math.exp(-metres / 7) * (down ? 1.7 : 1)
      const facing = Math.abs(normal[0] * rayX + normal[1] * rayY + normal[2] * rayZ) / length
      const elevation = Math.max(0, rayY / length)
      for (let index = 0; index < 3; index++) {
        const base = albedo[at + index]! / 255
        const light =
          lighting.skyFill[index]! * occlusion * (down ? 0.45 : 1) +
          lighting.bounce[index]! * occlusion * (down ? 1 : 0.25) +
          lighting.street[index]! * wash +
          lighting.sunColour[index]! * sun
        const env = lighting.horizon[index]! + (lighting.zenith[index]! - lighting.horizon[index]!) * elevation
        let value = base * light * (finish === finishes.matte ? 1 - 0.4 * lighting.wetness : 1)
        if (finish === finishes.glass) {
          const shine = Math.min(0.92, 0.22 + 0.85 * (1 - facing) ** 5) * (lit ? 0.45 : 1)
          value = base * (lit ? 0.95 : 0.06) * (1 - shine) + env * 0.92 * shine
        } else if (finish === finishes.translucent && lit) value += base * 0.55
        else if (finish === finishes.lamp) value = base * (0.5 + 2.6 * lighting.street[0])
        const hazed = 1 - Math.exp(-(place[at + 2]! * 2) * lighting.hazeDensity)
        out[at + index] = channel(value + (lighting.haze[index]! - value) * hazed)
      }
      out[at + 3] = 255
    }
  }
  return target
}

const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** The canvas fallback's photo relighting, the WebGL pass's model per pixel: the photo, its sky mask, its windows. */
function lightPhotoInto(
  target: ImageData,
  layers: { photo: ImageData; sky: ImageData; windows: ImageData | null },
  lighting: PhotoLighting,
  horizon: number,
) {
  const { width, height } = target
  const out = target.data
  const photo = layers.photo.data
  for (let y = 0; y < height; y++) {
    const down = y / height
    const below = smooth(horizon - 0.02, Math.min(1, horizon + 0.35), down)
    const groundBand = smooth(horizon + 0.18, Math.min(1, horizon + 0.5), down)
    const far = 1 - smooth(horizon - 0.1, 1, down) * 0.75
    const haze = Math.min(0.92, lighting.haze * far)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const foreground = 1 - layers.sky.data[at + 3]! / 255
      out[at + 3] = channel(foreground)
      if (foreground < 0.004) continue
      const red = photo[at]! / 255
      const green = photo[at + 1]! / 255
      const blue = photo[at + 2]! / 255
      const grey = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
      const ground = groundBand * (1 - smooth(0.08, 0.22, saturation))
      const glow = layers.windows ? (layers.windows.data[at + 3]! / 255) * lighting.windowsOn : 0
      const overcastTint = [0.9, 0.96, 1.06] as const
      const values = [red, green, blue]
      for (let index = 0; index < 3; index++) {
        let value = values[index]! + (grey - values[index]!) * 0.35 * lighting.overcast
        value = value + (0.45 + (value - 0.45) * 0.86 - value) * lighting.overcast
        value *= 1 + (overcastTint[index]! - 1) * lighting.overcast
        value *= 1 + (lighting.warmTint[index]! - 1) * lighting.warmth
        value *= 1 - 0.32 * lighting.wetness * (0.35 + 0.65 * below)
        value += lighting.sheen[index]! * lighting.wetness * ground * (1 - grey) * 0.3
        value *= lighting.exposure
        const blueHour = grey * lighting.exposure * lighting.nightTint[index]! * 0.5 + value * 0.1
        value += (blueHour - value) * lighting.night
        value += lighting.streetLight[index]! * lighting.night * below * (0.03 + 0.12 * grey)
        const lights = smooth(0.84, 0.97, grey) * below
        value +=
          lighting.streetLight[index]! *
          lighting.night *
          (lights * 0.55 + ground * lighting.wetness * (1 - grey) * 0.08)
        value += lighting.windowLight[index]! * glow
        out[at + index] = channel(value + (lighting.hazeColour[index]! - value) * haze)
      }
    }
  }
  return target
}

export { lightFacadesInto, lightPhotoInto }
