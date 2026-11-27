import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three"

/** A canvas to draw into: an OffscreenCanvas where there is one (in a worker too), a `<canvas>` otherwise. */
type Surface = HTMLCanvasElement | OffscreenCanvas
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type Draw = (context: Context2D, width: number, height: number) => void

function surface(width: number, height = width): Surface {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

function context2d(canvas: Surface): Context2D | null {
  return typeof OffscreenCanvas === "function" && canvas instanceof OffscreenCanvas
    ? canvas.getContext("2d")
    : canvas.getContext("2d")
}

const isBitmap = (image: unknown): image is ImageBitmap =>
  typeof ImageBitmap === "function" && image instanceof ImageBitmap

/** The same numbers in every browser for a seed, from 0 (inclusive) to 1. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** A texture drawn once on a canvas: square for a number, or `{ width, height }`; `color` marks it as sRGB. */
function canvasTexture(size: number | { width: number; height: number }, draw: Draw, color: boolean) {
  const { width, height } = typeof size === "number" ? { width: size, height: size } : size
  const canvas = surface(width, height)
  const context = context2d(canvas)
  if (context) draw(context, width, height)
  const texture = new CanvasTexture(canvas)
  if (color) texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function repeating(texture: Texture, times: number, timesY = times) {
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(times, timesY)
  return texture
}

/** Grey noise around `base` (0 to 255) by `spread`, with flecks of grain on top when `grain` is set. */
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

export { canvasTexture, context2d, isBitmap, noise, repeating, seededRandom, surface }
export type { Context2D, Draw, Surface }
