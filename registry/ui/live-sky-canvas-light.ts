import type { SkyCamera } from "@/components/ui/live-sky-camera"
import type { FacadeLighting } from "@/components/ui/live-sky-facade-light"
import type { GBuffer } from "@/components/ui/live-sky-gbuffer"
import { finishes } from "@/components/ui/live-sky-materials"

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

export { lightFacadesInto }
