"use client"

import type { ChangeSource } from "@ui-sdk/core"
import { usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { CheckIcon, MicIcon, MicOffIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"
import { useAudioLevel, type UseAudioLevelOptions } from "@/components/ui/use-audio-level"
import { useElapsedSeconds } from "@/components/ui/use-elapsed-seconds"
import {
  voiceInput,
  type VoiceInputOptions,
  type VoiceInputState,
  type VoiceInputStateChangeReason,
  type VoiceInputStateDetails,
} from "@/components/ui/voice-input-primitive"
import { elapsedDateTime, formatElapsed } from "@/lib/audio-level"
import { primeAudioContext } from "@/lib/audio-meter"
import type { Tone } from "@/lib/tone"
import { cn, cnState } from "@/lib/utils"

type VoiceInputLabels = {
  /** Names the group, which agents find the voice input by. */
  group: string
  /** Names the toggle that starts listening, and finishes while pressed. */
  toggle: string
  /** Describes the toggle while listening: pressing it now keeps what was said. */
  finish: string
  /** Names the button that stops and discards. */
  cancel: string
  /** Read before the elapsed time. */
  timer: string
  /** Each state's announcement, and the toggle's description in it. */
  requesting: string
  listening: string
  processing: string
  error: string
  denied: string
}

const voiceInputLabels: VoiceInputLabels = {
  group: "Voice input",
  toggle: "Dictate",
  finish: "Finish and keep what you said",
  cancel: "Cancel recording",
  timer: "Recording time",
  requesting: "Waiting for the microphone",
  listening: "Listening",
  processing: "Processing",
  error: "The microphone isn't available",
  denied: "Microphone access denied",
}

/** The tone each state shows in: a failure is destructive, everything else neutral. */
function voiceInputTone(state: VoiceInputState): Tone {
  return state === "error" || state === "denied" ? "destructive" : "neutral"
}

type VoiceInputVariant = "button" | "bar"

type VoiceInputRootState = { state: VoiceInputState; active: boolean; disabled: boolean }

type VoiceInputProps = Omit<PartProps<"div", VoiceInputRootState>, "children" | "ref" | "defaultValue"> &
  Omit<VoiceInputOptions, "announcements"> & {
    /** `button`: a mic toggle whose ring follows the level. `bar`: cancel, a live waveform, a timer and the toggle. */
    variant?: VoiceInputVariant
    /** The microphone's stream, from your own `getUserMedia` (or `requestMicrophone`); it's only read while listening. */
    stream?: MediaStream | null
    /** Asked when the toggle starts: get the microphone, then set `state` to `listening` (or `denied`, `error`). */
    onStart?: (details: VoiceInputStateDetails) => void
    /** Asked when listening finishes and what was said is kept: transcribe it, with `state` at `processing`. */
    onConfirm?: (details: VoiceInputStateDetails) => void
    /** Asked when it stops and discards, by the cancel button, Escape or the toggle while waiting: set `state` to `idle`. */
    onCancel?: (details: VoiceInputStateDetails) => void
    /** When listening started, as `Date.now()`: the bar's timer counts from it, rendering once a second. */
    startedAt?: number
    /** Seconds listened, when you keep the time yourself; wins over `startedAt`. */
    elapsed?: number
    /** How many level bars the bar variant draws, newest at the end. */
    bars?: number
    /** Tunes the level: `floorDb`, `ceilingDb`, `attack`, `release`, `barInterval`, `reducedMotionSteps`. */
    level?: Pick<
      UseAudioLevelOptions,
      "floorDb" | "ceilingDb" | "attack" | "release" | "barInterval" | "reducedMotionSteps"
    >
    labels?: Partial<VoiceInputLabels>
  }

const failureClassName = "border-destructive-border bg-destructive-soft text-destructive-soft-foreground"

function announcementsOf(labels: VoiceInputLabels): VoiceInputOptions["announcements"] {
  return {
    requesting: labels.requesting,
    listening: labels.listening,
    processing: labels.processing,
    error: labels.error,
    denied: labels.denied,
  }
}

function toggleDescription(state: VoiceInputState, labels: VoiceInputLabels) {
  if (state === "listening") return labels.finish
  if (state === "idle") return undefined
  return labels[state]
}

function ToggleIcon({ state, variant }: { state: VoiceInputState; variant: VoiceInputVariant }) {
  if (state === "requesting" || state === "processing") return <Spinner />
  if (state === "error" || state === "denied") return <MicOffIcon />
  if (state === "listening" && variant === "bar") return <CheckIcon />
  return <MicIcon />
}

function VoiceToggle({
  state,
  disabled,
  variant,
  labels,
  onToggle,
}: {
  state: VoiceInputState
  disabled: boolean
  variant: VoiceInputVariant
  labels: VoiceInputLabels
  onToggle: (event: Event | undefined, source: ChangeSource) => void
}) {
  const failed = voiceInputTone(state) === "destructive"
  return (
    <Toggle
      data-voice-input-toggle=""
      variant="outline"
      size="icon"
      aria-label={labels.toggle}
      tooltip={toggleDescription(state, labels)}
      pressed={state === "requesting" || state === "listening"}
      onPressedChange={(_pressed, details) => onToggle(details.event, details.source)}
      disabled={disabled || state === "processing"}
      focusableWhenDisabled
      aria-busy={state === "processing" || undefined}
      className={cn(
        "relative rounded-control data-disabled:opacity-100 data-disabled:[&_svg]:opacity-70",
        failed && failureClassName,
      )}
    >
      <ToggleIcon state={state} variant={variant} />
    </Toggle>
  )
}

// Perf: the halo scales with --voice-level, which the meter writes straight to the root: no render per frame.
function LevelGlow() {
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="voice-input-glow"
        className="pointer-events-none absolute inset-0 rounded-control bg-primary opacity-0 group-data-[state=listening]/voice-input:opacity-20"
        style={{ scale: "calc(1 + var(--voice-level, 0) * 0.7)" }}
      />
      <span
        aria-hidden="true"
        data-slot="voice-input-ring"
        className="pointer-events-none absolute inset-0 rounded-control bg-primary opacity-0 group-data-[state=listening]/voice-input:opacity-35"
        style={{ scale: "calc(1 + var(--voice-level, 0) * 0.35)" }}
      />
    </>
  )
}

function Waveform({ count, state }: { count: number; state: VoiceInputState }) {
  const bars = Array.from({ length: count }, (_, index) => `--voice-bar-${String(index)}`)
  return (
    <span
      aria-hidden="true"
      data-slot="voice-input-waveform"
      className={cn(
        "flex h-6 min-w-0 flex-1 items-center justify-center gap-inline overflow-hidden",
        state === "listening" ? "text-primary" : "text-muted-foreground",
      )}
    >
      {bars.map((name) => (
        <span
          key={name}
          data-slot="voice-input-bar"
          className="h-full w-0.75 shrink-0 rounded-full bg-current"
          style={{ scale: `1 max(0.12, var(${name}, 0))` }}
        />
      ))}
    </span>
  )
}

function Timer({ seconds, label }: { seconds: number; label: string }) {
  return (
    <span data-slot="voice-input-timer" className="shrink-0 font-mono text-caption text-muted-foreground tabular-nums">
      <span className="sr-only">{label} </span>
      <time dateTime={elapsedDateTime(seconds)}>{formatElapsed(seconds)}</time>
    </span>
  )
}

/**
 * A voice input whose visual follows the microphone, so people see they're heard. It neither records nor transcribes:
 * pass `stream` and `state`, act in `onStart`, `onConfirm` and `onCancel`. `button` is a mic toggle with a ring that
 * grows with the level; `bar` adds cancel, a live waveform and a timer. Agents `start`, `confirm` and `cancel` it.
 */
function VoiceInput({
  variant = "button",
  stream,
  state,
  defaultState,
  onStateChange,
  onStart,
  onConfirm,
  onCancel,
  disabled,
  startedAt,
  elapsed,
  bars = 24,
  level,
  labels: ownLabels,
  className,
  ...props
}: VoiceInputProps) {
  const labels = { ...voiceInputLabels, ...ownLabels }
  const handle = usePrimitive(voiceInput, {
    state,
    defaultState,
    disabled,
    announcements: announcementsOf(labels),
    onStateChange: (next: VoiceInputState, details: VoiceInputStateDetails) => {
      onStateChange?.(next, details)
      if (details.canceled) return
      if (next === "requesting") {
        primeAudioContext()
        onStart?.(details)
      } else if (next === "processing") onConfirm?.(details)
      else if (next === "idle") onCancel?.(details)
    },
  })
  const current = handle.state.state
  const meter = useAudioLevel(stream, {
    ...level,
    active: current === "listening",
    bars: variant === "bar" ? bars : 0,
  })
  const showsTime = variant === "bar" && (elapsed !== undefined || startedAt !== undefined)
  const counted = useElapsedSeconds(showsTime && elapsed === undefined ? startedAt : undefined, current === "listening")
  const seconds = elapsed ?? counted

  const toggle = (
    <VoiceToggle
      state={current}
      disabled={handle.state.disabled}
      variant={variant}
      labels={labels}
      onToggle={(event, source) => handle.api.toggle(event, source)}
    />
  )

  const children =
    variant === "bar" ? (
      <>
        {current === "requesting" || current === "listening" || current === "processing" ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={labels.cancel}
            onClick={(event) => handle.api.cancel(event.nativeEvent, "close-press")}
          >
            <XIcon />
          </Button>
        ) : null}
        {current === "error" || current === "denied" ? (
          <span data-slot="voice-input-message" className="min-w-0 flex-1 truncate px-inline text-body-sm">
            {labels[current]}
          </span>
        ) : (
          <Waveform count={bars} state={current} />
        )}
        {showsTime && current !== "idle" && current !== "error" && current !== "denied" ? (
          <Timer seconds={seconds} label={labels.timer} />
        ) : null}
        {toggle}
      </>
    ) : (
      <>
        <LevelGlow />
        {toggle}
      </>
    )

  return usePart(
    handle,
    "root",
    {},
    {
      ...props,
      ref: meter.ref,
      "aria-label": props["aria-label"] ?? labels.group,
      children,
      className: cnState(
        cn(
          "group/voice-input",
          variant === "bar"
            ? "flex w-full min-w-0 items-center gap-items rounded-control border border-input bg-background/(--glass-opacity) p-inline"
            : "relative inline-flex shrink-0",
          variant === "bar" && voiceInputTone(current) === "destructive" && failureClassName,
        ),
        className,
      ),
    },
    "div",
  )
}

export { VoiceInput, voiceInputLabels, voiceInputTone }
export type { VoiceInputLabels, VoiceInputProps, VoiceInputVariant }
export type { VoiceInputState, VoiceInputStateChangeReason, VoiceInputStateDetails }
