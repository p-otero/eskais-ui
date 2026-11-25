// Perf: a classical skyline finder, no model to download. It runs on a copy of the photo at most 1024 pixels on its long
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
const skyMaskSize = 1024

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

/** Work that yields every few rows or columns, so a caller can give the page a frame between slices. */
type Steps<T> = Generator<void, T, void>

const rowsPerStep = 8
const columnsPerStep = 16

/** Runs steps to their end at once, for a worker or a test. */
function finished<T>(steps: Steps<T>): T {
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

function* luminance({ data, width, height }: Pixels): Steps<Float32Array> {
  const result = new Float32Array(width * height)
  for (let index = 0; index < result.length; index++) {
    if (index % (width * rowsPerStep) === 0) yield
    const at = index * 4
    result[index] = (0.299 * data[at]! + 0.587 * data[at + 1]! + 0.114 * data[at + 2]!) / 255
  }
  return result
}

function* boxBlur(source: Float32Array, width: number, height: number, radius: number): Steps<Float32Array> {
  const across = new Float32Array(source.length)
  const result = new Float32Array(source.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    if (y % rowsPerStep === 0) yield
    let sum = 0
    for (let x = -radius; x <= radius; x++) sum += source[y * width + Math.min(width - 1, Math.max(0, x))]!
    for (let x = 0; x < width; x++) {
      across[y * width + x] = sum / span
      sum += source[y * width + Math.min(width - 1, x + radius + 1)]! - source[y * width + Math.max(0, x - radius)]!
    }
  }
  for (let x = 0; x < width; x++) {
    if (x % columnsPerStep === 0) yield
    let sum = 0
    for (let y = -radius; y <= radius; y++) sum += across[Math.min(height - 1, Math.max(0, y)) * width + x]!
    for (let y = 0; y < height; y++) {
      result[y * width + x] = sum / span
      sum += across[Math.min(height - 1, y + radius + 1) * width + x]! - across[Math.max(0, y - radius) * width + x]!
    }
  }
  return result
}

function* blurAcross(source: Float32Array, width: number, height: number, radius: number): Steps<Float32Array> {
  const result = new Float32Array(source.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    if (y % rowsPerStep === 0) yield
    let sum = 0
    for (let x = -radius; x <= radius; x++) sum += source[y * width + Math.min(width - 1, Math.max(0, x))]!
    for (let x = 0; x < width; x++) {
      result[y * width + x] = sum / span
      sum += source[y * width + Math.min(width - 1, x + radius + 1)]! - source[y * width + Math.max(0, x - radius)]!
    }
  }
  return result
}

// Spec: a roofline or the top of a blank wall is a crisp edge that runs straight for many pixels; a cloud's edge is soft
// and wavy. Averaged along the row, only the straight ones stay strong, and the skyline is pulled onto them.
function* straightEdges(vertical: Float32Array, width: number, height: number) {
  const along = yield* blurAcross(vertical, width, height, Math.max(4, Math.round(width / 80)))
  const result = new Float32Array(along.length)
  for (let index = 0; index < along.length; index++) {
    if (index % (width * rowsPerStep) === 0) yield
    result[index] = clamp01((along[index]! - 0.1) * 4)
  }
  return result
}

function* gradients(light: Float32Array, width: number, height: number) {
  const magnitude = new Float32Array(light.length)
  const vertical = new Float32Array(light.length)
  for (let y = 1; y < height - 1; y++) {
    if (y % rowsPerStep === 0) yield
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

function* coloursAbove({ data, width }: Pixels, skyline: Int32Array): Steps<Rgb[]> {
  const bands = 6
  const columns = 4
  const colours: Rgb[] = []
  for (let column = 0; column < columns; column++) {
    const from = Math.floor((column * width) / columns)
    const to = Math.floor(((column + 1) * width) / columns)
    for (let band = 0; band < bands; band++) {
      yield
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

function* skyLikelihoodSteps(pixels: Pixels, known?: Rgb[]) {
  const { data, width, height } = pixels
  const light = yield* luminance(pixels)
  const { magnitude, vertical } = yield* gradients(light, width, height)
  const texture = yield* boxBlur(magnitude, width, height, 2)
  const crisp = yield* boxBlur(magnitude, width, height, 1)
  const colours = known && known.length > 0 ? known : skyColours(pixels)
  const likelihood = new Float32Array(width * height)
  const colour = new Float32Array(width * height)
  const structure = new Float32Array(width * height)
  for (let index = 0; index < likelihood.length; index++) {
    if (index % (width * rowsPerStep) === 0) yield
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
    const greyCloud =
      clamp01((light[index]! - 0.3) * 2.2) * clamp01(1 - saturation * 3.5) * clamp01((blue - red) * 6 + 0.3)
    const whiteCloud = clamp01((light[index]! - 0.72) * 4) * clamp01(1 - saturation * 4)
    const cloud = Math.max(greyCloud, whiteCloud)
    const hardEdge = clamp01((crisp[index]! - 0.18) * 5)
    const smooth = clamp01(1 - texture[index]! * 4) * (1 - hardEdge)
    structure[index] = clamp01((crisp[index]! - strongEdge) * 6)
    colour[index] = Math.min(similar, blueSky)
    const upper = clamp01(1 - (2 * Math.floor(index / width)) / height)
    likelihood[index] = clamp01(
      Math.sqrt(Math.max(similar, blueSky, cloud) * (0.3 + 0.7 * smooth)) + 0.2 * upper * smooth,
    )
  }
  return { likelihood, colour, structure, vertical, light }
}

/**
 * How likely each pixel is sky, from 0 to 1: close to known sky colours (the top rows by default), bright or blue,
 * smooth, and higher up.
 */
const skyLikelihood = (pixels: Pixels, known?: Rgb[]) => finished(skyLikelihoodSteps(pixels, known))

const smoothnessPerRow = 0.6
const jumpRows = 0.12

function* skylineByDynamicProgramming(
  likelihood: Float32Array,
  edges: Float32Array,
  straight: Float32Array,
  width: number,
  height: number,
): Steps<Int32Array> {
  const straightPull = height * 0.04
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
      const edge = row < height ? edges[row * width + x]! + straightPull * straight[row * width + x]! : 0
      cost[row] = sky + ground - edge
    }
  }
  columnCost(0)
  previous.set(cost)
  for (let x = 1; x < width; x++) {
    if (x % columnsPerStep === 0) yield
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
const foregroundLikelihood = 0.4
const featherRadius = 1

function slidingExtreme(values: Int32Array, radius: number, pick: (a: number, b: number) => number) {
  const result = new Int32Array(values.length)
  for (let x = 0; x < values.length; x++) {
    let value = values[x]!
    for (let offset = -radius; offset <= radius; offset++) {
      const at = x + offset
      if (at >= 0 && at < values.length) value = pick(value, values[at]!)
    }
    result[x] = value
  }
  return result
}

function skylineWithoutThinSpikesAndNotches(skyline: Int32Array, width: number) {
  const radius = Math.max(3, Math.round(width * 0.012))
  const withoutSpikes = slidingExtreme(slidingExtreme(skyline, radius, Math.max), radius, Math.min)
  const withoutNotches = slidingExtreme(slidingExtreme(skyline, radius, Math.min), radius, Math.max)
  return { withoutSpikes, withoutNotches }
}

// Spec: a cloud's edges are soft; a lattice, a crane, a mast or a cornice has strong, crisp ones. A pixel on such an edge
// that isn't unmistakably sky-coloured stays foreground wherever the skyline runs, so thin things against the sky stay.
const strongEdge = 0.4
const bandLikelihood = 0.65
const bandColour = 0.5

function* turnFloatingSpecksIntoSky(
  hard: Float32Array,
  grounded: (x: number, y: number) => boolean,
  width: number,
  area: number,
) {
  const height = hard.length / width
  const seen = new Uint8Array(hard.length)
  const stack: number[] = []
  const patch: number[] = []
  let visited = 0
  for (let start = 0; start < hard.length; start++) {
    if (start % (width * rowsPerStep) === 0) yield
    if (seen[start] || hard[start] !== 0) continue
    seen[start] = 1
    stack.push(start)
    patch.length = 0
    let touchesGround = false
    while (stack.length > 0) {
      visited += 1
      if (visited % (width * rowsPerStep) === 0) yield
      const at = stack.pop()!
      patch.push(at)
      const x = at % width
      const y = (at - x) / width
      if (!touchesGround && grounded(x, y)) touchesGround = true
      if (touchesGround && patch.length > area) continue
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (next < 0 || next >= hard.length || seen[next] || hard[next] !== 0) continue
        if ((next === at - 1 && x === 0) || (next === at + 1 && x === width - 1)) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    if (!touchesGround && patch.length < area && height > 0) for (const at of patch) hard[at] = 1
  }
}

/** The finder a few rows or columns per step, so a caller can yield to the page between them; it returns the mask. */
function* findSkySteps(pixels: Pixels): Steps<SkyMask> {
  const { width, height } = pixels
  const first = yield* skyLikelihoodSteps(pixels)
  const edges = yield* boxBlur(first.vertical, width, height, 1)
  const straight = yield* straightEdges(first.vertical, width, height)
  yield
  const roughSkyline = yield* skylineByDynamicProgramming(first.likelihood, edges, straight, width, height)
  const { likelihood, colour, structure } = yield* skyLikelihoodSteps(pixels, yield* coloursAbove(pixels, roughSkyline))
  const skylineRows = yield* skylineByDynamicProgramming(likelihood, edges, straight, width, height)
  yield
  const lowestBand = [...skylineRows].toSorted((a, b) => a - b)[Math.floor(width * 0.85)] ?? height
  const { withoutSpikes, withoutNotches } = skylineWithoutThinSpikesAndNotches(skylineRows, width)
  const hard = new Float32Array(width * height)
  for (let x = 0; x < width; x++) {
    if (x % columnsPerStep === 0) yield
    const decidedByPixelFrom = Math.min(skylineRows[x]!, withoutNotches[x]!)
    const decidedByPixelTo = Math.max(skylineRows[x]!, withoutSpikes[x]!)
    for (let y = 0; y < height; y++) {
      const at = y * width + x
      const plainSky = structure[at]! < 0.5 || colour[at]! > holeColour
      if (y < decidedByPixelFrom) hard[at] = likelihood[at]! > foregroundLikelihood && plainSky ? 1 : 0
      else if (y < decidedByPixelTo) {
        hard[at] = (likelihood[at]! > bandLikelihood || colour[at]! > bandColour) && structure[at]! < 0.5 ? 1 : 0
      } else hard[at] = y < lowestBand && colour[at]! > holeColour ? 1 : 0
    }
  }
  yield* turnFloatingSpecksIntoSky(
    hard,
    (x, y) => y >= Math.max(skylineRows[x]!, withoutSpikes[x]!),
    width,
    Math.round(width * height * 0.0004),
  )
  yield
  const soft = yield* boxBlur(hard, width, height, featherRadius)
  const alpha = new Uint8ClampedArray(width * height)
  for (let index = 0; index < alpha.length; index++) {
    if (index % (width * rowsPerStep) === 0) yield
    alpha[index] = Math.round(soft[index]! * 255)
  }
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
  return finished(findSkySteps(pixels))
}

export { findSky, findSkySteps, finished, rowsPerStep, skyLikelihood, skyMaskSize }
export type { Pixels, Rgb, SkyMask, Steps }
