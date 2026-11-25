import { seededRandom } from "@/components/ui/live-sky-street"

/** The side of the square, tiling noise texture the clouds are cut from, in texels. */
const noiseSize = 128

type NoiseTile = { size: number; billow: Uint8Array; detail: Uint8Array }

function latticeOf(cells: number, random: () => number) {
  return Float32Array.from({ length: cells * cells }, () => random())
}

const fade = (t: number) => t * t * (3 - 2 * t)

function valueNoise(lattice: Float32Array, cells: number, u: number, v: number) {
  const x = u * cells
  const y = v * cells
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = fade(x - x0)
  const ty = fade(y - y0)
  const at = (cx: number, cy: number) =>
    lattice[(((cy % cells) + cells) % cells) * cells + (((cx % cells) + cells) % cells)]!
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
  return top + (bottom - top) * ty
}

function fractal(octaves: { lattice: Float32Array; cells: number; weight: number }[], u: number, v: number) {
  let sum = 0
  let total = 0
  for (const octave of octaves) {
    sum += valueNoise(octave.lattice, octave.cells, u, v) * octave.weight
    total += octave.weight
  }
  return sum / total
}

let tile: NoiseTile | undefined

/** Two tiling fractal noise fields, made once per page: broad billows for the cloud shapes and fine detail for their edges. */
function noiseTile(): NoiseTile {
  if (tile) return tile
  const random = seededRandom(0x5eed)
  const octavesOf = (cells: number[]) =>
    cells.map((count, index) => ({ lattice: latticeOf(count, random), cells: count, weight: 0.55 ** index }))
  const broad = octavesOf([4, 8, 16, 32, 64])
  const fine = octavesOf([16, 32, 64, 128])
  const billow = new Uint8Array(noiseSize * noiseSize)
  const detail = new Uint8Array(noiseSize * noiseSize)
  for (let y = 0; y < noiseSize; y++) {
    for (let x = 0; x < noiseSize; x++) {
      const u = x / noiseSize
      const v = y / noiseSize
      billow[y * noiseSize + x] = Math.round(fractal(broad, u, v) * 255)
      detail[y * noiseSize + x] = Math.round(fractal(fine, u, v) * 255)
    }
  }
  tile = { size: noiseSize, billow, detail }
  return tile
}

function sampleTile(field: Uint8Array, u: number, v: number) {
  const x = (((u % 1) + 1) % 1) * noiseSize
  const y = (((v % 1) + 1) % 1) * noiseSize
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const at = (cx: number, cy: number) => field[(cy % noiseSize) * noiseSize + (cx % noiseSize)]! / 255
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
  return top + (bottom - top) * ty
}

export { noiseSize, noiseTile, sampleTile }
export type { NoiseTile }
