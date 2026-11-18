// OKLCH against a screen's gamut, for painting a colour area where every pixel is a colour the picker can hold.
// Matrices from Björn Ottosson's OKLab and CSS Color 4 (linear sRGB to and from linear Display P3); the mapping is
// CSS Color 4's, which UI SDK's toGamut follows, written over plain numbers so a whole area paints in a few ms.

type AreaGamut = "srgb" | "p3"
type Oklch = { l: number; c: number; h: number }
type Linear = [number, number, number]

/** The chroma UI SDK's OKLCH area spans left to right, from 0 to this. */
const areaChromaMax = 0.4

function oklchToLinear(l: number, c: number, h: number, gamut: AreaGamut): Linear {
  const radians = (h * Math.PI) / 180
  const a = c * Math.cos(radians)
  const b = c * Math.sin(radians)
  const long = (l + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3
  const medium = (l - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3
  const short = (l - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3
  const red = 4.076_741_662_1 * long - 3.307_711_591_3 * medium + 0.230_969_929_2 * short
  const green = -1.268_438_004_6 * long + 2.609_757_401_1 * medium - 0.341_319_396_5 * short
  const blue = -0.004_196_086_3 * long - 0.703_418_614_7 * medium + 1.707_614_701 * short
  if (gamut === "srgb") return [red, green, blue]
  return [
    0.822_462_1 * red + 0.177_538 * green,
    0.033_194_1 * red + 0.966_805_8 * green,
    0.017_082_7 * red + 0.072_397_4 * green + 0.910_519_9 * blue,
  ]
}

function linearToOklab([first, second, third]: Linear, gamut: AreaGamut): Linear {
  const [red, green, blue] =
    gamut === "srgb"
      ? [first, second, third]
      : [
          1.224_940_1 * first - 0.224_940_4 * second,
          -0.042_056_9 * first + 1.042_057_1 * second,
          -0.019_637_6 * first - 0.078_636_1 * second + 1.098_273_5 * third,
        ]
  const long = Math.cbrt(0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue)
  const medium = Math.cbrt(0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue)
  const short = Math.cbrt(0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue)
  return [
    0.210_454_255_3 * long + 0.793_617_785 * medium - 0.004_072_046_8 * short,
    1.977_998_495_1 * long - 2.428_592_205 * medium + 0.450_593_709_9 * short,
    0.025_904_037_1 * long + 0.782_771_766_2 * medium - 0.808_675_766 * short,
  ]
}

const inside = (linear: Linear) => linear.every((channel) => channel >= 0 && channel <= 1)
const clip = (linear: Linear): Linear => [
  Math.min(1, Math.max(0, linear[0])),
  Math.min(1, Math.max(0, linear[1])),
  Math.min(1, Math.max(0, linear[2])),
]

function isOklchInGamut(l: number, c: number, h: number, gamut: AreaGamut = "srgb") {
  return inside(oklchToLinear(l, c, h, gamut))
}

/** The most chroma a lightness and hue reach inside the gamut: the edge of the painted colours on that row. */
function maxChroma(l: number, h: number, gamut: AreaGamut = "srgb") {
  if (l <= 0 || l >= 1) return 0
  if (isOklchInGamut(l, areaChromaMax, h, gamut)) return areaChromaMax
  let low = 0
  let high = areaChromaMax
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (isOklchInGamut(l, middle, h, gamut)) low = middle
    else high = middle
  }
  return low
}

const jnd = 0.02
const precision = 0.0001

/**
 * CSS Color 4 gamut mapping: lower chroma at the same lightness and hue until clipping what is left moves the
 * colour less than a just-noticeable difference, then clip. Returns the linear channels in the gamut.
 */
function mapToGamut(l: number, c: number, h: number, gamut: AreaGamut = "srgb"): Linear {
  if (l >= 1) return [1, 1, 1]
  if (l <= 0) return [0, 0, 0]
  const origin = oklchToLinear(l, c, h, gamut)
  if (inside(origin)) return origin
  const radians = (h * Math.PI) / 180
  const distance = (linear: Linear, chroma: number) => {
    const [lightness, a, b] = linearToOklab(linear, gamut)
    return Math.hypot(lightness - l, a - chroma * Math.cos(radians), b - chroma * Math.sin(radians))
  }
  let clipped = clip(origin)
  if (distance(clipped, c) < jnd) return clipped
  let low = 0
  let high = c
  let lowInside = true
  while (high - low > precision) {
    const chroma = (low + high) / 2
    const current = oklchToLinear(l, chroma, h, gamut)
    if (lowInside && inside(current)) {
      low = chroma
      continue
    }
    clipped = clip(current)
    const error = distance(clipped, chroma)
    if (error < jnd) {
      if (jnd - error < precision) break
      lowInside = false
      low = chroma
    } else {
      high = chroma
    }
  }
  return clipped
}

function linearToOklch(linear: Linear, gamut: AreaGamut, hue: number): Oklch {
  const [l, a, b] = linearToOklab(linear, gamut)
  const c = Math.hypot(a, b)
  const h = c < 1e-6 ? hue : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return { l, c, h }
}

/**
 * The colour at a point of the area (`x` across, `y` up, both 0 to 1) at hue `h`: the point itself inside the
 * gamut, and past its edge the colour UI SDK holds there, the CSS gamut-mapped one.
 */
function areaColor(x: number, y: number, h: number, gamut: AreaGamut = "srgb"): Oklch {
  const l = Math.min(1, Math.max(0, y))
  const c = Math.max(0, Math.min(1, x)) * areaChromaMax
  if (isOklchInGamut(l, c, h, gamut)) return { l, c, h }
  return linearToOklch(mapToGamut(l, c, h, gamut), gamut, h)
}

/** Where a colour sits in the area, as UI SDK places its thumb: chroma across, lightness up. */
function areaPoint({ l, c }: Oklch) {
  return { x: Math.min(1, c / areaChromaMax), y: Math.min(1, Math.max(0, l)) }
}

const encode = (linear: number) => {
  const value = Math.min(1, Math.max(0, linear))
  return Math.round(255 * (value <= 0.003_130_8 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055))
}

// Past the edge the mapped colour changes slowly along a row, so it is worked out every few columns and blended
// in between: a mapping is a dozen conversions, and an area holds tens of thousands of pixels.
const mappedStride = 4

/**
 * RGBA pixels for an area `width` by `height` at hue `h`, top row first with lightness 1 at the top, every pixel
 * past the gamut's edge painted as the colour the picker holds there. Both gamuts share sRGB's transfer curve, so
 * the bytes go to a canvas in that colour space.
 */
function paintArea(width: number, height: number, h: number, gamut: AreaGamut = "srgb") {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const chromaAt = (column: number) => (width === 1 ? 0 : column / (width - 1)) * areaChromaMax
  const write = (index: number, [red, green, blue]: Linear) => {
    pixels[index] = encode(red)
    pixels[index + 1] = encode(green)
    pixels[index + 2] = encode(blue)
    pixels[index + 3] = 255
  }
  for (let row = 0; row < height; row++) {
    const l = height === 1 ? 1 : 1 - row / (height - 1)
    const edge = maxChroma(l, h, gamut)
    const offset = row * width * 4
    let column = 0
    for (; column < width && chromaAt(column) <= edge; column++)
      write(offset + column * 4, oklchToLinear(l, chromaAt(column), h, gamut))
    let previous = column
    let before = column < width ? mapToGamut(l, chromaAt(column), h, gamut) : undefined
    if (before) write(offset + column * 4, before)
    while (before && previous < width - 1) {
      const next = Math.min(width - 1, previous + mappedStride)
      const after = mapToGamut(l, chromaAt(next), h, gamut)
      for (let between = previous + 1; between <= next; between++) {
        const t = (between - previous) / (next - previous)
        write(offset + between * 4, [
          before[0] + (after[0] - before[0]) * t,
          before[1] + (after[1] - before[1]) * t,
          before[2] + (after[2] - before[2]) * t,
        ])
      }
      previous = next
      before = after
    }
  }
  return pixels
}

export { areaChromaMax, areaColor, areaPoint, isOklchInGamut, mapToGamut, maxChroma, oklchToLinear, paintArea }
export type { AreaGamut, Oklch }
