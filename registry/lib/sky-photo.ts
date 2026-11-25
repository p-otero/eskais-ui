import { readSkyPhotoExif, type SkyPhotoExif } from "@/lib/sky-photo-exif"
import { findCloudsSteps, findWindowsSteps } from "@/lib/sky-photo-features"
import { findSkySteps, rowsPerStep, skyMaskSize, type SkyMask, type Steps } from "@/lib/sky-photo-mask"

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
  /** With `clouds`, object URLs of the photo's clouds for `mask-image`: how much cloud covers each pixel, and how lit. */
  clouds: { shadeUrl: string; lightUrl: string } | undefined
  /** With `windows`, an object URL of the window panes to light at night, for `mask-image`. */
  windowsUrl: string | undefined
  /** How long the sky finder took, in ms. */
  analysisMs: number
  /** Frees every object URL above. */
  dispose: () => void
}

type SkyPhotoOptions = {
  /** An image to use as the sky mask instead of finding it: white is sky, black is the foreground. */
  skyMask?: string | Blob | undefined
  /** Also finds the photo's own clouds (`findClouds`). */
  clouds?: boolean | undefined
  /** Also finds windows to light at night (`findWindows`), lighting a seeded share of them. */
  windows?: boolean | undefined
  signal?: AbortSignal | undefined
}

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const sliceMs = 6

// Perf: finding the sky, its clouds and its windows takes hundreds of ms on a 1024 px photo on a slow device; run in
// slices of a few ms, reading a photo holds no frame or key press for longer than one slice.
async function yielding<T>(steps: Steps<T>, signal: AbortSignal | undefined) {
  let until = performance.now() + sliceMs
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
    if (performance.now() < until) continue
    // oxlint-disable-next-line no-await-in-loop -- each slice waits for the page to take its turn before the next one
    await nextTask()
    signal?.throwIfAborted()
    until = performance.now() + sliceMs
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

// Perf: the browser decodes and scales the photo down from its file off the main thread, so only the small copy is
// drawn and read here; scaling a decoded bitmap would copy it on the main thread.
async function pixelsOf(blob: Blob, width: number, height: number) {
  const scaled = await createImageBitmap(blob, {
    imageOrientation: "from-image",
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: "high",
  })
  await nextTask()
  const canvas = canvasOf(width, height)
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("The photo couldn't be read: no 2D canvas")
  context.drawImage(scaled, 0, 0)
  scaled.close()
  return context.getImageData(0, 0, width, height)
}

function* maskFromImage(image: ImageData): Steps<SkyMask> {
  const { width, height, data } = image
  const alpha = new Uint8ClampedArray(width * height)
  for (let index = 0; index < alpha.length; index++) {
    if (index % (width * rowsPerStep) === 0) yield
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

function* alphaCanvas(
  width: number,
  height: number,
  alpha: Uint8ClampedArray,
  map: (value: number) => number,
): Steps<HTMLCanvasElement> {
  const canvas = canvasOf(width, height)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("The photo couldn't be read: no 2D canvas")
  const image = context.createImageData(width, height)
  for (let index = 0; index < alpha.length; index++) {
    if (index % (width * rowsPerStep * 4) === 0) yield
    image.data[index * 4 + 3] = map(alpha[index]!)
  }
  context.putImageData(image, 0, 0)
  return canvas
}

const same = (value: number) => value

async function alphaUrl(width: number, height: number, alpha: Uint8ClampedArray, signal: AbortSignal | undefined) {
  return URL.createObjectURL(await pngOf(await yielding(alphaCanvas(width, height, alpha, same), signal)))
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
  { skyMask, clouds: wantClouds = false, windows: wantWindows = false, signal }: SkyPhotoOptions = {},
): Promise<SkyPhotoAnalysis> {
  const blob = await blobOf(source, signal)
  const exif = readSkyPhotoExif(await blob.slice(0, 131_072).arrayBuffer())
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" })
  const { width, height } = bitmap
  bitmap.close()
  const scale = Math.min(1, skyMaskSize / Math.max(width, height))
  const small = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
  const started = performance.now()
  const pixels = await pixelsOf(blob, small.width, small.height)
  await nextTask()
  let mask: SkyMask
  if (skyMask === undefined) {
    mask = await yielding(findSkySteps(pixels), signal)
  } else {
    const maskPixels = await pixelsOf(await blobOf(skyMask, signal), small.width, small.height)
    mask = await yielding(maskFromImage(maskPixels), signal)
  }
  const analysisMs = performance.now() - started
  signal?.throwIfAborted()
  const sky = await yielding(alphaCanvas(mask.width, mask.height, mask.alpha, same), signal)
  const foreground = await yielding(alphaCanvas(mask.width, mask.height, mask.alpha, foregroundAlpha), signal)
  const foregroundUrl = URL.createObjectURL(await pngOf(foreground))
  let clouds: SkyPhotoAnalysis["clouds"]
  if (wantClouds) {
    const found = await yielding(findCloudsSteps(pixels, mask), signal)
    clouds = {
      shadeUrl: await alphaUrl(found.width, found.height, found.shade, signal),
      lightUrl: await alphaUrl(found.width, found.height, found.light, signal),
    }
  }
  let windowsUrl: string | undefined
  if (wantWindows) {
    const found = await yielding(findWindowsSteps(pixels, mask), signal)
    if (found.lit > 0) windowsUrl = await alphaUrl(found.width, found.height, found.glow, signal)
  }
  const urls = [foregroundUrl, clouds?.shadeUrl, clouds?.lightUrl, windowsUrl]
  return {
    width,
    height,
    aspect: width / height,
    exif,
    mask,
    sky,
    foregroundUrl,
    clouds,
    windowsUrl,
    analysisMs,
    dispose: () => {
      for (const url of urls) if (url) URL.revokeObjectURL(url)
    },
  }
}

export { analyzeSkyPhoto }
export type { SkyPhotoAnalysis, SkyPhotoOptions }
