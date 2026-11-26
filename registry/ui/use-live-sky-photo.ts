import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { radiansPerDegree, sunPosition } from "@/components/ui/live-sky-astronomy"
import type { ShownPhoto } from "@/components/ui/live-sky-engine"
import {
  loadPhotoLayers,
  type LiveSkyPhoto,
  type LiveSkyPhotoView,
  type PhotoLayers,
} from "@/components/ui/live-sky-photo"
import { roundedLocation, type SkyLocation } from "@/components/ui/live-sky-weather"
import { analyzeSkyPhoto, type SkyPhotoAnalysis } from "@/lib/sky-photo"
import { calibrateSkyView, defaultSkyPhotoFov, fovFromFocalLength35mm } from "@/lib/sky-photo-projection"

type Loaded = { key: string } & (
  | { status: "ready"; analysis: SkyPhotoAnalysis; layers: PhotoLayers }
  | { status: "failed"; error: string }
)

/** Where a photo stands: being read, ready to draw, or unreadable. */
type PhotoStatus = "none" | "reading" | "ready" | "failed"

const defaultHeading = 180
const minutesPerHourOfLongitude = 4
const capturePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/

/** When a capture time names, as a Date: with its offset, or by the place's longitude when the camera wrote none. */
function captureDate(capturedAt: string, longitude: number) {
  const match = capturePattern.exec(capturedAt)
  if (!match) return undefined
  const [, year, month, day, hours, minutes, seconds = "0", zone] = match
  const local = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds))
  if (zone === "Z") return new Date(local)
  if (zone) {
    const sign = zone.startsWith("-") ? -1 : 1
    return new Date(local - sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6))) * 60_000)
  }
  return new Date(local - longitude * minutesPerHourOfLongitude * 60_000)
}

function useLoadedPhoto(photo: LiveSkyPhoto | undefined) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = photo ? JSON.stringify([photo.src, photo.skyMask]) : ""
  const src = photo?.src
  const skyMask = photo?.skyMask

  useEffect(() => {
    if (!src) return
    const controller = new AbortController()
    let analysis: SkyPhotoAnalysis | undefined
    let layers: PhotoLayers | undefined
    const release = () => {
      analysis?.dispose()
      layers?.image.close()
      layers?.sky.close()
      layers?.windows?.close()
    }
    analyzeSkyPhoto(src, { skyMask, windows: true, signal: controller.signal })
      .then(async (result) => {
        analysis = result
        layers = await loadPhotoLayers(src, result, controller.signal)
        if (controller.signal.aborted) release()
        else setLoaded({ key, status: "ready", analysis: result, layers })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoaded({ key, status: "failed", error: error instanceof Error ? error.message : String(error) })
        }
      })
    return () => {
      controller.abort()
      release()
    }
  }, [key, src, skyMask])

  return loaded?.key === key ? loaded : null
}

type PhotoOptions = {
  photo: LiveSkyPhoto | undefined
  onPhotoChange: ((photo: LiveSkyPhoto & LiveSkyPhotoView) => void) | undefined
  /** Where the sky is, for marking the sun at the photo's capture time. */
  location: SkyLocation | null
}

/**
 * A LiveSky's photo: read locally, its sky found and its windows; the view it is drawn with (calibrated here, from the
 * props, from the EXIF or by default); its EXIF position, and marking where the sun stood when it was taken.
 */
function useLiveSkyPhoto({ photo, onPhotoChange, location }: PhotoOptions) {
  const loaded = useLoadedPhoto(photo)
  const [own, setOwn] = useState<{ src: string; view: Partial<LiveSkyPhotoView> } | null>(null)
  const [marking, setMarking] = useState(false)
  const ready = loaded?.status === "ready" ? loaded : null
  const exif = ready?.analysis.exif
  const aspect = ready?.analysis.aspect ?? 4 / 3
  const ownView = photo && own?.src === photo.src ? own.view : {}
  const exifHeading = exif?.heading !== undefined && exif.headingReference === "true" ? exif.heading : undefined
  const exifFov = exif?.focalLength35mm ? fovFromFocalLength35mm(exif.focalLength35mm, aspect) : undefined
  const view: LiveSkyPhotoView = {
    heading: ownView.heading ?? photo?.heading ?? exifHeading ?? defaultHeading,
    fov: ownView.fov ?? photo?.fov ?? exifFov ?? defaultSkyPhotoFov,
    horizon: ownView.horizon ?? photo?.horizon ?? ready?.analysis.mask.horizon ?? 0.5,
  }
  const status: PhotoStatus = !photo ? "none" : !loaded ? "reading" : loaded.status
  const shown: ShownPhoto | undefined =
    photo && ready ? { id: JSON.stringify([photo.src, photo.skyMask]), layers: ready.layers, view } : undefined
  const place =
    exif?.latitude !== undefined && exif.longitude !== undefined
      ? roundedLocation({ latitude: exif.latitude, longitude: exif.longitude })
      : null
  const headingKnown = photo?.heading !== undefined || exifHeading !== undefined || ownView.heading !== undefined

  const setView = (change: Partial<LiveSkyPhotoView>) => {
    if (!photo) return false
    const next = { ...view, ...change }
    setOwn({ src: photo.src, view: next })
    onPhotoChange?.({ ...photo, ...next })
    return true
  }

  const markSun = (point: { x: number; y: number }) => {
    const at = location ?? place
    if (!at) return false
    const captured = exif?.capturedAt
      ? captureDate(`${exif.capturedAt}${exif.utcOffset ?? ""}`, at.longitude)
      : undefined
    const sun = sunPosition(captured ?? new Date(), at.latitude, at.longitude)
    const sky = { azimuth: sun.azimuth / radiansPerDegree, altitude: sun.altitude / radiansPerDegree }
    return setView(calibrateSkyView({ fov: view.fov, aspect }, sky, point))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!marking || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    markSun({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height })
    setMarking(false)
  }

  return { status, shown, view, aspect, place, headingKnown, marking, setMarking, setView, onPointerDown }
}

/** Owns the object URLs made for local files: each new one frees the one before, and unmounting frees the last. */
function useObjectUrls() {
  const current = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current)
    },
    [],
  )
  return (blob: Blob) => {
    if (current.current) URL.revokeObjectURL(current.current)
    current.current = URL.createObjectURL(blob)
    return current.current
  }
}

export { captureDate, useLiveSkyPhoto, useObjectUrls }
export type { PhotoStatus }
