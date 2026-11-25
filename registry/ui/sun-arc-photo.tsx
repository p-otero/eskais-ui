"use client"

import { ImageUpIcon } from "lucide-react"
import { FileInput, FileInputTrigger } from "@/components/ui/file-input"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { useObjectUrlOwner, type SkyPhotoState } from "@/components/ui/use-sky-photo"
import { readSkyPhotoExifFrom } from "@/lib/sky-photo-exif"
import { cssVars } from "@/lib/utils"

/** A photo of the place, taken looking at the sky, whose sky the arc replaces with the one for the chosen time. */
type SunArcPhoto = {
  /** The photo's URL: an object URL from a local file, or a same-origin or CORS-enabled URL. */
  src: string
  /** The compass heading of the photo's centre, in degrees from north; from the EXIF, or calibrated, without it. */
  heading?: number
  /** The horizontal field of view in degrees; from the EXIF focal length, or 69° (a phone's main camera), without it. */
  fov?: number
  /** Where the true horizon crosses the photo, from 0 (top) to 1 (bottom); the detected skyline's lowest band without it. */
  horizon?: number
  /** An image to use as the sky instead of finding it: white is sky, black is the foreground. */
  skyMask?: string
  /** When the photo was taken, `"2025-04-14T06:43:28"` local or with an offset; from the EXIF without it. Marking the
   * sun uses the sun's position at this time. */
  capturedAt?: string
}

/** The view a photo is drawn with: every field resolved. */
type SunArcPhotoView = { heading: number; fov: number; horizon: number }

type SunArcPhotoLabels = {
  calibrate: string
  markSun: string
  heading: string
  fov: string
  horizon: string
}

const sunArcPhotoLabels: SunArcPhotoLabels = {
  calibrate: "Calibrate",
  markSun: "Mark the sun",
  heading: "Heading",
  fov: "Field of view",
  horizon: "Horizon",
}

type StageProps = {
  src: string
  sky: SkyPhotoState | undefined
  path: { day: string; night: string }
}

function SunArcPhotoLayers({ src, sky, path }: StageProps) {
  const foreground = sky?.status === "ready" ? sky.analysis.foregroundUrl : undefined
  const size = sky?.status === "ready" ? sky.analysis : { width: 4, height: 3 }
  return (
    <>
      {/* oxlint-disable-next-line eskais/no-inline-icons -- the sun's path across the photo, not an icon */}
      <svg data-slot="sun-arc-path" aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <path data-part="night" d={path.night} vectorEffect="non-scaling-stroke" />
        <path d={path.day} vectorEffect="non-scaling-stroke" />
      </svg>
      <div
        data-slot="sun-arc-photo"
        data-masked={foreground ? "" : undefined}
        aria-hidden="true"
        style={foreground ? cssVars({ "--sun-arc-photo-mask": `url("${foreground}")` }) : undefined}
      >
        <img src={src} alt="" draggable={false} width={size.width} height={size.height} />
        <div data-light="warm" />
        <div data-light="shade" />
      </div>
    </>
  )
}

type CalibrationProps = {
  view: SunArcPhotoView
  marking: boolean
  disabled: boolean
  labels: SunArcPhotoLabels
  onView: (change: Partial<SunArcPhotoView>) => void
  onMarking: (marking: boolean) => void
  format: (value: number) => string
}

function CalibrationSlider({
  label,
  value,
  min,
  max,
  disabled,
  text,
  onValue,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled: boolean
  text: string
  onValue: (value: number) => void
}) {
  return (
    <div className="flex min-w-40 grow basis-0 flex-col gap-inline">
      <div className="flex items-baseline justify-between gap-items text-caption">
        <span aria-hidden="true" className="text-muted-foreground">
          {label}
        </span>
        <span aria-hidden="true" className="font-mono tabular-nums">
          {text}
        </span>
      </div>
      <Slider<number>
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onValueChange={onValue}
        format={() => text}
      >
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb aria-label={label} />
          </SliderTrack>
        </SliderControl>
      </Slider>
    </div>
  )
}

function SunArcCalibration({ view, marking, disabled, labels, onView, onMarking, format }: CalibrationProps) {
  return (
    <div
      data-slot="sun-arc-calibration"
      className="flex flex-wrap items-end gap-group px-inset-surface pt-inset-surface"
    >
      <Toggle variant="outline" size="sm" pressed={marking} disabled={disabled} onPressedChange={onMarking}>
        {labels.markSun}
      </Toggle>
      <CalibrationSlider
        label={labels.heading}
        value={Math.round(view.heading) % 360}
        min={0}
        max={359}
        disabled={disabled}
        text={`${format(Math.round(view.heading) % 360)}°`}
        onValue={(heading) => onView({ heading })}
      />
      <CalibrationSlider
        label={labels.fov}
        value={Math.round(view.fov)}
        min={20}
        max={130}
        disabled={disabled}
        text={`${format(Math.round(view.fov))}°`}
        onValue={(fov) => onView({ fov })}
      />
      <CalibrationSlider
        label={labels.horizon}
        value={Math.round(view.horizon * 100)}
        min={0}
        max={100}
        disabled={disabled}
        text={`${format(Math.round(view.horizon * 100))}%`}
        onValue={(percent) => onView({ horizon: percent / 100 })}
      />
    </div>
  )
}

/** What the EXIF of an uploaded photo says about its place, for the app to offer as the arc's location. */
type SunArcPhotoPlace = { latitude: number; longitude: number }

type SunArcPhotoUploadProps = {
  /** The button's text, and its accessible name. */
  label: string
  /** Runs with the photo, read locally as an object URL, and its GPS position when the EXIF has one. */
  onPhoto: (photo: SunArcPhoto, place: SunArcPhotoPlace | undefined) => void
  disabled?: boolean
}

/**
 * A button that picks a photo from the device for `SunArc`'s `photo`. It is read locally through an object URL, never
 * uploaded; the URL is freed when another photo replaces it or the button unmounts.
 */
function SunArcPhotoUpload({ label, onPhoto, disabled = false }: SunArcPhotoUploadProps) {
  const adopt = useObjectUrlOwner()
  const onFiles = async (files: readonly File[]) => {
    const file = files[0]
    if (!file) return
    const exif = await readSkyPhotoExifFrom(file)
    const photo: SunArcPhoto = { src: adopt(file) }
    if (exif.heading !== undefined && exif.headingReference === "true") photo.heading = exif.heading
    if (exif.capturedAt) photo.capturedAt = `${exif.capturedAt}${exif.utcOffset ?? ""}`
    const place =
      exif.latitude !== undefined && exif.longitude !== undefined
        ? { latitude: exif.latitude, longitude: exif.longitude }
        : undefined
    onPhoto(photo, place)
  }
  return (
    <FileInput accept="image/*" disabled={disabled} onValueChange={(files) => void onFiles(files)}>
      <FileInputTrigger>
        <ImageUpIcon aria-hidden="true" />
        {label}
      </FileInputTrigger>
    </FileInput>
  )
}

export { SunArcCalibration, SunArcPhotoLayers, SunArcPhotoUpload, sunArcPhotoLabels }
export type { SunArcPhoto, SunArcPhotoLabels, SunArcPhotoPlace, SunArcPhotoUploadProps, SunArcPhotoView }
