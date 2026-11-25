"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { Slider, SliderControl, SliderThumb, SliderTrack, type SliderValueChangeDetails } from "@ui-sdk/react/slider"
import { Toggle, ToggleIcon } from "@ui-sdk/react/toggle"
import { LockIcon, LockOpenIcon } from "lucide-react"
import { memo, useCallback, useMemo, useRef, useState } from "react"

import { evenly, rebalance, type MixerValues } from "@/components/ui/mixer-balance"
import { mixer } from "@/components/ui/mixer-primitive"
import { ControlTooltip } from "@/components/ui/tooltip"
import { useLocale } from "@/lib/locale"
import { cn, cssVars } from "@/lib/utils"

const { Root: MixerRoot } = createParts(mixer, { root: "div" })

/** A channel strip: `id` keys its value, `label` names its fader and is printed on its strip. */
type MixerChannel = { id: string; label: string }

type MixerLabels = {
  /** Names a channel's lock button; it gets the channel's label. */
  lock: (channel: string) => string
  /** The readout's term for the sum of every channel. */
  total: string
}

const mixerLabels: MixerLabels = {
  lock: (channel) => `Lock ${channel}`,
  total: "Total",
}

/** Why the values or the locks changed, and `cancel()` to keep them as they were. */
type MixerChangeDetails = {
  reason: string
  /** The channel moved by hand or by `setChannel`; undefined for `setAll`. */
  channel: string | undefined
  event: Event | undefined
  cancel: () => void
  readonly canceled: boolean
}

type MixerState = { disabled: boolean; values: MixerValues; locked: readonly string[] }

type MixerProps = {
  /** The accessible name of the mixer as a whole. */
  label: string
  channels: readonly MixerChannel[]
  /** Each channel's share by id. Pass it to control the mixer; the values should sum to `total`. */
  value?: MixerValues
  /** The total split evenly by default. */
  defaultValue?: MixerValues
  /** Runs on every step of a drag, a key or an agent's call, with every channel's new value. */
  onValueChange?: (values: MixerValues, details: MixerChangeDetails) => void
  /** Runs once a drag, a key press or an agent's call that changed the values ends, for saving. */
  onValueCommit?: (values: MixerValues) => void
  /** The ids of the channels rebalancing leaves put. Pass it to control the locks. */
  locked?: readonly string[]
  defaultLocked?: readonly string[]
  onLockedChange?: (locked: string[], details: MixerChangeDetails) => void
  /** What the channels always sum to; 100 by default. */
  total?: number
  /** The smallest change of a channel; 1 by default. Page Up and Page Down move ten steps. */
  step?: number
  /** How values read on the strips and for screen readers: `Intl.NumberFormat` options, or a function. */
  format?: Intl.NumberFormatOptions | ((value: number) => string)
  /** The locale values are written in; the page's `lang`, or the runtime's default without one. */
  locale?: string
  disabled?: boolean
  labels?: Partial<MixerLabels>
  /** Classes for the root; a function gets the mixer's state. */
  className?: string | ((state: MixerState) => string | undefined)
}

function details(reason: string, channel: string | undefined, event: Event | undefined): MixerChangeDetails {
  let canceled = false
  return {
    reason,
    channel,
    event,
    cancel: () => {
      canceled = true
    },
    get canceled() {
      return canceled
    },
  }
}

const noLocks: readonly string[] = []
const ledCount = 14
const leds = Array.from({ length: ledCount }, (_, index) => index)
const ledTone = (index: number) => (index >= ledCount - 2 ? "peak" : index >= ledCount - 5 ? "hot" : "signal")
const scaleMarks = [0, 0.25, 0.5, 0.75, 1]

type LockCommit = (id: string, lock: boolean, event: Event | undefined, reason?: string) => boolean

const ChannelHead = memo(function ChannelHead({
  id,
  number,
  name,
  pressed,
  disabled,
  onLock,
}: {
  id: string
  number: number
  name: string
  pressed: boolean
  disabled: boolean
  onLock: LockCommit
}) {
  return (
    <div data-slot="mixer-channel-head">
      <span data-slot="mixer-channel-number" aria-hidden="true">
        {number}
      </span>
      <ControlTooltip label={name}>
        <Toggle
          aria-label={name}
          pressed={pressed}
          disabled={disabled}
          onPressedChange={(next, change) => {
            if (!onLock(id, next, change.event, change.reason)) change.cancel()
          }}
          className="touch-target"
        >
          <ToggleIcon>{pressed ? <LockIcon /> : <LockOpenIcon />}</ToggleIcon>
        </Toggle>
      </ControlTooltip>
    </div>
  )
})

const Scale = memo(function Scale({ total, format }: { total: number; format: (value: number) => string }) {
  return (
    <div data-slot="mixer-scale" aria-hidden="true">
      {scaleMarks.map((mark) => (
        <span key={mark} style={cssVars({ "--mixer-mark": String(mark) })}>
          {format(mark * total)}
        </span>
      ))}
    </div>
  )
})

function useFormat(format: MixerProps["format"], locale: string | undefined) {
  return useMemo(() => {
    if (typeof format === "function") return format
    const number = new Intl.NumberFormat(locale, format ?? { maximumFractionDigits: 2 })
    return (value: number) => number.format(value)
  }, [format, locale])
}

/**
 * A mixing desk for splitting a total between channels: moving one fader moves the unlocked others in proportion, so
 * the channels always sum to `total`, and a locked channel stays put. Each fader is UI SDK's vertical slider, named by
 * its channel, with a level meter beside it; each lock is a toggle.
 */
function Mixer({
  label,
  channels,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  locked: lockedProp,
  defaultLocked = noLocks,
  onLockedChange,
  total = 100,
  step = 1,
  format,
  locale: localeProp,
  disabled = false,
  labels: labelOverrides,
  className,
}: MixerProps) {
  const labels = { ...mixerLabels, ...labelOverrides }
  const ids = channels.map((channel) => channel.id)
  const [ownValues, setOwnValues] = useState(() => defaultValue ?? evenly(ids, total, step))
  const [ownLocked, setOwnLocked] = useState<readonly string[]>(defaultLocked)
  const values = value ?? ownValues
  const locked = lockedProp ?? ownLocked
  const latest = useRef(values)
  const anchor = useRef<MixerValues | null>(null)
  const locale = useLocale(localeProp)
  const formatValue = useFormat(format, locale)
  const balance = { ids, values, locked: new Set(locked), total, step }

  const apply = (next: MixerValues, change: MixerChangeDetails) => {
    onValueChange?.(next, change)
    if (change.canceled) return false
    latest.current = next
    setOwnValues(next)
    return true
  }

  const commit = (next: MixerValues, { channel, event }: { channel: string | undefined; event: Event | undefined }) => {
    const done = apply(next, details("imperative", channel, event))
    if (done) onValueCommit?.(next)
    return done
  }

  const commitLock = useCallback<LockCommit>(
    (id, lock, event, reason = "imperative") => {
      const next = lock ? [...locked.filter((other) => other !== id), id] : locked.filter((other) => other !== id)
      const change = details(reason, id, event)
      onLockedChange?.(next, change)
      if (change.canceled) return false
      setOwnLocked(next)
      return true
    },
    [locked, onLockedChange],
  )

  const onFader = (id: string) => (next: number, change: SliderValueChangeDetails) => {
    if (anchor.current === null) anchor.current = values
    const moved = apply(rebalance(balance, id, next, anchor.current), details(change.reason, id, change.event))
    if (!moved) change.cancel()
  }

  const onFaderCommit = () => {
    anchor.current = null
    onValueCommit?.(latest.current)
  }

  const state = { disabled, values, locked }
  const sum = ids.reduce((all, id) => all + (values[id] ?? 0), 0)

  return (
    <MixerRoot
      channels={channels}
      values={values}
      locked={locked}
      total={total}
      step={step}
      disabled={disabled}
      commit={commit}
      commitLock={commitLock}
      aria-label={label}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-surface border bg-card text-card-foreground shadow-surface",
        typeof className === "function" ? className(state) : className,
      )}
    >
      <div data-slot="mixer-desk" data-disabled={disabled ? "" : undefined}>
        <div data-slot="mixer-strips">
          {channels.map((channel, index) => {
            const level = values[channel.id] ?? 0
            const isLocked = locked.includes(channel.id)
            const lit = Math.round((level / total) * ledCount)
            return (
              <div
                key={channel.id}
                data-slot="mixer-channel"
                data-locked={isLocked ? "" : undefined}
                style={cssVars({ "--mixer-level": (level / total).toFixed(4) })}
              >
                <ChannelHead
                  id={channel.id}
                  number={index + 1}
                  name={labels.lock(channel.label)}
                  pressed={isLocked}
                  disabled={disabled}
                  onLock={commitLock}
                />
                <div data-slot="mixer-fader">
                  <Scale total={total} format={formatValue} />
                  <Slider
                    value={level}
                    onValueChange={onFader(channel.id)}
                    onValueCommit={onFaderCommit}
                    orientation="vertical"
                    min={0}
                    max={total}
                    step={step}
                    largeStep={step * 10}
                    disabled={disabled}
                    readOnly={isLocked}
                    format={formatValue}
                    locale={locale}
                    className="h-full"
                  >
                    <SliderControl className="h-full">
                      <SliderTrack>
                        <SliderThumb aria-label={channel.label} className="touch-target" />
                      </SliderTrack>
                    </SliderControl>
                  </Slider>
                  <div data-slot="mixer-meter" aria-hidden="true">
                    {leds.map((led) => (
                      <span key={led} data-tone={ledTone(led)} data-lit={led < lit ? "" : undefined} />
                    ))}
                  </div>
                </div>
                <output data-slot="mixer-value" aria-hidden="true">
                  {formatValue(level)}
                </output>
                <span data-slot="mixer-label" title={channel.label}>
                  {channel.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <dl className="flex items-baseline justify-between gap-group px-inset-surface py-inset-item">
        <dt className="text-meta tracking-meta text-muted-foreground uppercase">{labels.total}</dt>
        <dd className="font-mono text-title-sm tabular-nums">{formatValue(Math.round(sum * 1e6) / 1e6)}</dd>
      </dl>
    </MixerRoot>
  )
}

export { Mixer, mixerLabels }
export type { MixerChangeDetails, MixerChannel, MixerLabels, MixerProps, MixerState, MixerValues }
