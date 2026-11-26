"use client"

import {
  Field as FieldPrimitive,
  FieldDescription as FieldDescriptionPrimitive,
  FieldLabel as FieldLabelPrimitive,
  useFieldControl,
} from "@ui-sdk/react/field"
import { TimeInput as TimeInputPrimitive } from "@ui-sdk/react/time-input"
import { useState, type ComponentProps } from "react"

import { DatePicker, type DatePickerLabels } from "@/components/ui/date-picker"
import { fieldSurfaceClassName, floatingLabelControls } from "@/components/ui/field"
import { cn, cnState } from "@/lib/utils"

type DateTimePickerLabels = DatePickerLabels & {
  /** Names the time input. */
  time?: string
}

type DateTimePickerProps = {
  /** A local date and time, `"2026-11-02T14:30"`, or `null`. */
  value?: string | null
  defaultValue?: string | null
  /** Runs once both the date and the time are set, and with `null` when either is cleared. */
  onValueChange?: (value: string | null) => void
  /** The earliest date and time, like `"2026-11-02T09:00"`. */
  min?: string
  max?: string
  /** The language of dates, times and the clock; the page's by default. */
  locale?: string
  /** The zone the value is in, like `"Europe/Madrid"`. Shown after the time; the value stays local. */
  timeZone?: string
  /** Names the date input, when no FieldLabel does. */
  label?: string
  labels?: DateTimePickerLabels
  hourCycle?: ComponentProps<typeof TimeInputPrimitive>["hourCycle"]
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

const defaultLabels = { time: "Time" }

function split(value: string | null | undefined) {
  if (!value) return { date: null, time: null }
  const [date = null, time = null] = value.split("T")
  return { date, time: time ? time.slice(0, 5) : null }
}

function zoneName(timeZone: string, locale?: string) {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((item) => item.type === "timeZoneName")
  return part?.value ?? timeZone
}

// Spec: at least 24px wide, so each segment stays a target (WCAG 2.5.8).
const segmentWidths =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- widths in ch: two digits, a year and a day period
  "[&_input[data-type]]:w-[2ch] [&_input[data-type=year]]:w-[4ch] [&_input[data-type=dayPeriod]]:w-[3ch] supports-[field-sizing:content]:[&_input[data-type]]:w-auto supports-[field-sizing:content]:[&_input[data-type]]:field-sizing-content [&_input[data-type]]:min-w-6 [&_input[data-type]]:self-stretch [&_input[data-type]]:text-center [&_input[data-type]]:relative [&_input[data-type]]:z-10 [&_[data-type=literal]]:-mx-px [&_[data-type=literal]]:pointer-events-none [&_[data-type=literal]]:whitespace-pre"

function TimeInput({ className, ...props }: ComponentProps<typeof TimeInputPrimitive>) {
  return (
    <TimeInputPrimitive
      className={cnState(
        `${fieldSurfaceClassName} inline-flex h-field-control w-fit shrink-0 items-center rounded-control px-control-x text-entry tabular-nums has-focus-visible:ring-2 has-focus-visible:ring-ring aria-invalid:border-destructive data-invalid:border-destructive [&_[data-slot=time-input-segment]]:rounded-sm [&_[data-slot=time-input-segment]]:outline-none [&_[data-slot=time-input-segment][data-empty]]:text-muted-foreground [&_[data-slot=time-input-segment]:focus]:bg-accent [&_[data-slot=time-input-segment]:focus]:text-accent-foreground [&_[data-slot=time-input-segment][data-type=literal]]:text-muted-foreground ${segmentWidths}`,
        className,
      )}
      {...props}
    />
  )
}

/** A date from the calendar and a time of day, as one local `"YYYY-MM-DDTHH:mm"` value. */
function DateTimePicker({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  locale,
  timeZone,
  label,
  labels,
  hourCycle,
  name,
  required,
  disabled,
  className,
}: DateTimePickerProps) {
  const text = { ...defaultLabels, ...labels }
  const outer = useFieldControl()
  const fieldAttributes: Record<string, unknown> | undefined = outer?.props({})
  const invalid = fieldAttributes ? Boolean(fieldAttributes["aria-invalid"]) || undefined : undefined
  const [parts, setParts] = useState(() => split(value ?? defaultValue))
  const [synced, setSynced] = useState(value)
  if (value !== undefined && value !== synced) {
    setSynced(value)
    const next = split(value)
    if (next.date !== parts.date || next.time !== parts.time) setParts(next)
  }

  const update = (next: { date: string | null; time: string | null }) => {
    setParts(next)
    const combined = next.date && next.time ? `${next.date}T${next.time}` : null
    const current = parts.date && parts.time ? `${parts.date}T${parts.time}` : null
    if (combined !== current) onValueChange?.(combined)
  }

  const lower = split(min)
  const upper = split(max)
  const combined = parts.date && parts.time ? `${parts.date}T${parts.time}` : ""
  return (
    <div data-slot="date-time-picker" className={cn("flex w-full min-w-0 flex-wrap items-start gap-items", className)}>
      <DatePicker
        label={label}
        labels={labels}
        locale={locale}
        timeZone={timeZone}
        min={lower.date ?? undefined}
        max={upper.date ?? undefined}
        value={parts.date}
        onValueChange={(date) => update({ ...parts, date: typeof date === "string" ? date : null })}
        required={required}
        disabled={disabled}
        className="w-auto min-w-0 flex-1 basis-40"
      />
      <FieldPrimitive invalid={invalid} disabled={disabled} className="flex items-center gap-inline">
        <FieldLabelPrimitive className="sr-only">{text.time}</FieldLabelPrimitive>
        <TimeInput
          locale={locale}
          hourCycle={hourCycle}
          min={parts.date !== null && parts.date === lower.date ? (lower.time ?? undefined) : undefined}
          max={parts.date !== null && parts.date === upper.date ? (upper.time ?? undefined) : undefined}
          value={parts.time}
          onValueChange={(time) => update({ ...parts, time: time ? time.slice(0, 5) : null })}
          required={required}
          disabled={disabled}
        />
        {timeZone === undefined ? null : (
          <FieldDescriptionPrimitive
            render={<p data-slot="date-time-picker-zone" />}
            className="text-sm text-muted-foreground"
          >
            {zoneName(timeZone, locale)}
          </FieldDescriptionPrimitive>
        )}
      </FieldPrimitive>
      {name === undefined ? null : <input type="hidden" name={name} value={combined} disabled={disabled} />}
    </div>
  )
}

floatingLabelControls.add(DateTimePicker)

export { DateTimePicker, TimeInput }
export type { DateTimePickerLabels, DateTimePickerProps }
