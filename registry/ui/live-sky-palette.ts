import { keysOf, recordOf } from "@/lib/narrow"

/** A colour as linear-ish 0 to 1 channels, the way the shaders and the sky function mix them. */
type Rgb = readonly [number, number, number]

const skyPaletteDefaults = {
  "night-zenith": "#03050c",
  "night-horizon": "#121a30",
  "blue-zenith": "#101d47",
  "blue-horizon": "#3f5288",
  "dawn-zenith": "#24356c",
  "dawn-horizon": "#d9845c",
  "dawn-glow": "#ff8f4a",
  "golden-zenith": "#4c77b9",
  "golden-horizon": "#f0c07c",
  "golden-glow": "#ffc25e",
  "day-zenith": "#2a68cc",
  "day-horizon": "#a6cbf0",
  "day-glow": "#fff4dc",
  "cloud-light": "#f3f4f6",
  "cloud-dark": "#474d5a",
  "city-glow": "#6a5650",
  fog: "#b4bbc4",
  sun: "#fff2d2",
  moon: "#efece2",
  "window-warm": "#ffc173",
  "window-cool": "#cfe0ff",
  "street-light": "#ffb35c",
  facade: "#d8d0c2",
  "facade-stone": "#b3a089",
  "facade-concrete": "#8d9399",
  "facade-gallery": "#ecebe6",
  rain: "#cbd8e8",
  snow: "#ffffff",
} as const

type SkyPaletteKey = keyof typeof skyPaletteDefaults
type SkyPalette = Record<SkyPaletteKey, Rgb>

const hexColour = /^#([0-9a-f]{6})$/i

function parseHex(value: string): Rgb | null {
  const match = hexColour.exec(value.trim())
  if (!match) return null
  const packed = Number.parseInt(match[1]!, 16)
  return [((packed >> 16) & 255) / 255, ((packed >> 8) & 255) / 255, (packed & 255) / 255]
}

const paletteKeys = keysOf(skyPaletteDefaults)

const defaultColour = (key: SkyPaletteKey) => parseHex(skyPaletteDefaults[key]) ?? [0, 0, 0]

/** The scene's colours from the `--live-sky-*` hex custom properties on an element, each falling back to its default. */
function readPalette(element: Element | null): SkyPalette {
  const style = element ? getComputedStyle(element) : null
  return recordOf(
    paletteKeys,
    (key) => parseHex(style?.getPropertyValue(`--live-sky-${key}`) ?? "") ?? defaultColour(key),
  )
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const scale = (colour: Rgb, by: number): Rgb => [colour[0] * by, colour[1] * by, colour[2] * by]
const add = (a: Rgb, b: Rgb): Rgb => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const luminance = (colour: Rgb) => 0.2126 * colour[0] + 0.7152 * colour[1] + 0.0722 * colour[2]

const channel = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255)
const cssColour = (colour: Rgb, alpha = 1) =>
  `rgb(${String(channel(colour[0]))} ${String(channel(colour[1]))} ${String(channel(colour[2]))} / ${String(alpha)})`

export { add, cssColour, luminance, mix, parseHex, readPalette, scale, skyPaletteDefaults }
export type { Rgb, SkyPalette, SkyPaletteKey }
