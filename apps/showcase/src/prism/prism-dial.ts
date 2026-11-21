import {
  colourAtHue,
  hueAtWavelength,
  maxWavelength,
  minWavelength,
  purpleHue,
  rotationForWavelength,
  scaleAt,
  slitDirection,
  wavelengthAtScale,
  type PickedColour,
} from "./prism-optics"
import { purpleEnd, purpleSteps } from "./prism-picker-primitive"

/** The scene is tilted so the white beam falls in from the upper left and the picked ray rises to the right. */
const sceneTilt = -slitDirection / 2

// Dial angles in screen degrees, clockwise from three o'clock. The spectrum runs under the prism from the violet
// end, left, to the red end, right; the purples close the loop over the top, where the beams cross the ring.
const violetAngle = 180 + sceneTilt - 16
const redAngle = -sceneTilt + 16
const spectralSweep = violetAngle - redAngle
const purpleSweep = 360 - spectralSweep

type Reading = {
  position: number
  /** Set on the spectrum: the picked wavelength in nm. */
  wavelength: number | undefined
  /** Set past the red end: how far toward violet the purple mix is, 0 to 1. */
  mix: number | undefined
  /** The prism's rotation in degrees. */
  rotation: number
  colour: PickedColour
}

const redRotation = rotationForWavelength(maxWavelength)
const violetRotation = rotationForWavelength(minWavelength)

const rotationCache = new Map<number, number>()
function rotationAt(wavelength: number) {
  const key = Math.round(wavelength * 4) / 4
  let rotation = rotationCache.get(key)
  if (rotation === undefined) {
    rotation = rotationForWavelength(key)
    rotationCache.set(key, rotation)
  }
  return rotation
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** What the dial shows at a position: 380 to 700 is the wavelength, past 700 the purples. Fractions are allowed. */
function readingAt(position: number): Reading {
  if (position <= maxWavelength) {
    const wavelength = Math.max(minWavelength, position)
    return {
      position,
      wavelength,
      mix: undefined,
      rotation: rotationAt(wavelength),
      colour: colourAtHue(hueAtWavelength(wavelength)),
    }
  }
  const mix = Math.min(1, (position - maxWavelength) / purpleSteps)
  return {
    position,
    wavelength: undefined,
    mix,
    rotation: redRotation + (violetRotation - redRotation) * smooth(mix),
    colour: colourAtHue(purpleHue(mix)),
  }
}

/** The dial angle, in screen degrees, of a position. */
function angleAt(position: number) {
  if (position <= maxWavelength) return violetAngle - scaleAt(position) * spectralSweep
  return redAngle - ((position - maxWavelength) / purpleSteps) * purpleSweep
}

/**
 * The position under a dial angle. Without purples, the gap over the top keeps the end the pointer came from, so a
 * drag past an end holds there instead of jumping to the other.
 */
function positionAtAngle(angle: number, purples: boolean, previous: number) {
  let along = violetAngle - angle
  along = ((along % 360) + 360) % 360
  if (along <= spectralSweep) return Math.round(wavelengthAtScale(along / spectralSweep))
  if (purples) return maxWavelength + Math.max(1, Math.round(((along - spectralSweep) / purpleSweep) * purpleSteps))
  if (previous > maxWavelength) return previous > maxWavelength + purpleSteps / 2 ? minWavelength : maxWavelength
  return previous >= (minWavelength + maxWavelength) / 2 ? maxWavelength : minWavelength
}

/** The largest position the dial reaches. */
const dialMax = (purples: boolean) => (purples ? purpleEnd : maxWavelength)

type ColourNames = {
  red: string
  orange: string
  yellow: string
  green: string
  cyan: string
  blue: string
  violet: string
  purple: string
  magenta: string
}

const defaultColourNames: ColourNames = {
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  cyan: "cyan",
  blue: "blue",
  violet: "violet",
  purple: "purple",
  magenta: "magenta",
}

// Bands of OKLCH hue, so the purples past the red end get names too.
function colourName(hue: number, names: ColourNames) {
  if (hue < 40 || hue >= 352) return names.red
  if (hue < 72) return names.orange
  if (hue < 115) return names.yellow
  if (hue < 168) return names.green
  if (hue < 222) return names.cyan
  if (hue < 278) return names.blue
  if (hue < 306) return names.violet
  if (hue < 330) return names.purple
  return names.magenta
}

export {
  angleAt,
  colourName,
  defaultColourNames,
  dialMax,
  positionAtAngle,
  purpleSweep,
  readingAt,
  redAngle,
  sceneTilt,
  spectralSweep,
  violetAngle,
}
export type { ColourNames, Reading }
