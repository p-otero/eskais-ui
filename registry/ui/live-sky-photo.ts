import type { SkyCamera } from "@/components/ui/live-sky-camera"
import type { SkyPhotoAnalysis } from "@/lib/sky-photo"

/** A photo of the place to show the live sky in, instead of the drawn street. */
type LiveSkyPhoto = {
  /** The photo's URL: an object URL from a local file, or a same-origin or CORS-enabled URL. */
  src: string
  /** The compass heading of the photo's centre, in degrees from north; from the EXIF, or 180° (south), without it. */
  heading?: number | undefined
  /** The horizontal field of view in degrees; from the EXIF focal length, or 69° (a phone's main camera), without it. */
  fov?: number | undefined
  /** Where the true horizon crosses the photo, from 0 (top) to 1 (bottom); the detected skyline's lowest band without it. */
  horizon?: number | undefined
  /** An image to use as the sky instead of finding it: white is sky, black is the foreground. */
  skyMask?: string | undefined
}

/** The view a photo is drawn with, every field resolved. */
type LiveSkyPhotoView = { heading: number; fov: number; horizon: number }

/** What the renderer draws a photo from: the photo upright, its sky mask, and the windows to light at night. */
type PhotoLayers = {
  image: ImageBitmap
  /** Opaque where the photo is sky. */
  sky: HTMLCanvasElement
  /** Opaque on the window panes to light at night; null when none were found. */
  windows: ImageBitmap | null
  aspect: number
}

const radiansPerDegree = Math.PI / 180
const maxPhotoSide = 2048

/** A camera that looks out of the photo: its heading and the tilt its horizon implies, with its field of view. */
function photoCamera(width: number, height: number, view: LiveSkyPhotoView): SkyCamera {
  const aspect = width / height
  const focalShare = 0.5 / Math.tan((view.fov * radiansPerDegree) / 2)
  const pitch = Math.atan((view.horizon - 0.5) / aspect / focalShare)
  const heading = view.heading * radiansPerDegree
  const forward = {
    x: Math.sin(heading) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(heading) * Math.cos(pitch),
  }
  const right = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) }
  const up = {
    x: -Math.sin(heading) * Math.sin(pitch),
    y: Math.cos(pitch),
    z: -Math.cos(heading) * Math.sin(pitch),
  }
  return { width, height, focal: width * focalShare, eye: { x: 0, y: 1.6, z: 0 }, forward, right, up }
}

async function bitmapOf(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`The photo answered ${String(response.status)}.`)
  const blob = await response.blob()
  const probe = await createImageBitmap(blob, { imageOrientation: "from-image" })
  const scale = Math.min(1, maxPhotoSide / Math.max(probe.width, probe.height))
  if (scale === 1) return probe
  const resized = await createImageBitmap(blob, {
    imageOrientation: "from-image",
    resizeWidth: Math.round(probe.width * scale),
    resizeHeight: Math.round(probe.height * scale),
    resizeQuality: "high",
  })
  probe.close()
  return resized
}

/** Loads what the renderer needs from a photo already analysed: the photo itself, at most 2048 px on its long side. */
async function loadPhotoLayers(src: string, analysis: SkyPhotoAnalysis, signal: AbortSignal): Promise<PhotoLayers> {
  const [image, windows] = await Promise.all([
    bitmapOf(src, signal),
    analysis.windowsUrl ? bitmapOf(analysis.windowsUrl, signal) : Promise.resolve(null),
  ])
  return { image, sky: analysis.sky, windows, aspect: analysis.aspect }
}

export { loadPhotoLayers, photoCamera }
export type { LiveSkyPhoto, LiveSkyPhotoView, PhotoLayers }
