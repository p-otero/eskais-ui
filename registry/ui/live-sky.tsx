"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { LocateFixedIcon, RefreshCwIcon } from "lucide-react"
import { memo, useId, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { skyConditions } from "@/components/ui/live-sky-conditions"
import { liveSkyLabels, type LiveSkyLabels } from "@/components/ui/live-sky-labels"
import type { LiveSkyPhoto, LiveSkyPhotoView } from "@/components/ui/live-sky-photo"
import {
  LiveSkyCalibration,
  liveSkyPhotoLabels,
  type LiveSkyPhotoLabels,
} from "@/components/ui/live-sky-photo-controls"
import { liveSky } from "@/components/ui/live-sky-primitive"
import { LiveSkySearch } from "@/components/ui/live-sky-search"
import {
  openMeteo,
  roundedLocation,
  type PlaceSearcher,
  type SkyLocation,
  type SkyPlace,
  type SkyWeather,
  type WeatherFetcher,
} from "@/components/ui/live-sky-weather"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"
import { useLiveSkyGeolocation } from "@/components/ui/use-live-sky-geolocation"
import { useLiveSkyPhoto } from "@/components/ui/use-live-sky-photo"
import { useLiveSkyScene, useSkyTime } from "@/components/ui/use-live-sky-scene"
import { useLiveSkyWeather } from "@/components/ui/use-live-sky-weather"
import { cn, cssVars } from "@/lib/utils"

const { Root: LiveSkyRoot } = createParts(liveSky, { root: "div" })

/** Fixed weather, time and place, for demos and tests: nothing is fetched and the actions refuse with why. */
type LiveSkySimulation = {
  /** Merged over a fair, mild day. */
  weather: Partial<SkyWeather>
  /** The moment to show, in ms since the epoch or as a Date. */
  time: number | Date
  location: SkyLocation
}

type LiveSkyState = { status: "idle" | "loading" | "ready" | "refreshing" | "error" | "simulated" }

type LiveSkyProps = {
  /** The accessible name of the sky as a whole; agents find it by this. */
  label: string
  /** A place, or `"geolocate"` (the default) to offer a button that asks the browser where the person is. */
  location?: SkyLocation | "geolocate"
  /** Runs when the person or an agent picks a place or locates themselves. Nothing is stored unless you store it. */
  onLocationChange?: (location: SkyLocation) => void
  /** Fetches the weather; Open-Meteo's free, non-commercial API by default (`createOpenMeteo` for a key or another host). */
  fetchWeather?: WeatherFetcher
  /** Looks places up by name for the search; Open-Meteo's geocoder by default, `false` for no search. */
  searchPlaces?: PlaceSearcher | false
  /** Runs with each weather answer, the first and every refresh. */
  onWeather?: (weather: SkyWeather, location: SkyLocation) => void
  /** How often the weather is fetched again while the sky is on screen, in ms. Defaults to 10 minutes. */
  refreshMs?: number
  /** Shows this weather, time and place instead of fetching. */
  simulate?: LiveSkySimulation
  /**
   * A photo of the place to show the live sky in instead of the drawn street: its sky is replaced by the weather now,
   * with the sun and moon where they stand through its lens, and the rest is relit; rain and the glass fall over it.
   * Without a `location`, the photo's EXIF position is used, rounded.
   */
  photo?: LiveSkyPhoto
  /** Runs with the photo and its resolved view each time it is calibrated, for the app to keep; nothing is stored here. */
  onPhotoChange?: (photo: LiveSkyPhoto & LiveSkyPhotoView) => void
  /** Drops landing and running down a pane of glass in front of the sky. On by default. */
  glass?: boolean
  /** Formats the temperature, rain and wind; the page's language by default. */
  locale?: string
  labels?: Partial<Omit<LiveSkyLabels, "conditions" | "sun">> &
    Partial<LiveSkyPhotoLabels> & {
      conditions?: Partial<LiveSkyLabels["conditions"]>
      sun?: Partial<LiveSkyLabels["sun"]>
    }
  /** Classes for the root; a function gets the sky's state. */
  className?: string | ((state: LiveSkyState) => string | undefined)
  /** Called with each frame's drawing time in ms, for measuring. */
  onFrame?: (milliseconds: number) => void
}

const defaultRefreshMs = 10 * 60_000

const fairWeather: SkyWeather = {
  time: 0,
  temperature: 15,
  precipitation: 0,
  rain: 0,
  showers: 0,
  snowfall: 0,
  cloudCover: 35,
  weatherCode: 2,
  windSpeed: 9,
  windDirection: 240,
  visibility: 24_000,
  isDay: true,
  nextHours: [],
}

const minutesPerDegreeOfLongitude = 4
const guessedLatitude = 40

function placeFromClock(): SkyLocation {
  return { latitude: guessedLatitude, longitude: -new Date().getTimezoneOffset() / minutesPerDegreeOfLongitude }
}

const coordinates = (location: SkyLocation, locale: string | undefined) => {
  const degrees = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  return `${degrees.format(location.latitude)}°, ${degrees.format(location.longitude)}°`
}

type Formatters = { temperature: Intl.NumberFormat; rate: Intl.NumberFormat; wind: Intl.NumberFormat }

const formattersByLocale = new Map<string, Formatters>()

// Perf: an Intl.NumberFormat costs more to build than to use, and a scrubbed rain renders the readout on every key.
function formatters(locale: string | undefined): Formatters {
  const key = locale ?? ""
  const known = formattersByLocale.get(key)
  if (known) return known
  const made = {
    temperature: new Intl.NumberFormat(locale, { style: "unit", unit: "celsius", maximumFractionDigits: 0 }),
    rate: new Intl.NumberFormat(locale, { style: "unit", unit: "millimeter-per-hour", maximumFractionDigits: 1 }),
    wind: new Intl.NumberFormat(locale, { style: "unit", unit: "kilometer-per-hour", maximumFractionDigits: 0 }),
  }
  formattersByLocale.set(key, made)
  return made
}

type AllLabels = LiveSkyLabels & LiveSkyPhotoLabels

function mergedLabels(overrides: LiveSkyProps["labels"]): AllLabels {
  return {
    ...liveSkyLabels,
    ...liveSkyPhotoLabels,
    ...overrides,
    conditions: { ...liveSkyLabels.conditions, ...overrides?.conditions },
    sun: { ...liveSkyLabels.sun, ...overrides?.sun },
  }
}

type HeadingProps = {
  place: string
  simulated: boolean
  /** The photo's src when it's ready to calibrate. */
  calibratable: string | null
  calibrationOpen: boolean
  onCalibrating: (calibrating: { src: string; open: boolean }) => void
  labels: AllLabels
}

const LiveSkyHeading = memo(function LiveSkyHeading({
  place,
  simulated,
  calibratable,
  calibrationOpen,
  onCalibrating,
  labels,
}: HeadingProps) {
  return (
    <div className="flex flex-wrap items-center gap-inline">
      <span className="text-title-sm tracking-tight">{place}</span>
      {simulated ? <Badge variant="outline">{labels.simulated}</Badge> : null}
      {calibratable ? (
        <Toggle
          variant="outline"
          size="sm"
          pressed={calibrationOpen}
          onPressedChange={(open) => onCalibrating({ src: calibratable, open })}
        >
          {labels.calibrate}
        </Toggle>
      ) : null}
    </div>
  )
})

/**
 * The sky over a place right now, seen looking up between buildings: the real weather from Open-Meteo (or your
 * fetcher) drawn with WebGL, the sun and moon where they stand, rain that falls toward you and runs down the glass.
 * The scene is decorative; a readout and a summary sentence carry what it shows.
 */
function LiveSky({
  label,
  location = "geolocate",
  onLocationChange,
  fetchWeather = openMeteo.fetchWeather,
  searchPlaces = openMeteo.searchPlaces,
  onWeather,
  refreshMs = defaultRefreshMs,
  simulate,
  photo,
  onPhotoChange,
  glass = true,
  locale,
  labels: overrides,
  className,
  onFrame,
}: LiveSkyProps) {
  const labels = useMemo(() => mergedLabels(overrides), [overrides])
  const summaryId = useId()
  const stage = useRef<HTMLDivElement>(null)
  const [locating, setLocating] = useState(false)
  const [locateFailed, setLocateFailed] = useState(false)
  const given = typeof location === "object" ? location : null
  const givenKey = given ? `${String(given.latitude)},${String(given.longitude)},${given.name ?? ""}` : "geolocate"
  const [chosen, setChosen] = useState<{ from: string; location: SkyLocation } | null>(null)
  const picked = chosen?.from === givenKey ? chosen.location : given
  const photoScene = useLiveSkyPhoto({ photo, onPhotoChange, location: simulate?.location ?? picked })
  const photoPlace = photoScene.place ? { ...photoScene.place, name: labels.photoPlace } : null
  const place = simulate?.location ?? picked ?? photoPlace
  const shownPlace = place ? roundedLocation(place) : placeFromClock()
  const [calibrating, setCalibrating] = useState<{ src: string; open: boolean } | null>(null)
  const photoReady = photo !== undefined && photoScene.status === "ready"
  const calibrationOpen = photoReady && (calibrating?.src === photo.src ? calibrating.open : !photoScene.headingKnown)

  const { snapshot, refresh } = useLiveSkyWeather(
    stage,
    simulate || !place ? null : { location: shownPlace, fetchWeather, refreshMs, onWeather },
  )
  const simulatedTime = simulate ? new Date(simulate.time).getTime() : undefined
  const now = useSkyTime(simulatedTime)
  const weather = simulate ? { ...fairWeather, time: now, ...simulate.weather } : snapshot.weather
  const conditions = skyConditions(weather ?? fairWeather, shownPlace, new Date(now))
  useLiveSkyScene(stage, {
    conditions,
    location: shownPlace,
    glass,
    onFrame,
    photo: photoScene.shown,
    awaitingPhoto: photoScene.status === "reading",
  })

  const geolocation = useLiveSkyGeolocation({
    autoLocate: location === "geolocate" && !picked && !simulate,
    onLocated: (found) => choose({ ...found, name: labels.here }),
  })

  function choose(next: SkyLocation) {
    setChosen({ from: givenKey, location: next })
    onLocationChange?.(next)
  }
  const locate = () => {
    setLocating(true)
    setLocateFailed(false)
    return geolocation.locate().then(
      (found) => {
        setLocating(false)
        const named = { ...found, name: labels.here }
        choose(named)
        return named
      },
      (error: unknown) => {
        setLocating(false)
        setLocateFailed(true)
        throw error
      },
    )
  }
  const searchFor = (name: string) => {
    if (!searchPlaces) return Promise.reject(new Error("This sky has no place search."))
    return searchPlaces(name, { signal: new AbortController().signal }).then((results: SkyPlace[]) => {
      const first = results[0]
      if (!first) throw new Error(labels.noPlaces(name))
      choose(first)
      return first
    })
  }

  const calibrate = (view: { heading: number; fov?: number | undefined; horizon?: number | undefined }) =>
    photoScene.setView({
      heading: view.heading,
      ...(view.fov === undefined ? {} : { fov: view.fov }),
      ...(view.horizon === undefined ? {} : { horizon: view.horizon }),
    })
  const status: LiveSkyState["status"] = simulate ? "simulated" : snapshot.status
  const format = formatters(locale)
  const placeName = place ? (place.name ?? coordinates(place, locale)) : null
  const ready = weather !== null && place !== null
  const conditionText = labels.conditions[conditions.condition]
  const temperature = format.temperature.format(conditions.temperature)
  const summary = ready
    ? labels.summary({
        condition: conditionText,
        temperature,
        sun: labels.sun[conditions.sunState],
        place: placeName ?? "",
      })
    : place
      ? status === "error"
        ? labels.failed
        : labels.loading
      : labels.noPlace

  return (
    <LiveSkyRoot
      aria-label={label}
      aria-describedby={summaryId}
      summary={summary}
      place={placeName ?? ""}
      simulated={Boolean(simulate)}
      hasLocation={place !== null}
      geolocation={geolocation.access}
      handlers={{
        setLocation: choose,
        searchPlace: searchPlaces ? searchFor : undefined,
        geolocate: locate,
        refresh,
        calibrate: photo ? calibrate : undefined,
      }}
      data-status={status}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className({ status }) : className,
      )}
    >
      <div
        ref={stage}
        data-slot="live-sky-scene"
        data-rain={conditions.rainKind}
        data-photo={photo ? "" : undefined}
        data-marking={photoScene.marking ? "" : undefined}
        aria-hidden="true"
        style={photo ? cssVars({ "--live-sky-aspect": String(photoScene.aspect) }) : undefined}
        onPointerDown={photoScene.onPointerDown}
      />
      {calibrationOpen ? (
        <div className="px-inset-surface pt-inset-surface">
          <LiveSkyCalibration
            view={photoScene.view}
            marking={photoScene.marking}
            labels={labels}
            onView={photoScene.setView}
            onMarking={photoScene.setMarking}
            format={(value) => new Intl.NumberFormat(locale).format(value)}
          />
        </div>
      ) : null}
      <div data-slot="live-sky-panel" className="flex flex-wrap items-start justify-between gap-group p-inset-surface">
        <div className="flex min-w-48 grow basis-0 flex-col gap-inline">
          <LiveSkyHeading
            place={placeName ?? labels.noPlace}
            simulated={Boolean(simulate)}
            calibratable={photo && photoReady ? photo.src : null}
            calibrationOpen={calibrationOpen}
            onCalibrating={setCalibrating}
            labels={labels}
          />
          {photoScene.status === "reading" || photoScene.status === "failed" ? (
            <span className="flex items-center gap-inline text-caption text-muted-foreground">
              {photoScene.status === "reading" ? <Spinner size="sm" /> : null}
              {photoScene.status === "reading" ? labels.readingPhoto : labels.photoFailed}
            </span>
          ) : null}
          {ready ? (
            <div className="flex flex-wrap items-baseline gap-x-items">
              <span className="text-display-sm tabular-nums">{temperature}</span>
              <span className="text-body text-muted-foreground">{conditionText}</span>
            </div>
          ) : place && status === "error" ? (
            <div className="flex flex-wrap items-center gap-items">
              <span className="text-body-sm text-muted-foreground">{labels.failed}</span>
              <Button size="sm" variant="outline" onClick={() => refresh().catch(() => undefined)}>
                {labels.retry}
              </Button>
            </div>
          ) : place ? (
            <span className="flex items-center gap-inline text-body-sm text-muted-foreground">
              <Spinner size="sm" />
              {labels.loading}
            </span>
          ) : null}
          {ready ? (
            <dl className="flex flex-wrap gap-x-group gap-y-inline text-body-sm">
              <div className="flex gap-inline">
                <dt className="text-muted-foreground">{labels.precipitation}</dt>
                <dd className="tabular-nums">{format.rate.format(weather.precipitation)}</dd>
              </div>
              <div className="flex gap-inline">
                <dt className="text-muted-foreground">{labels.wind}</dt>
                <dd className="tabular-nums">{format.wind.format(weather.windSpeed)}</dd>
              </div>
            </dl>
          ) : null}
          <p id={summaryId} className="sr-only" aria-live="polite">
            {summary}
          </p>
        </div>
        {simulate ? null : (
          <div className="flex w-full max-w-sm grow basis-64 flex-col gap-items">
            <div className="flex items-center gap-items">
              {searchPlaces ? (
                <div className="min-w-0 grow">
                  <LiveSkySearch searchPlaces={searchPlaces} onPlace={choose} labels={labels} />
                </div>
              ) : null}
              {place ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={labels.refresh}
                  loading={status === "refreshing" || status === "loading"}
                  onClick={() => refresh().catch(() => undefined)}
                >
                  <RefreshCwIcon />
                </Button>
              ) : null}
            </div>
            {location === "geolocate" ? (
              <div className="flex flex-wrap items-center gap-items">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={geolocation.access === "denied" || geolocation.access === "unsupported"}
                  loading={locating}
                  onClick={() => locate().catch(() => undefined)}
                >
                  <LocateFixedIcon />
                  {locating ? labels.locating : labels.geolocate}
                </Button>
                {geolocation.access === "denied" ? (
                  <span className="text-caption text-muted-foreground">{labels.locationDenied}</span>
                ) : locateFailed ? (
                  <span className="text-caption text-muted-foreground">{labels.locationFailed}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </LiveSkyRoot>
  )
}

export { LiveSky, liveSkyLabels }
export type { LiveSkyLabels, LiveSkyProps, LiveSkySimulation, LiveSkyState }
