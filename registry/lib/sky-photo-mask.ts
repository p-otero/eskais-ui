// Perf: a classical skyline finder, no model to download. It runs on a copy of the photo at most 512 pixels on its long
// side: a per-pixel sky likelihood from colour, brightness and texture, then one skyline per column by dynamic
// programming, in O(width × height).

/** A sky mask over a downscaled photo: `alpha` is 255 where it is sky, feathered at the edges. */
type SkyMask = {
  width: number
  height: number
  alpha: Uint8ClampedArray
  /** The skyline's row in each column, from 0 (top) to 1 (bottom). */
  skyline: Float32Array
  /** A default horizon from 0 to 1: the skyline's lowest band, where the farthest buildings meet the sky. */
  horizon: number
}

type Pixels = { data: Uint8ClampedArray; width: number; height: number }

/** The longest side the finder works at; a larger photo is scaled down to it first. */
const skyMaskSize = 512

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

function luminance({ data, width, height }: Pixels) {
  const result = new Float32Array(width * height)
  for (let index = 0; index < result.length; index++) {
    const at = index * 4
    result[index] = (0.299 * data[at]! + 0.587 * data[at + 1]! + 0.114 * data[at + 2]!) / 255
  }
  return result
}

function boxBlur(source: Float32Array, width: number, height: number, radius: number) {
  const across = new Float32Array(source.length)
  const result = new Float32Array(source.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = -radius; x <= radius; x++) sum += source[y * width + Math.min(width - 1, Math.max(0, x))]!
    for (let x = 0; x < width; x++) {
      across[y * width + x] = sum / span
      sum += source[y * width + Math.min(width - 1, x + radius + 1)]! - source[y * width + Math.max(0, x - radius)]!
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) sum += across[Math.min(height - 1, Math.max(0, y)) * width + x]!
    for (let y = 0; y < height; y++) {
      result[y * width + x] = sum / span
      sum += across[Math.min(height - 1, y + radius + 1) * width + x]! - across[Math.max(0, y - radius) * width + x]!
    }
  }
  return result
}

function gradients(light: Float32Array, width: number, height: number) {
  const magnitude = new Float32Array(light.length)
  const vertical = new Float32Array(light.length)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x
      const gx =
        light[at - width + 1]! +
        2 * light[at + 1]! +
        light[at + width + 1]! -
        light[at - width - 1]! -
        2 * light[at - 1]! -
        light[at + width - 1]!
      const gy =
        light[at + width - 1]! +
        2 * light[at + width]! +
        light[at + width + 1]! -
        light[at - width - 1]! -
        2 * light[at - width]! -
        light[at - width + 1]!
      magnitude[at] = Math.hypot(gx, gy)
      vertical[at] = Math.abs(gy)
    }
  }
  return { magnitude, vertical }
}

type Rgb = [number, number, number]

function skyColours({ data, width, height }: Pixels): Rgb[] {
  const rows = Math.max(1, Math.round(height * 0.06))
  const bins = 8
  const colours: Rgb[] = []
  for (let bin = 0; bin < bins; bin++) {
    const from = Math.floor((bin * width) / bins)
    const to = Math.floor(((bin + 1) * width) / bins)
    let red = 0
    let green = 0
    let blue = 0
    let count = 0
    for (let y = 0; y < rows; y++) {
      for (let x = from; x < to; x++) {
        const at = (y * width + x) * 4
        red += data[at]!
        green += data[at + 1]!
        blue += data[at + 2]!
        count++
      }
    }
    if (count > 0) colours.push([red / count / 255, green / count / 255, blue / count / 255])
  }
  return colours
}

function coloursAbove({ data, width }: Pixels, skyline: Int32Array): Rgb[] {
  const bands = 6
  const columns = 4
  const colours: Rgb[] = []
  for (let column = 0; column < columns; column++) {
    const from = Math.floor((column * width) / columns)
    const to = Math.floor(((column + 1) * width) / columns)
    for (let band = 0; band < bands; band++) {
      let red = 0
      let green = 0
      let blue = 0
      let count = 0
      for (let x = from; x < to; x++) {
        const line = skyline[x]!
        const top = Math.floor((band * line) / bands)
        const bottom = Math.floor(((band + 1) * line) / bands) - (band === bands - 1 ? 2 : 0)
        for (let y = top; y < bottom; y++) {
          const at = (y * width + x) * 4
          red += data[at]!
          green += data[at + 1]!
          blue += data[at + 2]!
          count++
        }
      }
      if (count > 8) colours.push([red / count / 255, green / count / 255, blue / count / 255])
    }
  }
  return colours
}

/**
 * How likely each pixel is sky, from 0 to 1: close to known sky colours (the top rows by default), bright or blue,
 * smooth, and higher up.
 */
function skyLikelihood(pixels: Pixels, known?: Rgb[]) {
  const { data, width, height } = pixels
  const light = luminance(pixels)
  const { magnitude, vertical } = gradients(light, width, height)
  const texture = boxBlur(magnitude, width, height, 2)
  const colours = known && known.length > 0 ? known : skyColours(pixels)
  const likelihood = new Float32Array(width * height)
  const colour = new Float32Array(width * height)
  for (let index = 0; index < likelihood.length; index++) {
    const at = index * 4
    const red = data[at]! / 255
    const green = data[at + 1]! / 255
    const blue = data[at + 2]! / 255
    let nearest = Infinity
    for (const [r, g, b] of colours) nearest = Math.min(nearest, (red - r) ** 2 + (green - g) ** 2 + (blue - b) ** 2)
    const similar = Math.exp(-nearest / 0.02)
    const max = Math.max(red, green, blue)
    const saturation = max === 0 ? 0 : (max - Math.min(red, green, blue)) / max
    const blueSky = clamp01((blue - red) * 3 + 0.2) * clamp01(blue * 1.4 - 0.2)
    const cloud = clamp01((light[index]! - 0.3) * 2.2) * clamp01(1 - saturation * 3.5) * clamp01((blue - red) * 6 + 0.7)
    const smooth = clamp01(1 - texture[index]! * 4)
    colour[index] = Math.min(similar, blueSky)
    const upper = clamp01(1 - (2 * Math.floor(index / width)) / height)
    likelihood[index] = clamp01(
      Math.sqrt(Math.max(similar, blueSky, cloud) * (0.3 + 0.7 * smooth)) + 0.2 * upper * smooth,
    )
  }
  return { likelihood, colour, vertical, light }
}

const smoothnessPerRow = 0.6
const jumpRows = 0.12

function skylineByDynamicProgramming(likelihood: Float32Array, edges: Float32Array, width: number, height: number) {
  const cost = new Float32Array(height + 1)
  const previous = new Float32Array(height + 1)
  const current = new Float32Array(height + 1)
  const from = new Int32Array(width * (height + 1))
  const jump = Math.max(2, Math.round(height * jumpRows))
  const columnCost = (x: number) => {
    let ground = 0
    for (let y = 0; y < height; y++) ground += likelihood[y * width + x]!
    let sky = 0
    cost[0] = ground
    for (let row = 1; row <= height; row++) {
      const value = likelihood[(row - 1) * width + x]!
      sky += 1 - value
      ground -= value
      const edge = row < height ? edges[row * width + x]! : 0
      cost[row] = sky + ground - edge
    }
  }
  columnCost(0)
  previous.set(cost)
  for (let x = 1; x < width; x++) {
    columnCost(x)
    const best = new Float32Array(previous)
    const argument = new Int32Array(height + 1).map((_, row) => row)
    for (let row = 1; row <= height; row++) {
      if (best[row - 1]! + smoothnessPerRow < best[row]!) {
        best[row] = best[row - 1]! + smoothnessPerRow
        argument[row] = argument[row - 1]!
      }
    }
    for (let row = height - 1; row >= 0; row--) {
      if (best[row + 1]! + smoothnessPerRow < best[row]!) {
        best[row] = best[row + 1]! + smoothnessPerRow
        argument[row] = argument[row + 1]!
      }
    }
    let lowest = 0
    for (let row = 1; row <= height; row++) if (previous[row]! < previous[lowest]!) lowest = row
    const jumpCost = previous[lowest]! + smoothnessPerRow * jump
    for (let row = 0; row <= height; row++) {
      const viaJump = best[row]! > jumpCost
      current[row] = cost[row]! + (viaJump ? jumpCost : best[row]!)
      from[x * (height + 1) + row] = viaJump ? lowest : argument[row]!
    }
    previous.set(current)
  }
  const skyline = new Int32Array(width)
  let row = 0
  for (let candidate = 1; candidate <= height; candidate++) if (previous[candidate]! < previous[row]!) row = candidate
  for (let x = width - 1; x >= 0; x--) {
    skyline[x] = row
    if (x > 0) row = from[x * (height + 1) + row]!
  }
  return skyline
}

// Spec: sky seen through a gap below the skyline must match the sky's own colours and be blue, and sit above the
// skyline's lowest band, so a blue car or a sign in the street never turns into sky.
const holeColour = 0.8
const foregroundLikelihood = 0.22
const featherRadius = 1

/** The finder's stages, one per step, so a caller can yield to the page between them; the last returns the mask. */
function* findSkySteps(pixels: Pixels): Generator<void, SkyMask> {
  const { width, height } = pixels
  const first = skyLikelihood(pixels)
  yield
  const edges = boxBlur(first.vertical, width, height, 1)
  const roughSkyline = skylineByDynamicProgramming(first.likelihood, edges, width, height)
  yield
  const { likelihood, colour } = skyLikelihood(pixels, coloursAbove(pixels, roughSkyline))
  yield
  const skylineRows = skylineByDynamicProgramming(likelihood, edges, width, height)
  yield
  const lowestBand = [...skylineRows].toSorted((a, b) => a - b)[Math.floor(width * 0.85)] ?? height
  const hard = new Float32Array(width * height)
  for (let x = 0; x < width; x++) {
    const line = skylineRows[x]!
    for (let y = 0; y < height; y++) {
      const at = y * width + x
      const hole = y < lowestBand && colour[at]! > holeColour
      hard[at] = y < line ? (likelihood[at]! > foregroundLikelihood ? 1 : 0) : hole ? 1 : 0
    }
  }
  const soft = boxBlur(hard, width, height, featherRadius)
  const alpha = new Uint8ClampedArray(width * height)
  for (let index = 0; index < alpha.length; index++) alpha[index] = Math.round(soft[index]! * 255)
  const skyline = Float32Array.from(skylineRows, (row) => row / height)
  const sorted = skyline.toSorted((a, b) => a - b)
  const horizon = sorted[Math.floor(sorted.length * 0.85)] ?? 0.5
  return { width, height, alpha, skyline, horizon }
}

/**
 * Finds the sky in a photo's pixels (RGBA, at most `skyMaskSize` on the long side) in one go, for a worker or a test:
 * a skyline per column from two passes, the second with sky colours learnt from the first; sky seen through gaps
 * below it (a lattice tower, branches) and objects standing above it (a mast) kept apart; then feathered.
 */
function findSky(pixels: Pixels): SkyMask {
  const steps = findSkySteps(pixels)
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

export { findSky, findSkySteps, skyLikelihood, skyMaskSize }
export type { Pixels, Rgb, SkyMask }
