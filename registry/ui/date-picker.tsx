"use client"

import {
  DatePicker as DatePickerPrimitive,
  DatePickerClear as DatePickerClearPrimitive,
  DatePickerContent as DatePickerContentPrimitive,
  DatePickerHint as DatePickerHintPrimitive,
  DatePickerInput as DatePickerInputPrimitive,
  DatePickerTrigger as DatePickerTriggerPrimitive,
  createDatePickerController,
} from "@ui-sdk/react/date-picker"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { CalendarMonths, type CalendarLabels } from "@/components/ui/calendar"
import { fieldSurfaceClassName } from "@/components/ui/input"
import { cn, cnState } from "@/lib/utils"

type DatePickerLabels = CalendarLabels & {
  start?: string
  end?: string
  trigger?: string
  clear?: string
}

const defaultLabels = { start: "Start date", end: "End date", clear: "Clear date" }

function DatePickerInput({ className, ...props }: ComponentProps<typeof DatePickerInputPrimitive>) {
  return (
    <DatePickerInputPrimitive
      className={cnState(
        "h-full w-full min-w-0 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

function DatePickerTrigger({ className, children, ...props }: ComponentProps<typeof DatePickerTriggerPrimitive>) {
  return (
    <DatePickerTriggerPrimitive
      className={cnState(cn(buttonVariants({ variant: "ghost", size: "icon" }), "-me-2 size-control-sm"), className)}
      {...props}
    >
      {children ?? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
      )}
    </DatePickerTriggerPrimitive>
  )
}

function DatePickerClear({ className, children, ...props }: ComponentProps<typeof DatePickerClearPrimitive>) {
  return (
    <DatePickerClearPrimitive
      className={cnState(
        cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-control-sm data-empty:hidden"),
        className,
      )}
      {...props}
    >
      {children ?? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )}
    </DatePickerClearPrimitive>
  )
}

function DatePickerHint({ className, ...props }: ComponentProps<typeof DatePickerHintPrimitive>) {
  return <DatePickerHintPrimitive className={cnState("text-xs text-muted-foreground", className)} {...props} />
}

function DatePickerContent({ className, ...props }: ComponentProps<typeof DatePickerContentPrimitive>) {
  return (
    <DatePickerContentPrimitive
      className={cnState(
        "z-50 m-0 flex flex-col gap-2 rounded-surface border bg-popover/(--glass-opacity) p-3 text-popover-foreground shadow-surface backdrop-surface outline-none origin-(--transform-origin) transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100 data-[presentation=sheet]:rounded-b-none",
        className,
      )}
      {...props}
    />
  )
}

type DatePickerProps = ComponentProps<typeof DatePickerPrimitive> & {
  label?: string
  labels?: DatePickerLabels
  hint?: boolean
  clearable?: boolean
  placeholder?: string
}

function DatePicker({
  label,
  labels,
  hint = true,
  clearable = false,
  placeholder,
  className,
  children,
  ...props
}: DatePickerProps) {
  const text = { ...defaultLabels, ...labels }
  const range = props.mode === "range"
  return (
    <DatePickerPrimitive className={cnState("flex w-full flex-col gap-1.5", className)} {...props}>
      {children ?? (
        <>
          <div
            data-slot="date-picker-group"
            className={`${fieldSurfaceClassName} flex h-control w-full items-center gap-2 rounded-control px-control-x text-sm has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-aria-invalid:border-destructive`}
          >
            <DatePickerInput aria-label={range ? text.start : label} placeholder={placeholder} />
            {range && (
              <>
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <DatePickerInput end aria-label={text.end} placeholder={placeholder} />
              </>
            )}
            {clearable && <DatePickerClear aria-label={text.clear} />}
            <DatePickerTrigger aria-label={text.trigger} />
          </div>
          {hint && <DatePickerHint />}
          <DatePickerContent>
            <CalendarMonths months={props.months} labels={labels} />
          </DatePickerContent>
        </>
      )}
    </DatePickerPrimitive>
  )
}

export {
  createDatePickerController,
  DatePicker,
  DatePickerClear,
  DatePickerContent,
  DatePickerHint,
  DatePickerInput,
  DatePickerTrigger,
}
export type { DatePickerLabels, DatePickerProps }
export type { DatePickerMode, DatePickerValue } from "@ui-sdk/react/date-picker"
