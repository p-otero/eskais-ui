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
import { Toggle, ToggleIcon } from "@ui-sdk/react/toggle"
import { PauseIcon, PlayIcon } from "lucide-react"
import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react"

import { ControlTooltip } from "@/components/ui/tooltip"
import { useVinylClock } from "@/components/ui/use-vinyl-clock"
import { useVinylMedia } from "@/components/ui/use-vinyl-media"
import { secondsPerTurn, useVinylScene } from "@/components/ui/use-vinyl-scene"
import { vinylScrubber } from "@/components/ui/vinyl-scrubber-primitive"
import { cn } from "@/lib/utils"

const { Root: VinylScrubberRoot } = createParts(vinylScrubber, { root: "div" })

type VinylScrubberLabels = {
  /** Names the timeline, a slider in seconds, for screen readers and agents. */
  position: string
  /** Names the play button, which stays pressed while it plays. */
  play: string
}

const vinylScrubberLabels: VinylScrubberLabels = { position: "Position", play: "Play" }

/** Why the position or playback changed (`drag`, `step-key`, `scratch`, `imperative`…), and `cancel()` to keep it. */
type VinylChangeDetails = {
  reason: string
  event: Event | undefined
  cancel: () => void
  readonly canceled: boolean
}

type VinylScrubberState = { disabled: boolean; playing: boolean; time: number; duration: number }

type VinylScrubberProps = {
  /** The accessible name of the player as a whole. */
  label: string
  /** The audio or video it controls: it follows its time and playback, and seeks, plays and pauses it. */
  media?: RefObject<HTMLMediaElement | null>
  /** The position in seconds. Pass it to control the scrubber. */
  value?: number
  defaultValue?: number
  /** The length in seconds; read from `media` without it. */
  duration?: number
  /** Runs on every step of a drag, a scratch, a key or an agent's seek. */
  onValueChange?: (seconds: number, details: VinylChangeDetails) => void
  /** Whether it plays. Pass it to control playback. */
  playing?: boolean
  defaultPlaying?: boolean
  onPlayingChange?: (playing: boolean, details: VinylChangeDetails) => void
  /** Loudness along the track, each from 0 to 1, drawn as the waveform; a plain groove without them. */
  peaks?: readonly number[]
  /** Seconds per arrow key; 5 by default. Page Up and Page Down move 30. */
  step?: number
  /** Printed on the record's label. */
  title?: string
  disabled?: boolean
  labels?: Partial<VinylScrubberLabels>
  /** Classes for the root; a function gets the player's state. */
  className?: string | ((state: VinylScrubberState) => string | undefined)
  /** Called with each paint's duration in ms, for measuring. */
  onPaint?: (milliseconds: number) => void
}

function details(reason: string, event: Event | undefined): VinylChangeDetails {
  let canceled = false
  return {
    reason,
    event,
    cancel: () => {
      canceled = true
    },
    get canceled() {
      return canceled
    },
  }
}

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return hours > 0 ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${rest}` : `${String(minutes)}:${rest}`
}

const maxBars = 180

function waveformPath(peaks: readonly number[]) {
  const bars = Math.min(maxBars, peaks.length)
  const bucket = peaks.length / bars
  const parts: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    let loudest = 0
    for (
      let index = Math.floor(bar * bucket);
      index < Math.max(Math.floor((bar + 1) * bucket), Math.floor(bar * bucket) + 1);
      index++
    ) {
      loudest = Math.max(loudest, Math.abs(peaks[index] ?? 0))
    }
    const height = Math.max(2, Math.min(1, loudest) * 92)
    parts.push(`M${(bar + 0.18).toFixed(2)} ${(50 - height / 2).toFixed(2)}h0.64v${height.toFixed(2)}h-0.64z`)
  }
  return { bars, d: parts.join("") }
}

const Waveform = memo(function Waveform({ peaks }: { peaks: readonly number[] | undefined }) {
  const wave = useMemo(() => (peaks && peaks.length > 0 ? waveformPath(peaks) : null), [peaks])
  if (!wave) return <div data-slot="vinyl-groove" aria-hidden="true" />
  return (
    <div data-slot="vinyl-waveform" aria-hidden="true">
      {/* oxlint-disable-next-line eskais/no-inline-icons -- the track's waveform, drawn from its peaks, not an icon */}
      <svg viewBox={`0 0 ${String(wave.bars)} 100`} preserveAspectRatio="none">
        <path d={wave.d} />
      </svg>
      {/* oxlint-disable-next-line eskais/no-inline-icons -- the played part of the same waveform, not an icon */}
      <svg data-played="" viewBox={`0 0 ${String(wave.bars)} 100`} preserveAspectRatio="none">
        <path d={wave.d} />
      </svg>
    </div>
  )
})

const Record = memo(function Record({ title }: { title: string | undefined }) {
  return (
    <div data-slot="vinyl-record" aria-hidden="true">
      <div data-slot="vinyl-label">{title ? <span>{title}</span> : null}</div>
    </div>
  )
})

type Scratch = { pointer: number; from: number; time: number; resume: boolean }

function seekMedia(element: HTMLMediaElement | null | undefined, seconds: number) {
  if (element) element.currentTime = seconds
}

function playMedia(element: HTMLMediaElement | null | undefined, playing: boolean, onRefused: () => void) {
  if (!element) return
  if (playing) element.play().catch(onRefused)
  else element.pause()
}

function angleOn(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - (rect.left + rect.width / 2)
  const y = event.clientY - (rect.top + rect.height / 2)
  return { angle: (Math.atan2(y, x) * 180) / Math.PI, distance: Math.hypot(x, y), radius: rect.width / 2 }
}

/**
 * A media timeline drawn as a turntable: the record turns with the position and a drag on it scratches back and
 * forth, the tonearm follows the track, and a waveform strip under it is UI SDK's slider in seconds (arrows by
 * `step`, Page Up and Down 30 s, Home and End). It controls an `HTMLMediaElement` through `media`, or works controlled.
 */
function VinylScrubber({
  label,
  media,
  value,
  defaultValue = 0,
  duration: durationProp,
  onValueChange,
  playing: playingProp,
  defaultPlaying = false,
  onPlayingChange,
  peaks,
  step = 5,
  title,
  disabled = false,
  labels: labelOverrides,
  className,
  onPaint,
}: VinylScrubberProps) {
  const labels = { ...vinylScrubberLabels, ...labelOverrides }
  const reading = useVinylMedia(media)
  const [ownTime, setOwnTime] = useState(defaultValue)
  const [ownPlaying, setOwnPlaying] = useState(defaultPlaying)
  const [slider] = useState(() => createSliderController<number>())
  const duration = durationProp ?? reading?.duration ?? 0
  const time = Math.min(duration || Infinity, value ?? (reading ? reading.time : ownTime))
  const playing = playingProp ?? (reading ? reading.playing : ownPlaying)
  const deck = useRef<HTMLDivElement>(null)
  const scratch = useRef<Scratch | null>(null)
  const [scratching, setScratching] = useState(false)
  useVinylScene(deck, { time, duration, playing: playing && !scratching, onPaint })

  const seek = (seconds: number, reason: string, event: Event | undefined) => {
    const next = Math.max(0, Math.min(duration, seconds))
    const change = details(reason, event)
    onValueChange?.(next, change)
    if (change.canceled) return false
    seekMedia(media?.current, next)
    setOwnTime(next)
    return true
  }

  const setPlaying = (next: boolean, reason: string, event: Event | undefined) => {
    const change = details(reason, event)
    onPlayingChange?.(next, change)
    if (change.canceled) return false
    playMedia(media?.current, next, () => setOwnPlaying(false))
    setOwnPlaying(next)
    return true
  }

  useVinylClock(playing && !media && value === undefined && !scratching && duration > 0, (seconds) => {
    const next = Math.min(duration, ownTime + seconds)
    seek(next, "playback", undefined)
    if (next >= duration) setPlaying(false, "playback", undefined)
  })

  const onSlider = (next: number, change: SliderValueChangeDetails) => {
    if (!seek(next, change.reason, change.event)) change.cancel()
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0 || duration <= 0) return
    const { angle, distance, radius } = angleOn(event)
    if (distance > radius) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const resume = playing
    if (resume) playMedia(media?.current, false, () => {})
    scratch.current = { pointer: event.pointerId, from: angle, time, resume }
    setScratching(true)
    slider.focus()
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const active = scratch.current
    if (active?.pointer !== event.pointerId) return
    const { angle } = angleOn(event)
    const delta = ((((angle - active.from + 180) % 360) + 360) % 360) - 180
    active.from = angle
    active.time = Math.max(0, Math.min(duration, active.time + (delta / 360) * secondsPerTurn))
    seek(active.time, "scratch", event.nativeEvent)
  }

  const endScratch = (event: ReactPointerEvent<HTMLElement>) => {
    const ended = scratch.current
    if (ended?.pointer !== event.pointerId) return
    scratch.current = null
    setScratching(false)
    if (ended.resume) playMedia(media?.current, true, () => setOwnPlaying(false))
  }

  const state = { disabled, playing, time, duration }

  return (
    <VinylScrubberRoot
      duration={duration}
      playing={playing}
      disabled={disabled}
      seek={(seconds, event) => seek(seconds, "imperative", event)}
      setPlaying={(next, event) => setPlaying(next, "imperative", event)}
      aria-label={label}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className(state) : className,
      )}
    >
      <div
        ref={deck}
        data-slot="vinyl-deck"
        data-playing={playing && !scratching ? "" : undefined}
        data-scratching={scratching ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
      >
        <div
          data-slot="vinyl-turntable"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endScratch}
          onPointerCancel={endScratch}
        >
          <div data-slot="vinyl-platter" aria-hidden="true" />
          <Record title={title} />
          <div data-slot="vinyl-sheen" aria-hidden="true" />
          <div data-slot="vinyl-arm" aria-hidden="true">
            <div data-slot="vinyl-arm-base" />
            <div data-slot="vinyl-arm-tube" />
            <div data-slot="vinyl-arm-head" />
            <div data-slot="vinyl-arm-weight" />
          </div>
        </div>
        <div data-slot="vinyl-panel">
          <div data-slot="vinyl-time">
            <output aria-hidden="true">{clock(time)}</output>
            <span aria-hidden="true">{`/ ${clock(duration)}`}</span>
          </div>
          <Slider
            controller={slider}
            value={time}
            onValueChange={onSlider}
            min={0}
            max={Math.max(duration, step)}
            step={step}
            largeStep={Math.max(step, Math.round(30 / step) * step)}
            disabled={disabled || duration <= 0}
            format={(seconds: number) => `${clock(seconds)} / ${clock(duration)}`}
          >
            <SliderControl data-peaks={peaks && peaks.length > 0 ? "" : undefined}>
              <Waveform peaks={peaks} />
              <SliderTrack>
                <SliderThumb aria-label={labels.position} className="touch-target" />
              </SliderTrack>
            </SliderControl>
          </Slider>
          <ControlTooltip label={labels.play}>
            <Toggle
              aria-label={labels.play}
              pressed={playing}
              disabled={disabled || duration <= 0}
              onPressedChange={(next, change) => {
                if (!setPlaying(next, change.reason, change.event)) change.cancel()
              }}
            >
              <ToggleIcon>{playing ? <PauseIcon /> : <PlayIcon />}</ToggleIcon>
            </Toggle>
          </ControlTooltip>
        </div>
      </div>
    </VinylScrubberRoot>
  )
}

export { VinylScrubber, vinylScrubberLabels }
export type { VinylChangeDetails, VinylScrubberLabels, VinylScrubberProps, VinylScrubberState }
