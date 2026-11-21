// The optics behind the prism picker: a ray traced through a glass prism with Snell's law, the glass's index from a
// Cauchy dispersion curve, and a wavelength's colour from the CIE 1931 observer through OKLab to sRGB.

type Vec = { x: number; y: number }

/** The visible range the dial covers, in nanometres. */
const minWavelength = 380
const maxWavelength = 700

// A flint-like glass (n_d ≈ 1.57) with an Abbe number near 12, about twice the dispersion of the densest real flints
// (N-SF66, Abbe 21). The exaggeration is deliberate: with real glass the fan spans about 10° and reads as a thin
// smear at a card's size. Everything else is plain Snell's law, so the fan, its order and its total internal
// reflection near the red end still behave as a real prism's would.
const cauchyA = 1.5
const cauchyB = 0.025

/** The glass's refractive index at a wavelength in nm: n(λ) = A + B / λ², with λ in µm. */
function refractiveIndex(wavelength: number) {
  const micrometres = wavelength / 1000
  return cauchyA + cauchyB / (micrometres * micrometres)
}

// Wyman, Sloan and Shirley (2013), "Simple Analytic Approximations to the CIE XYZ Color Matching Functions": the
// multi-lobe fit, within the observer's own noise across the visible range.
const lobe = (wavelength: number, mean: number, below: number, above: number) => {
  const t = (wavelength - mean) / (wavelength < mean ? below : above)
  return Math.exp(-0.5 * t * t)
}

function cieXyz(wavelength: number): [number, number, number] {
  const x =
    1.056 * lobe(wavelength, 599.8, 37.9, 31) +
    0.362 * lobe(wavelength, 442, 16, 26.7) -
    0.065 * lobe(wavelength, 501.1, 20.4, 26.2)
  const y = 0.821 * lobe(wavelength, 568.8, 46.9, 40.5) + 0.286 * lobe(wavelength, 530.9, 16.3, 31.1)
  const z = 1.217 * lobe(wavelength, 437, 11.8, 36) + 0.681 * lobe(wavelength, 459, 26, 13.8)
  return [x, y, z]
}

/** The luminous efficiency V(λ) = ȳ(λ), 1 near 555 nm. */
const luminousEfficiency = (wavelength: number) => cieXyz(wavelength)[1]

// Björn Ottosson's XYZ (D65) to OKLab, and linear sRGB to OKLab.
function xyzToOklab([x, y, z]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.818_933_010_1 * x + 0.361_866_742_4 * y - 0.128_859_713_7 * z)
  const m = Math.cbrt(0.032_984_543_6 * x + 0.929_311_871_5 * y + 0.036_145_638_7 * z)
  const s = Math.cbrt(0.048_200_301_8 * x + 0.264_366_269_1 * y + 0.633_851_707 * z)
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ]
}

function linearSrgbToOklab(red: number, green: number, blue: number): [number, number, number] {
  const l = Math.cbrt(0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue)
  const m = Math.cbrt(0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue)
  const s = Math.cbrt(0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue)
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ]
}

const degrees = (radians: number) => (radians * 180) / Math.PI
const wrap = (angle: number) => ((angle % 360) + 360) % 360
const oklabHue = ([, a, b]: [number, number, number]) => wrap(degrees(Math.atan2(b, a)))

/** The OKLCH hue of the spectral colour at a wavelength: where the CIE observer places it, before any gamut. */
const spectralHue = (wavelength: number) => oklabHue(xyzToOklab(cieXyz(wavelength)))

// The most saturated sRGB colours lie on the six cube edges between the primaries and secondaries; t runs along
// them from red (0) through yellow, green, cyan, blue and magenta (5) back to red (6), in linear light.
function edgeColour(t: number): [number, number, number] {
  const segment = Math.floor(t) % 6
  const f = t - Math.floor(t)
  switch (segment) {
    case 0:
      return [1, f, 0]
    case 1:
      return [1 - f, 1, 0]
    case 2:
      return [0, 1, f]
    case 3:
      return [0, 1 - f, 1]
    case 4:
      return [f, 0, 1]
    default:
      return [1, 0, 1 - f]
  }
}

const redHue = oklabHue(linearSrgbToOklab(1, 0, 0))
const unwrappedEdgeHue = (t: number) => {
  const hue = oklabHue(linearSrgbToOklab(...edgeColour(t)))
  return hue < redHue - 1e-9 ? hue + 360 : hue
}

/**
 * The sRGB colour at the gamut's cusp for an OKLCH hue: the most chroma the screen shows at that hue, at the
 * lightness where it peaks. Its own hue is `hue`, so the swatch, the rays and the readout agree.
 */
function cuspColour(hue: number): [number, number, number] {
  let target = wrap(hue)
  if (target < redHue) target += 360
  let low = 0
  let high = 6
  for (let step = 0; step < 32; step++) {
    const middle = (low + high) / 2
    if (unwrappedEdgeHue(middle) < target) low = middle
    else high = middle
  }
  return edgeColour((low + high) / 2)
}

const encode = (linear: number) => {
  const value = Math.min(1, Math.max(0, linear))
  return value <= 0.003_130_8 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055
}

type Rgb = [number, number, number]

/** Gamma-encoded sRGB, 0 to 1. */
const toSrgb = ([red, green, blue]: Rgb): Rgb => [encode(red), encode(green), encode(blue)]

const toHex = (srgb: Rgb) =>
  `#${srgb
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`

function hslHue([red, green, blue]: Rgb) {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return 0
  const hue =
    max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  return wrap(hue * 60)
}

type PickedColour = {
  /** The OKLCH hue, the same for the spectral colour and the sRGB one shown. */
  hue: number
  /** The HSL hue of the shown sRGB colour. */
  hslHue: number
  hex: string
  /** Gamma-encoded sRGB, 0 to 1. */
  srgb: Rgb
}

function colourAtHue(hue: number): PickedColour {
  const srgb = toSrgb(cuspColour(hue))
  return { hue: wrap(hue), hslHue: hslHue(srgb), hex: toHex(srgb), srgb }
}

// The observer's chromaticity barely moves below 420 nm and above 650 nm (and the analytic fit drifts there), so
// the hue holds at both ends, and each wavelength keeps at least the hue of the next so setHue finds one answer.
const flatBelow = 420
const flatAbove = 650

// The long end of the spectrum sits a few degrees past sRGB's red primary, toward magenta, so its cusp colour is a
// crimson (#ff003b). Hues below orange are stretched onto sRGB red's own hue, so the red end shows #ff0000 and the
// rays, swatch, hex and readout still come from this one table.
const redAnchor = 60

const hueTable = (() => {
  const table = new Float64Array(maxWavelength - minWavelength + 1)
  let previous = Infinity
  for (let index = 0; index < table.length; index++) {
    const wavelength = Math.min(flatAbove, Math.max(flatBelow, minWavelength + index))
    previous = Math.min(previous, spectralHue(wavelength))
    table[index] = previous
  }
  const spectralRed = table.at(-1) ?? 0
  return table.map((hue) =>
    hue >= redAnchor ? hue : redHue + ((hue - spectralRed) * (redAnchor - redHue)) / (redAnchor - spectralRed),
  )
})()

/** The hues the dial shows fall as the wavelength rises, from violet near 299° to sRGB red's 29°. */
const violetHue = hueTable[0] ?? 0
const redEndHue = hueTable.at(-1) ?? 0

// The dial's scale, like a prism spectroscope's, isn't even in nanometres: a nanometre takes room in proportion to
// how far it moves the hue, plus a floor, so the ends where the hue holds still stay short but reachable.
const scaleFloor = 0.35
const scaleTable = (() => {
  const steps = hueTable.length - 1
  const span = (hueTable[0] ?? 0) - (hueTable[steps] ?? 0)
  const table = new Float64Array(hueTable.length)
  let total = 0
  for (let index = 1; index <= steps; index++) {
    total += scaleFloor * (span / steps) + ((hueTable[index - 1] ?? 0) - (hueTable[index] ?? 0))
    table[index] = total
  }
  return table.map((value) => value / total)
})()

/** Where a wavelength sits along the dial's spectral arc, from 0 (380 nm) to 1 (700 nm). */
function scaleAt(wavelength: number) {
  const position = Math.min(maxWavelength, Math.max(minWavelength, wavelength)) - minWavelength
  const index = Math.min(scaleTable.length - 2, Math.floor(position))
  const f = position - index
  return (scaleTable[index] ?? 0) * (1 - f) + (scaleTable[index + 1] ?? 0) * f
}

/** The wavelength at a point of the dial's spectral arc, from 0 to 1. */
function wavelengthAtScale(fraction: number) {
  let low = minWavelength
  let high = maxWavelength
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (scaleAt(middle) < fraction) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** The hue a wavelength shows, read from the table between whole nanometres. */
function hueAtWavelength(wavelength: number) {
  const position = Math.min(maxWavelength, Math.max(minWavelength, wavelength)) - minWavelength
  const index = Math.floor(position)
  const next = Math.min(hueTable.length - 1, index + 1)
  const f = position - index
  return (hueTable[index] ?? 0) * (1 - f) + (hueTable[next] ?? 0) * f
}

/** The wavelength whose hue is closest to `hue`, or `undefined` for a non-spectral one (magentas and purples). */
function wavelengthAtHue(hue: number): number | undefined {
  const target = wrap(hue)
  const top = hueTable[0] ?? 0
  const bottom = hueTable.at(-1) ?? 0
  if (target > top + 0.5 || target < bottom - 0.5) return undefined
  const clamped = Math.min(top, Math.max(bottom, target))
  let low = minWavelength
  let high = maxWavelength
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (hueAtWavelength(middle) > clamped) low = middle
    else high = middle
  }
  return (low + high) / 2
}

// The prism: equilateral, apex down so the beam bends up, turned by `rotation` degrees about its centroid. Lengths
// are fractions of the stage's half-size.
const prismRadius = 0.27
const beamHeight = 0.06
/** The picked ray's fixed direction, in degrees, clockwise from the beam: the exit slit sits there. */
const slitDirection = -56

function prismVertices(rotation: number): [Vec, Vec, Vec] {
  const vertex = (angle: number) => {
    const radians = ((angle + rotation) * Math.PI) / 180
    return { x: prismRadius * Math.cos(radians), y: prismRadius * Math.sin(radians) }
  }
  return [vertex(90), vertex(210), vertex(330)]
}

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y

function hit(origin: Vec, direction: Vec, a: Vec, b: Vec) {
  const edge = { x: b.x - a.x, y: b.y - a.y }
  const denominator = direction.x * edge.y - direction.y * edge.x
  if (Math.abs(denominator) < 1e-12) return undefined
  const offset = { x: a.x - origin.x, y: a.y - origin.y }
  const t = (offset.x * edge.y - offset.y * edge.x) / denominator
  const u = (offset.x * direction.y - offset.y * direction.x) / denominator
  return t > 1e-9 && u >= 0 && u <= 1 ? t : undefined
}

function refract(direction: Vec, normal: Vec, ratio: number): Vec | undefined {
  const cosine = -dot(normal, direction)
  const k = 1 - ratio * ratio * (1 - cosine * cosine)
  if (k < 0) return undefined
  const factor = ratio * cosine - Math.sqrt(k)
  return { x: ratio * direction.x + factor * normal.x, y: ratio * direction.y + factor * normal.y }
}

type Trace = {
  /** Where the beam meets the prism, where it leaves, and the exit direction (a unit vector). */
  entry: Vec
  exit: Vec
  direction: Vec
  /** The ray's way through the glass: the entry, any reflections off a face, and the exit. */
  path: Vec[]
  /** Set when the ray reflects off the far face instead of leaving it. */
  reflected: boolean
  /** The direction of the few per cent the entry face reflects. */
  glint: Vec
}

/** Traces one wavelength from the stage's left edge through the prism turned by `rotation` degrees. */
function trace(rotation: number, wavelength: number): Trace | undefined {
  const [first, second, third] = prismVertices(rotation)
  const edges: [Vec, Vec][] = [
    [first, second],
    [second, third],
    [third, first],
  ]
  const n = refractiveIndex(wavelength)
  let origin: Vec = { x: -2, y: beamHeight }
  let direction: Vec = { x: 1, y: 0 }
  let inside = false
  let glint: Vec | undefined
  const path: Vec[] = []
  let reflected = false
  let lastEdge = -1
  for (let bounce = 0; bounce < 4; bounce++) {
    let nearest = Infinity
    let edgeIndex = -1
    edges.forEach(([start, end], index) => {
      if (index === lastEdge) return
      const t = hit(origin, direction, start, end)
      if (t !== undefined && t < nearest) {
        nearest = t
        edgeIndex = index
      }
    })
    const edge = edges[edgeIndex]
    if (!edge) return undefined
    const [a, b] = edge
    const point = { x: origin.x + direction.x * nearest, y: origin.y + direction.y * nearest }
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    let normal = { x: (b.y - a.y) / length, y: -(b.x - a.x) / length }
    if (dot(normal, direction) > 0) normal = { x: -normal.x, y: -normal.y }
    if (!inside) {
      const bent = refract(direction, normal, 1 / n)
      if (!bent) return undefined
      const along = 2 * dot(direction, normal)
      glint = { x: direction.x - along * normal.x, y: direction.y - along * normal.y }
      path.push(point)
      direction = bent
      inside = true
    } else {
      const bent = refract(direction, normal, n)
      if (bent) {
        const entry = path[0]
        if (!entry || !glint) return undefined
        path.push(point)
        return { entry, exit: point, direction: bent, path, reflected, glint }
      }
      const along = 2 * dot(direction, normal)
      direction = { x: direction.x - along * normal.x, y: direction.y - along * normal.y }
      path.push(point)
      reflected = true
    }
    origin = point
    lastEdge = edgeIndex
  }
  return undefined
}

const exitAngle = (rotation: number, wavelength: number) => {
  const traced = trace(rotation, wavelength)
  return traced ? degrees(Math.atan2(traced.direction.y, traced.direction.x)) : undefined
}

// The rotations the dial drives the prism through: on this side of minimum deviation, the exit angle of every
// wavelength rises steadily with the rotation, so each wavelength reaches the slit at one rotation.
const rotationRange = { low: -26, high: 0 }

/** The prism's rotation, in degrees, that sends `wavelength` out along the slit's direction. */
function rotationForWavelength(wavelength: number) {
  let low = rotationRange.low
  let high = rotationRange.high
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2
    const angle = exitAngle(middle, wavelength)
    if (angle === undefined || angle < slitDirection) high = middle
    else low = middle
  }
  return (low + high) / 2
}

export {
  colourAtHue,
  cieXyz,
  exitAngle,
  hueAtWavelength,
  luminousEfficiency,
  maxWavelength,
  minWavelength,
  prismRadius,
  prismVertices,
  redEndHue,
  refractiveIndex,
  rotationForWavelength,
  rotationRange,
  slitDirection,
  spectralHue,
  trace,
  violetHue,
  wavelengthAtHue,
  scaleAt,
  wavelengthAtScale,
  beamHeight,
}
export type { PickedColour, Rgb, Trace, Vec }
