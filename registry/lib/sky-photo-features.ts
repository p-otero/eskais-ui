import { finished, rowsPerStep, type Pixels, type SkyMask, type Steps } from "@/lib/sky-photo-mask"

/**
 * A photo's own clouds as two alpha maps over the sky, at the mask's size: `shade` is how much cloud covers each
 * pixel, and `light` how much of it is lit. Drawn as a dark layer under a lit one, they rebuild the clouds in any
 * colour of light.
 */
type SkyClouds = { width: number; height: number; shade: Uint8ClampedArray; light: Uint8ClampedArray }

/** The photo's windows that could be lit, as a glow alpha map at the mask's size, and how many it found and lit. */
type SkyWindows = { width: number; height: number; glow: Uint8ClampedArray; found: number; lit: number }

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

function channels(data: Uint8ClampedArray, at: number) {
  const red = data[at]! / 255
  const green = data[at + 1]! / 255
  const blue = data[at + 2]! / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  return {
    red,
    green,
    blue,
    saturation: max === 0 ? 0 : (max - min) / max,
    light: 0.299 * red + 0.587 * green + 0.114 * blue,
  }
}

function* findCloudsSteps({ data, width, height }: Pixels, mask: SkyMask): Steps<SkyClouds> {
  const everyRows = width * rowsPerStep
  let clearest = 0.15
  for (let index = 0; index < width * height; index++) {
    if (index % everyRows === 0) yield
    if (mask.alpha[index]! < 250) continue
    const { saturation, red, blue } = channels(data, index * 4)
    if (blue > red) clearest = Math.max(clearest, saturation)
  }
  const shade = new Uint8ClampedArray(width * height)
  const light = new Uint8ClampedArray(width * height)
  for (let index = 0; index < shade.length; index++) {
    if (index % everyRows === 0) yield
    const sky = mask.alpha[index]! / 255
    if (sky === 0) continue
    const { saturation, light: brightness } = channels(data, index * 4)
    const cloud = clamp01((1 - saturation / clearest - 0.15) * 1.6) * sky
    shade[index] = Math.round(cloud * 0.9 * 255)
    light[index] = Math.round(cloud * clamp01(brightness * 1.15) * 255)
  }
  return { width, height, shade, light }
}

/**
 * Finds the clouds in the photo's sky: the less saturated a sky pixel is than the clearest blue in the photo, the more
 * cloud it is. Its brightness says how lit that cloud is.
 */
const findClouds = (pixels: Pixels, mask: SkyMask) => finished(findCloudsSteps(pixels, mask))

function seeded(seed: number) {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function* localMean(values: Float32Array, width: number, height: number, radius: number): Steps<Float32Array> {
  const sums = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    if (y % rowsPerStep === 0) yield
    let row = 0
    for (let x = 0; x < width; x++) {
      row += values[y * width + x]!
      sums[(y + 1) * (width + 1) + x + 1] = sums[y * (width + 1) + x + 1]! + row
    }
  }
  const mean = new Float32Array(values.length)
  for (let y = 0; y < height; y++) {
    if (y % rowsPerStep === 0) yield
    const top = Math.max(0, y - radius)
    const bottom = Math.min(height, y + radius + 1)
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius)
      const right = Math.min(width, x + radius + 1)
      const total =
        sums[bottom * (width + 1) + right]! -
        sums[top * (width + 1) + right]! -
        sums[bottom * (width + 1) + left]! +
        sums[top * (width + 1) + left]!
      mean[y * width + x] = total / ((bottom - top) * (right - left))
    }
  }
  return mean
}

type Blob = { left: number; top: number; right: number; bottom: number; area: number }

const blobsPerStep = 64

const isVegetation = (red: number, green: number, blue: number) =>
  (green > red * 1.04 && green > blue * 1.04) || (red > blue * 1.35 && red - blue > 0.12 && green > blue * 1.15)

type WindowOptions = { share?: number; seed?: number }

function* findWindowsSteps(
  { data, width, height }: Pixels,
  mask: SkyMask,
  { share = 0.28, seed = 7 }: WindowOptions = {},
): Steps<SkyWindows> {
  const everyRows = width * rowsPerStep
  const light = new Float32Array(width * height)
  const wall = new Uint8Array(width * height)
  const plaster = new Uint8Array(width * height)
  for (let index = 0; index < light.length; index++) {
    if (index % everyRows === 0) yield
    const { red, green, blue, saturation, light: brightness } = channels(data, index * 4)
    light[index] = brightness
    wall[index] = mask.alpha[index]! < 40 && !isVegetation(red, green, blue) ? 1 : 0
    plaster[index] = wall[index] && saturation < 0.28 && brightness > 0.42 ? 1 : 0
  }
  const mean = yield* localMean(light, width, height, Math.max(3, Math.round(width / 170)))
  const candidate = new Uint8Array(width * height)
  for (let index = 0; index < light.length; index++) {
    if (index % everyRows === 0) yield
    if (wall[index] && light[index]! < mean[index]! - 0.07 && light[index]! < 0.7) candidate[index] = 1
  }
  const onWall = (blob: Blob) => {
    let ring = 0
    let wallCount = 0
    for (let y = blob.top - 2; y <= blob.bottom + 2; y++) {
      for (let x = blob.left - 2; x <= blob.right + 2; x++) {
        const inside = y >= blob.top && y <= blob.bottom && x >= blob.left && x <= blob.right
        if (inside || x < 0 || y < 0 || x >= width || y >= height) continue
        ring++
        wallCount += plaster[y * width + x]!
      }
    }
    return ring > 0 && wallCount / ring > 0.6
  }
  const seen = new Uint8Array(width * height)
  const blobs: Blob[] = []
  const stack: number[] = []
  const maxArea = Math.max(24, Math.round((width * height) / 9000))
  for (let start = 0; start < candidate.length; start++) {
    if (start % everyRows === 0) yield
    if (!candidate[start] || seen[start]) continue
    seen[start] = 1
    stack.push(start)
    const blob = { left: width, top: height, right: 0, bottom: 0, area: 0 }
    while (stack.length > 0) {
      const at = stack.pop()!
      const x = at % width
      const y = (at - x) / width
      blob.area++
      blob.left = Math.min(blob.left, x)
      blob.right = Math.max(blob.right, x)
      blob.top = Math.min(blob.top, y)
      blob.bottom = Math.max(blob.bottom, y)
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (next < 0 || next >= candidate.length || seen[next] || !candidate[next]) continue
        if ((next === at - 1 && x === 0) || (next === at + 1 && x === width - 1)) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    const boxWidth = blob.right - blob.left + 1
    const boxHeight = blob.bottom - blob.top + 1
    const fill = blob.area / (boxWidth * boxHeight)
    const aspect = boxWidth / boxHeight
    if (blob.area >= 2 && blob.area <= maxArea && fill > 0.6 && aspect > 0.25 && aspect < 4 && onWall(blob))
      blobs.push(blob)
  }
  const reachOf = (blob: Blob) =>
    Math.max(6, Math.round(width / 60), 3 * Math.max(blob.right - blob.left + 1, blob.bottom - blob.top + 1))
  const inRow = (blob: Blob, other: Blob) =>
    other !== blob && Math.abs(other.top - blob.top) <= 1 && Math.abs(other.left - blob.left) <= reachOf(blob)
  const inColumn = (blob: Blob, other: Blob) =>
    other !== blob && Math.abs(other.left - blob.left) <= 1 && Math.abs(other.top - blob.top) <= reachOf(blob)
  const windows: Blob[] = []
  for (const [index, blob] of blobs.entries()) {
    if (index % blobsPerStep === 0) yield
    if (blobs.some((other) => inRow(blob, other)) && blobs.some((other) => inColumn(blob, other))) windows.push(blob)
  }
  const random = seeded(seed)
  const glow = new Uint8ClampedArray(width * height)
  let lit = 0
  for (const window of windows) {
    if (random() > share) continue
    lit++
    const strength = Math.round((0.55 + random() * 0.45) * 255)
    for (let y = window.top; y <= window.bottom; y++) {
      for (let x = window.left; x <= window.right; x++) glow[y * width + x] = strength
    }
  }
  return { width, height, glow, found: windows.length, lit }
}

/**
 * Finds window-like panes on the buildings: small, nearly rectangular patches darker than a light, plain wall around
 * them, not foliage, each in a grid with a neighbour in its row and one in its column. A seeded share is drawn as glow.
 */
const findWindows = (pixels: Pixels, mask: SkyMask, options?: WindowOptions) =>
  finished(findWindowsSteps(pixels, mask, options))

export { findClouds, findCloudsSteps, findWindows, findWindowsSteps }
export type { SkyClouds, SkyWindows }
