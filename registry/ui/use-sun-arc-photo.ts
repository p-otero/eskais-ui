import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import type { SunArcSlider } from "@/components/ui/sun-arc-primitive"
import type { SunArcPhoto, SunArcPhotoView } from "@/components/ui/sun-arc-photo"
import { nearestMinutes, photoLocator, photoPath, photoPathSamples } from "@/components/ui/sun-arc-photo-scene"
import { calendarIn, sunPosition, type SolarPlace } from "@/components/ui/sun-arc-solar"
import { useSkyPhoto } from "@/components/ui/use-sky-photo"
import { calibrateSkyView, defaultSkyPhotoFov, fovFromFocalLength35mm } from "@/lib/sky-photo-projection"

type PhotoOptions = {
  photo: SunArcPhoto | undefined
  onPhotoChange: ((photo: SunArcPhoto & SunArcPhotoView) => void) | undefined
  place: SolarPlace
  minutes: number
  timeZone: string | undefined
  slider: SunArcSlider & { focus: () => void }
  disabled: boolean
}

const capturePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/

/** The place and local minute a capture time names, with its offset or the arc's time zone's on that day. */
function captureOf(capturedAt: string, place: SolarPlace, timeZone: string | undefined) {
  const match = capturePattern.exec(capturedAt)
  if (!match) return undefined
  const [, year, month, day, hours, minutes, seconds = "0", zone] = match
  const local = Number(hours) * 60 + Number(minutes) + Number(seconds) / 60
  let utcOffset: number
  if (zone === "Z") utcOffset = 0
  else if (zone)
    utcOffset = (zone.startsWith("-") ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)))
  else utcOffset = calendarIn(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12)), timeZone).utcOffset
  return {
    place: { ...place, year: Number(year), month: Number(month), day: Number(day), utcOffset },
    minutes: local,
  }
}

function pointOn(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
    size: { width: rect.width, height: rect.height },
  }
}

type Drag = { pointer: number; kind: "sun" | "mark" }

/**
 * A `SunArc`'s photo: its sky, the view it is drawn with (calibrated here, from the props, from the EXIF or by
 * default), the arc across it, and dragging the sun along that arc or marking where the sun stands.
 */
function useSunArcPhoto({ photo, onPhotoChange, place, minutes, timeZone, slider, disabled }: PhotoOptions) {
  const sky = useSkyPhoto(photo?.src, photo?.skyMask)
  const analysis = sky?.status === "ready" ? sky.analysis : undefined
  const [own, setOwn] = useState<{ src: string; view: Partial<SunArcPhotoView> } | null>(null)
  const [marking, setMarking] = useState(false)
  const drag = useRef<Drag | null>(null)
  const ownView = photo && own?.src === photo.src ? own.view : {}
  const aspect = analysis?.aspect ?? 4 / 3
  const exif = analysis?.exif
  const exifFov = exif?.focalLength35mm ? fovFromFocalLength35mm(exif.focalLength35mm, aspect) : undefined
  const exifHeading = exif?.heading !== undefined && exif.headingReference === "true" ? exif.heading : undefined
  const heading = ownView.heading ?? photo?.heading ?? exifHeading ?? 180
  const fov = ownView.fov ?? photo?.fov ?? exifFov ?? defaultSkyPhotoFov
  const horizon = ownView.horizon ?? photo?.horizon ?? analysis?.mask.horizon ?? 0.5
  const headingGiven = photo?.heading !== undefined || exifHeading !== undefined
  const view = useMemo(() => ({ heading, fov, horizon, aspect }), [heading, fov, horizon, aspect])
  const locate = useMemo(() => photoLocator(view), [view])
  const samples = useMemo(() => photoPathSamples(place, view), [place, view])
  const path = useMemo(() => photoPath(samples), [samples])
  const capturedAt = photo?.capturedAt ?? (exif?.capturedAt ? `${exif.capturedAt}${exif.utcOffset ?? ""}` : undefined)

  const setView = (change: Partial<SunArcPhotoView>) => {
    if (!photo) return false
    const next = { heading, fov, horizon, ...change }
    setOwn({ src: photo.src, view: next })
    onPhotoChange?.({ ...photo, ...next })
    return true
  }

  const markAt = (point: { x: number; y: number }) => {
    const capture = capturedAt ? captureOf(capturedAt, place, timeZone) : undefined
    const sun = sunPosition(capture?.place ?? place, capture?.minutes ?? minutes)
    setView(calibrateSkyView({ fov, aspect }, sun, point))
  }

  const onPointerDownCapture = (event: ReactPointerEvent<HTMLElement>) => {
    if (!photo || disabled || event.button !== 0) return
    const onSun = event.target instanceof Element && event.target.closest('[data-slot="slider-thumb"]') !== null
    if (!marking && !onSun) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: event.pointerId, kind: marking ? "mark" : "sun" }
    if (marking) markAt(pointOn(event))
    else slider.focus()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current
    if (active?.pointer !== event.pointerId) return
    const point = pointOn(event)
    if (active.kind === "mark") {
      markAt(point)
      return
    }
    const next = nearestMinutes(samples, point, point.size)
    if (next !== undefined && Math.round(next) !== slider.getValue()) {
      slider.setValue(Math.round(next), { reason: "drag", event: event.nativeEvent })
    }
  }

  const onPointerEnd = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointer === event.pointerId) drag.current = null
  }

  return {
    active: photo !== undefined,
    sky,
    view,
    aspect,
    locate,
    path,
    marking,
    setMarking,
    setView,
    headingGiven,
    handlers: { onPointerDownCapture, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  }
}

export { captureOf, useSunArcPhoto }
