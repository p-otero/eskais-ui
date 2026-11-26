import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three"

type Surface = HTMLCanvasElement | OffscreenCanvas
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function surface(size: number): Surface {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(size, size)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  return canvas
}

function context2d(canvas: Surface): Context2D | null {
  return typeof OffscreenCanvas === "function" && canvas instanceof OffscreenCanvas
    ? canvas.getContext("2d")
    : canvas.getContext("2d")
}

const isBitmap = (image: unknown): image is ImageBitmap =>
  typeof ImageBitmap === "function" && image instanceof ImageBitmap

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(size: number, draw: (context: Context2D, size: number) => void, color: boolean) {
  const canvas = surface(size)
  const context = context2d(canvas)
  if (context) draw(context, size)
  const texture = new CanvasTexture(canvas)
  if (color) texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function repeating(texture: Texture, times: number) {
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(times, times)
  return texture
}

function noise(context: Context2D, size: number, base: number, spread: number, grain: boolean, seed: number) {
  const random = seededRandom(seed)
  const image = context.createImageData(size, size)
  for (let index = 0; index < size * size; index++) {
    const value = base + (random() - 0.5) * spread
    image.data[index * 4] = value
    image.data[index * 4 + 1] = value
    image.data[index * 4 + 2] = value
    image.data[index * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
  if (!grain) return
  context.globalAlpha = 0.18
  for (let index = 0; index < size * 3; index++) {
    context.fillStyle = random() > 0.5 ? "#fff" : "#000"
    context.beginPath()
    context.arc(random() * size, random() * size, 0.6 + random() * 2.2, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
}

function grilleHoles(context: Context2D, size: number) {
  context.fillStyle = "#fff"
  context.fillRect(0, 0, size, size)
  context.fillStyle = "#000"
  for (let y = 4; y < size; y += 8) {
    for (let x = (y / 8) % 2 ? 8 : 4; x < size; x += 8) {
      context.beginPath()
      context.arc(x, y, 2.3, 0, Math.PI * 2)
      context.fill()
    }
  }
}

const runOutGrooves = [0.62, 0.78, 0.92]

function grooves(context: Context2D, size: number) {
  const random = seededRandom(33)
  const center = size / 2
  context.fillStyle = "#808080"
  context.fillRect(0, 0, size, size)
  for (let radius = center * 0.4; radius < center * 0.985; radius += 1.6) {
    const gap = runOutGrooves.some((groove) => Math.abs(radius / center - groove) < 0.006)
    context.strokeStyle = gap ? "#9a9a9a" : random() > 0.5 ? "#6c6c6c" : "#767676"
    context.lineWidth = gap ? 1.6 : 0.8
    context.beginPath()
    context.arc(center, center, radius, 0, Math.PI * 2)
    context.stroke()
  }
}

function tangents(context: Context2D, size: number) {
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5
      const dy = size / 2 - y - 0.5
      const length = Math.hypot(dx, dy) || 1
      const index = (y * size + x) * 4
      image.data[index] = ((-dy / length) * 0.5 + 0.5) * 255
      image.data[index + 1] = ((dx / length) * 0.5 + 0.5) * 255
      image.data[index + 2] = 255
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
}

export { canvasTexture, grilleHoles, grooves, isBitmap, noise, repeating, tangents }
export type { Surface }
