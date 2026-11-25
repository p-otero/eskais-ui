"use client"

import { ImageUpIcon } from "lucide-react"

import { FileInput, FileInputTrigger } from "@/components/ui/file-input"
import type { LiveSkyPhoto, LiveSkyPhotoView } from "@/components/ui/live-sky-photo"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { useObjectUrls } from "@/components/ui/use-live-sky-photo"
import type { SkyLocation } from "@/components/ui/live-sky-weather"
import { readSkyPhotoExifFrom } from "@/lib/sky-photo-exif"

type LiveSkyPhotoLabels = {
  calibrate: string
  markSun: string
  heading: string
  fov: string
  horizon: string
  /** Shown while the photo is read and its sky found. */
  readingPhoto: string
  photoFailed: string
}

const liveSkyPhotoLabels: LiveSkyPhotoLabels = {
  calibrate: "Calibrate",
  markSun: "Mark the sun",
  heading: "Heading",
  fov: "Field of view",
  horizon: "Horizon",
  readingPhoto: "Finding the sky in the photo…",
  photoFailed: "The photo couldn't be read.",
}

type CalibrationSliderProps = {
  label: string
  value: number
  min: number
  max: number
  text: string
  onValue: (value: number) => void
}

function CalibrationSlider({ label, value, min, max, text, onValue }: CalibrationSliderProps) {
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
      <Slider<number> value={value} min={min} max={max} step={1} onValueChange={onValue} format={() => text}>
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

type LiveSkyCalibrationProps = {
  view: LiveSkyPhotoView
  marking: boolean
  labels: LiveSkyPhotoLabels
  onView: (change: Partial<LiveSkyPhotoView>) => void
  onMarking: (marking: boolean) => void
  format: (value: number) => string
}

/** Points a LiveSky's photo: mark where the sun stood when it was taken, or set its heading, field of view and horizon. */
function LiveSkyCalibration({ view, marking, labels, onView, onMarking, format }: LiveSkyCalibrationProps) {
  const heading = Math.round(view.heading) % 360
  return (
    <div data-slot="live-sky-calibration" className="flex flex-wrap items-end gap-group">
      <Toggle variant="outline" size="sm" pressed={marking} onPressedChange={onMarking}>
        {labels.markSun}
      </Toggle>
      <CalibrationSlider
        label={labels.heading}
        value={heading}
        min={0}
        max={359}
        text={`${format(heading)}°`}
        onValue={(next) => onView({ heading: next })}
      />
      <CalibrationSlider
        label={labels.fov}
        value={Math.round(view.fov)}
        min={20}
        max={130}
        text={`${format(Math.round(view.fov))}°`}
        onValue={(fov) => onView({ fov })}
      />
      <CalibrationSlider
        label={labels.horizon}
        value={Math.round(view.horizon * 100)}
        min={0}
        max={100}
        text={`${format(Math.round(view.horizon * 100))}%`}
        onValue={(percent) => onView({ horizon: percent / 100 })}
      />
    </div>
  )
}

type LiveSkyPhotoUploadProps = {
  /** The button's text, and its accessible name. */
  label: string
  /** Runs with the photo, read locally as an object URL, and its GPS position, rounded, when the EXIF has one. */
  onPhoto: (photo: LiveSkyPhoto, place: SkyLocation | undefined) => void
  disabled?: boolean
}

/**
 * A button that picks a photo from the device for LiveSky's `photo`. It is read locally through an object URL, never
 * uploaded; the URL is freed when another photo replaces it or the button unmounts.
 */
function LiveSkyPhotoUpload({ label, onPhoto, disabled = false }: LiveSkyPhotoUploadProps) {
  const adopt = useObjectUrls()
  const onFiles = async (files: readonly File[]) => {
    const file = files[0]
    if (!file) return
    const exif = await readSkyPhotoExifFrom(file)
    const photo: LiveSkyPhoto = { src: adopt(file) }
    if (exif.heading !== undefined && exif.headingReference === "true") photo.heading = exif.heading
    const place =
      exif.latitude !== undefined && exif.longitude !== undefined
        ? {
            latitude: Number(exif.latitude.toFixed(2)),
            longitude: Number(exif.longitude.toFixed(2)),
          }
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

export { LiveSkyCalibration, LiveSkyPhotoUpload, liveSkyPhotoLabels }
export type { LiveSkyPhotoLabels, LiveSkyPhotoUploadProps }
