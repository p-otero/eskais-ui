import { readSkyPhotoExif, type SkyPhotoExif } from "@/lib/sky-photo-exif"
import { findSkySteps, skyMaskSize, type SkyMask } from "@/lib/sky-photo-mask"

/** A photo ready to have its sky replaced: its upright size, its sky and where its horizon most likely is. */
type SkyPhotoAnalysis = {
  width: number
  height: number
  /** Width over height, after the EXIF orientation. */
  aspect: number
  exif: SkyPhotoExif
  mask: SkyMask
  /** The sky as a canvas at the analysis size: opaque where it is sky, feathered at the edges. */
  sky: HTMLCanvasElement
  /** An object URL of a PNG that is opaque where the photo is not sky, for `mask-image`. Freed by `dispose`. */
  foregroundUrl: string
  /** How long the sky finder took, in ms. */
  analysisMs: number
  dispose: () => void
}

type SkyPhotoOptions = {
  /** An image to use as the sky mask instead of finding it: white is sky, black is the foreground. */
  skyMask?: string | Blob | undefined
  signal?: AbortSignal | undefined
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// Perf: the finder takes 60 to 90 ms on a 512 px photo; run in stages, it leaves the page a frame between them.
async function findSkyYielding(pixels: ImageData, signal: AbortSignal | undefined) {
  const steps = findSkySteps(pixels)
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
    // oxlint-disable-next-line no-await-in-loop -- each stage waits for the page to take its turn before the next one
    await nextTask()
    signal?.throwIfAborted()
  }
}

async function blobOf(source: string | Blob, signal: AbortSignal | undefined) {
  if (typeof source !== "string") return source
  const response = await fetch(source, { signal })
  if (!response.ok) throw new Error(`The photo couldn't be read: ${String(response.status)} ${response.statusText}`)
  return response.blob()
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

function drawScaled(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = canvasOf(width, height)
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("The photo couldn't be read: no 2D canvas")
  context.imageSmoothingQuality = "high"
  context.drawImage(bitmap, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

function maskFromImage(image: ImageData): SkyMask {
  const { width, height, data } = image
  const alpha = new Uint8ClampedArray(width * height)
  for (let index = 0; index < alpha.length; index++) {
    const at = index * 4
    alpha[index] = Math.round(0.299 * data[at]! + 0.587 * data[at + 1]! + 0.114 * data[at + 2]!)
  }
  const skyline = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let row = 0
    while (row < height && alpha[row * width + x]! >= 128) row++
    skyline[x] = row / height
  }
  const sorted = [...skyline].toSorted((a, b) => a - b)
  return { width, height, alpha, skyline, horizon: sorted[Math.floor(sorted.length * 0.85)] ?? 0.5 }
}

// Spec: the foreground's edge is pulled in a little past the feather's middle, so the old sky's light rim around buildings
// doesn't show against the new sky.
const foregroundAlpha = (sky: number) => Math.max(0, Math.min(255, Math.round((255 - sky) * 1.6 - 115)))

function alphaCanvas(mask: SkyMask, invert: boolean) {
  const canvas = canvasOf(mask.width, mask.height)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("The photo couldn't be read: no 2D canvas")
  const image = context.createImageData(mask.width, mask.height)
  for (let index = 0; index < mask.alpha.length; index++) {
    image.data[index * 4 + 3] = invert ? foregroundAlpha(mask.alpha[index]!) : mask.alpha[index]!
  }
  context.putImageData(image, 0, 0)
  return canvas
}

const pngOf = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The sky mask couldn't be encoded"))),
      "image/png",
    ),
  )

/**
 * Reads a photo locally (an object URL, a same-origin URL or a `Blob`; nothing is uploaded), its EXIF, and finds its
 * sky, or takes `skyMask` for it. A cross-origin URL needs CORS, since the finder reads its pixels.
 */
async function analyzeSkyPhoto(
  source: string | Blob,
  { skyMask, signal }: SkyPhotoOptions = {},
): Promise<SkyPhotoAnalysis> {
  const blob = await blobOf(source, signal)
  const exif = readSkyPhotoExif(await blob.slice(0, 131_072).arrayBuffer())
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" })
  const { width, height } = bitmap
  const scale = Math.min(1, skyMaskSize / Math.max(width, height))
  const small = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
  const started = performance.now()
  let mask: SkyMask
  if (skyMask === undefined) {
    mask = await findSkyYielding(drawScaled(bitmap, small.width, small.height), signal)
  } else {
    const maskBitmap = await createImageBitmap(await blobOf(skyMask, signal))
    mask = maskFromImage(drawScaled(maskBitmap, small.width, small.height))
    maskBitmap.close()
  }
  const analysisMs = performance.now() - started
  bitmap.close()
  signal?.throwIfAborted()
  const sky = alphaCanvas(mask, false)
  const foregroundUrl = URL.createObjectURL(await pngOf(alphaCanvas(mask, true)))
  return {
    width,
    height,
    aspect: width / height,
    exif,
    mask,
    sky,
    foregroundUrl,
    analysisMs,
    dispose: () => URL.revokeObjectURL(foregroundUrl),
  }
}

export { analyzeSkyPhoto }
export type { SkyPhotoAnalysis, SkyPhotoOptions }
