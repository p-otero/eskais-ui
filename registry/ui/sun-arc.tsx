"use client"

import { createParts } from "@ui-sdk/react/primitive"
import {
  createSliderController,
  Slider,
  SliderControl,
  SliderThumb,
  SliderTrack,
  type SliderValueChangeDetails,
} from "@ui-sdk/react/slider"
import { memo, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import {
  SunArcCalibration,
  SunArcPhotoLayers,
  sunArcPhotoLabels,
  type SunArcPhoto,
  type SunArcPhotoLabels,
  type SunArcPhotoView,
} from "@/components/ui/sun-arc-photo"
import { sunArc } from "@/components/ui/sun-arc-primitive"
import { domeLocator, domeScale, sceneAt, skyline, stars, sunPath, timeToX } from "@/components/ui/sun-arc-scene"
import { calendarIn, minutesPerDay, solarDay, sunAltitude, type SolarDay } from "@/components/ui/sun-arc-solar"
import { useSunArcPhoto } from "@/components/ui/use-sun-arc-photo"
import { useSunArcScene } from "@/components/ui/use-sun-arc-scene"
import { useLocale } from "@/lib/locale"
import { cn, cssVars } from "@/lib/utils"

const { Root: SunArcRoot } = createParts(sunArc, { root: "div" })

type SunArcLabels = SunArcPhotoLabels & {
  /** Names the arc, a slider in minutes, for screen readers and agents. */
  time: string
  /** The readout's term for the sun's height above the horizon. */
  altitude: string
  sunrise: string
  solarNoon: string
  sunset: string
}

const sunArcLabels: SunArcLabels = {
  time: "Time",
  altitude: "Sun altitude",
  sunrise: "Sunrise",
  solarNoon: "Solar noon",
  sunset: "Sunset",
  ...sunArcPhotoLabels,
}

type SunArcState = { disabled: boolean; day: SolarDay }

type SunArcProps = {
  /** The accessible name of the picker as a whole. */
  label: string
  /** Degrees north of the equator, −90 to 90. */
  latitude: number
  /** Degrees east of Greenwich, −180 to 180. */
  longitude: number
  /** The day whose sun it shows; today by default. */
  date?: Date
  /** The IANA time zone the minutes are counted in, like `"Europe/Madrid"`; the runtime's own by default. */
  timeZone?: string
  /** Minutes since local midnight, 0 to 1439. Pass it to control the picker. */
  value?: number
  /** Solar noon, rounded to the step, by default. */
  defaultValue?: number
  /** Runs on every step of a drag or a key, with UI SDK's slider details (`reason`, `source`, `cancel()`). */
  onValueChange?: (minutes: number, details: SliderValueChangeDetails) => void
  /** Runs once a drag or a key press that changed the value ends, for saving. */
  onValueCommit?: (minutes: number) => void
  /** Minutes per arrow key; 5 by default. Page Up and Page Down move an hour. */
  step?: number
  /** The locale times and degrees are written in; the page's `lang`, or the runtime's default without one. */
  locale?: string
  disabled?: boolean
  /** Submits the minutes under this name in a form. */
  name?: string
  labels?: Partial<SunArcLabels>
  /** Classes for the root; a function gets the picker's state. */
  className?: string | ((state: SunArcState) => string | undefined)
  /** Called with each sky paint's duration in ms, for measuring. */
  onPaint?: (milliseconds: number) => void
  /**
   * A photo of the place to draw the sky into instead of the drawn city: its own sky is replaced by the one for the
   * chosen time, the sun stands at its true azimuth and altitude through the photo's lens, and the foreground is relit.
   */
  photo?: SunArcPhoto
  /** Runs with the photo and its resolved view each time it is calibrated, for the app to keep; nothing is stored here. */
  onPhotoChange?: (photo: SunArcPhoto & SunArcPhotoView) => void
}

const snap = (minutes: number, step: number) =>
  Math.min(Math.floor((minutesPerDay - 1) / step) * step, Math.max(0, Math.round(minutes / step) * step))

const rulerHours = [0, 3, 6, 9, 12, 15, 18, 21, 24]

const Skyline = memo(function Skyline() {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- a city skyline drawn on the bench, not an icon
    <svg data-slot="sun-arc-skyline" aria-hidden="true" viewBox={skyline.viewBox} preserveAspectRatio="xMidYMax slice">
      <path data-layer="far" d={skyline.far.outline} />
      <path data-layer="middle" d={skyline.middle.outline} />
      <path data-layer="near" d={skyline.near.outline} />
    </svg>
  )
})

const Windows = memo(function Windows() {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- the city's lit windows, not an icon
    <svg data-slot="sun-arc-windows" aria-hidden="true" viewBox={skyline.viewBox} preserveAspectRatio="xMidYMax slice">
      <path d={`${skyline.middle.windows}${skyline.near.windows}`} />
    </svg>
  )
})

const Stars = memo(function Stars() {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- the night sky's stars, not an icon
    <svg data-slot="sun-arc-stars" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
      {stars.map((star) => (
        <ellipse
          key={star.key}
          cx={star.x}
          cy={star.y}
          rx={Number(star.r) * 0.09}
          ry={Number(star.r) * 0.16}
          opacity={star.o}
        />
      ))}
    </svg>
  )
})

function useTimeFormat(locale: string | undefined) {
  return useMemo(() => {
    const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    const hour = new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" })
    const angle = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
    const at = (minutes: number) => new Date(Date.UTC(2000, 0, 1, 0, Math.round(minutes)))
    return {
      time: (minutes: number) => clock.format(at(minutes)),
      hour: (hours: number) => hour.format(at((hours % 24) * 60)),
      altitude: (degrees: number) => `${angle.format(Math.round(degrees) || 0)}°`,
      number: (value: number) => angle.format(value),
    }
  }, [locale])
}

/**
 * A time-of-day picker drawn as the sun's real path over a city for a place and a day: the sky follows the sun's
 * altitude, and sunrise and sunset come from the solar position at `latitude`, `longitude` and `date`. The arc is
 * UI SDK's slider in minutes since local midnight (arrows by `step`, Page Up and Down an hour, Home and End).
 */
function SunArc({
  label,
  latitude,
  longitude,
  date,
  timeZone,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  step = 5,
  locale: localeProp,
  disabled = false,
  name,
  labels: labelOverrides,
  className,
  onPaint,
  photo,
  onPhotoChange,
}: SunArcProps) {
  const labels = { ...sunArcLabels, ...labelOverrides }
  const [today] = useState(() => new Date())
  const day = date ?? today
  const calendar = calendarIn(day, timeZone)
  const { year, month, day: dayOfMonth, utcOffset } = calendar
  const place = useMemo(
    () => ({ latitude, longitude, year, month, day: dayOfMonth, utcOffset }),
    [latitude, longitude, year, month, dayOfMonth, utcOffset],
  )
  const solar = useMemo(() => solarDay(place), [place])
  const scale = useMemo(() => domeScale(place), [place])
  const path = useMemo(() => sunPath(place, scale), [place, scale])
  const dome = useMemo(() => domeLocator(scale), [scale])
  const [slider] = useState(() => createSliderController<number>())
  const [ownValue, setOwnValue] = useState(() => defaultValue ?? snap(solar.noon, step))
  const minutes = value ?? ownValue
  const [instant, setInstant] = useState(true)
  const [calibrating, setCalibrating] = useState<{ src: string; open: boolean } | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const locale = useLocale(localeProp)
  const format = useTimeFormat(locale)
  const scene = useSunArcPhoto({ photo, onPhotoChange, place, minutes, timeZone, slider, disabled })
  useSunArcScene(stage, { place, locate: scene.active ? scene.locate : dome, minutes, instant, onPaint })
  const [firstPaint] = useState(() => sceneAt(place, scene.active ? scene.locate : dome, minutes))
  const showCalibration =
    photo !== undefined && (calibrating?.src === photo.src ? calibrating.open : !scene.headingGiven)
  const keepCalibrating = (open: boolean) => {
    if (photo) setCalibrating({ src: photo.src, open })
  }

  const altitude = sunAltitude(place, minutes)

  const onChange = (next: number, details: SliderValueChangeDetails) => {
    onValueChange?.(next, details)
    if (details.canceled) return
    setInstant(details.reason !== "imperative")
    setOwnValue(next)
  }

  const presets = [
    { key: "sunrise", text: labels.sunrise, at: solar.sunrise },
    { key: "noon", text: labels.solarNoon, at: solar.noon },
    { key: "sunset", text: labels.sunset, at: solar.sunset },
  ]
  const moveTo = (at: number) => {
    setInstant(false)
    slider.setValue(Math.round(at), { reason: "imperative" })
  }
  const state = { disabled, day: solar }

  return (
    <SunArcRoot
      slider={slider}
      disabled={disabled}
      day={solar}
      calibrate={
        scene.active
          ? (view) => {
              keepCalibrating(true)
              return scene.setView(view)
            }
          : undefined
      }
      aria-label={label}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className(state) : className,
      )}
    >
      <div
        ref={stage}
        data-slot="sun-arc-stage"
        data-disabled={disabled ? "" : undefined}
        data-polar={solar.kind === "day" ? undefined : solar.kind}
        data-photo={scene.active ? "" : undefined}
        data-marking={scene.marking ? "" : undefined}
        data-sun-out={firstPaint.out}
        aria-busy={scene.sky?.status === "reading" ? true : undefined}
        style={cssVars({ ...firstPaint.vars, "--sun-arc-aspect": scene.aspect.toFixed(4) })}
        {...scene.handlers}
      >
        <div data-slot="sun-arc-sky" aria-hidden="true" />
        <Stars />
        <div data-slot="sun-arc-dusk" aria-hidden="true" />
        <div data-slot="sun-arc-glow" data-light="pale" aria-hidden="true" />
        <div data-slot="sun-arc-glow" data-light="warm" aria-hidden="true" />
        {photo ? (
          <SunArcPhotoLayers src={photo.src} sky={scene.sky} path={scene.path} />
        ) : (
          <>
            <Skyline />
            <Windows />
          </>
        )}
        <div data-slot="sun-arc-ground" aria-hidden="true">
          {photo ? null : <div data-slot="sun-arc-glint" />}
          {rulerHours.map((hours) => (
            <span
              key={hours}
              data-slot="sun-arc-hour"
              style={cssVars({ "--sun-arc-at": `${(timeToX(hours * 60) * 100).toFixed(3)}%` })}
            >
              {hours % 6 === 0 && hours > 0 && hours < 24 ? format.hour(hours) : null}
            </span>
          ))}
          {[solar.sunrise, solar.sunset].map((at, index) =>
            at === undefined ? null : (
              <span
                key={index === 0 ? "sunrise" : "sunset"}
                data-slot="sun-arc-event"
                style={cssVars({ "--sun-arc-at": `${(timeToX(at) * 100).toFixed(3)}%` })}
              />
            ),
          )}
        </div>
        {photo ? null : (
          // oxlint-disable-next-line eskais/no-inline-icons -- the sun's path over the day, not an icon
          <svg data-slot="sun-arc-path" aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <path d={path} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        <Slider
          controller={slider}
          value={minutes}
          onValueChange={onChange}
          onValueCommit={onValueCommit ? (next: number) => onValueCommit(next) : undefined}
          min={0}
          max={minutesPerDay - 1}
          step={step}
          largeStep={Math.max(step, Math.round(60 / step) * step)}
          disabled={disabled}
          name={name}
          format={(next: number) => format.time(next)}
          locale={locale}
          className="absolute inset-0"
        >
          <SliderControl>
            <SliderTrack>
              <SliderThumb aria-label={labels.time} className="touch-target" />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </div>
      {showCalibration ? (
        <SunArcCalibration
          view={scene.view}
          marking={scene.marking}
          disabled={disabled}
          labels={labels}
          onView={(change) => {
            keepCalibrating(true)
            scene.setView(change)
          }}
          onMarking={(marking) => {
            keepCalibrating(true)
            scene.setMarking(marking)
          }}
          format={format.number}
        />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-group p-inset-surface">
        <dl className="flex flex-wrap items-end gap-group">
          <div className="flex flex-col">
            <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.time}</dt>
            <dd className="font-mono text-display-sm tracking-tight tabular-nums">{format.time(minutes)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.altitude}</dt>
            <dd className="font-mono text-title-sm tabular-nums">{format.altitude(altitude)}</dd>
          </div>
        </dl>
        {scene.active ? (
          <Toggle
            variant="outline"
            size="sm"
            pressed={showCalibration}
            disabled={disabled}
            onPressedChange={(pressed) => {
              keepCalibrating(pressed)
              if (!pressed) scene.setMarking(false)
            }}
          >
            {labels.calibrate}
          </Toggle>
        ) : null}
        <div className="grid grow grid-cols-3 gap-items sm:max-w-md">
          {presets.map((preset) => (
            <Button
              key={preset.key}
              variant="outline"
              wrap
              className="flex-col items-start gap-0 py-inset-chip text-start"
              disabled={disabled || preset.at === undefined}
              onClick={() => {
                if (preset.at !== undefined) moveTo(preset.at)
              }}
            >
              <span className="text-caption text-muted-foreground">{preset.text}</span>
              <span className="font-mono text-body tabular-nums">
                {preset.at === undefined ? "–" : format.time(preset.at)}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </SunArcRoot>
  )
}

export { SunArc, sunArcLabels }
export type { SunArcLabels, SunArcProps, SunArcState }
