import {
  colourAtHue,
  hueAtWavelength,
  maxWavelength,
  minWavelength,
  rotationForWavelength,
  scaleAt,
  slitDirection,
  wavelengthAtScale,
  type PickedColour,
} from "@/components/ui/prism-picker-optics"

/** The scene is tilted so the white beam falls in from the upper left and the picked ray rises to the right. */
const sceneTilt = -slitDirection / 2

const violetAngle = 180 + sceneTilt - 16
const redAngle = -sceneTilt + 16
const spectralSweep = violetAngle - redAngle

type Reading = {
  /** The picked wavelength in nm; fractions while the prism glides between two. */
  wavelength: number
  /** The prism's rotation in degrees. */
  rotation: number
  colour: PickedColour
}

const clampWavelength = (wavelength: number) => Math.min(maxWavelength, Math.max(minWavelength, wavelength))

/** The colour a wavelength shows: the same for the rays, the swatch, the hex and the hue readout. */
const colourAt = (wavelength: number) => colourAtHue(hueAtWavelength(clampWavelength(wavelength)))

// Perf: a glide asks for fractional wavelengths on every frame; the rotation is a 40-step search, so it is kept per
// quarter nanometre.
const rotationCache = new Map<number, number>()
function rotationAt(wavelength: number) {
  const key = Math.round(clampWavelength(wavelength) * 4) / 4
  let rotation = rotationCache.get(key)
  if (rotation === undefined) {
    rotation = rotationForWavelength(key)
    rotationCache.set(key, rotation)
  }
  return rotation
}

function readingAt(wavelength: number): Reading {
  const clamped = clampWavelength(wavelength)
  return { wavelength: clamped, rotation: rotationAt(clamped), colour: colourAt(clamped) }
}

/** The dial angle, in screen degrees, of a wavelength. */
const angleAt = (wavelength: number) => violetAngle - scaleAt(clampWavelength(wavelength)) * spectralSweep

/** The whole nanometre under a dial angle. In the open gap over the top it keeps the end the pointer came from. */
function wavelengthAtAngle(angle: number, previous: number) {
  const along = (((violetAngle - angle) % 360) + 360) % 360
  if (along <= spectralSweep) return Math.round(wavelengthAtScale(along / spectralSweep))
  return previous >= (minWavelength + maxWavelength) / 2 ? maxWavelength : minWavelength
}

type ColourNames = {
  red: string
  orange: string
  yellow: string
  green: string
  cyan: string
  blue: string
  violet: string
}

function colourName(hue: number, names: ColourNames) {
  if (hue < 40 || hue >= 330) return names.red
  if (hue < 72) return names.orange
  if (hue < 115) return names.yellow
  if (hue < 168) return names.green
  if (hue < 222) return names.cyan
  if (hue < 278) return names.blue
  return names.violet
}

export { angleAt, colourAt, colourName, readingAt, sceneTilt, wavelengthAtAngle }
export type { ColourNames, Reading }
