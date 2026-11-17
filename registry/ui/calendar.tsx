"use client"

import {
  Calendar as CalendarPrimitive,
  CalendarDay as CalendarDayPrimitive,
  CalendarGrid as CalendarGridPrimitive,
  CalendarHeading as CalendarHeadingPrimitive,
  CalendarNext as CalendarNextPrimitive,
  CalendarPrevious as CalendarPreviousPrimitive,
  CalendarWeekday as CalendarWeekdayPrimitive,
  CalendarWeekdays,
  CalendarWeeks,
  createCalendarController,
} from "@ui-sdk/react/calendar"
import type { ComponentProps } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cnState } from "@/lib/utils"

type CalendarLabels = { previousMonth?: string; nextMonth?: string }

function Chevron({ direction }: { direction: "previous" | "next" }) {
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon
  return <Icon className="rtl:rotate-180" />
}

const stepClassName = buttonVariants({ variant: "ghost", size: "icon" })

function CalendarPrevious({ className, children, ...props }: ComponentProps<typeof CalendarPreviousPrimitive>) {
  return (
    <CalendarPreviousPrimitive className={cnState(stepClassName, className)} {...props}>
      {children ?? <Chevron direction="previous" />}
    </CalendarPreviousPrimitive>
  )
}

function CalendarNext({ className, children, ...props }: ComponentProps<typeof CalendarNextPrimitive>) {
  return (
    <CalendarNextPrimitive className={cnState(stepClassName, className)} {...props}>
      {children ?? <Chevron direction="next" />}
    </CalendarNextPrimitive>
  )
}

function CalendarHeading({ className, ...props }: ComponentProps<typeof CalendarHeadingPrimitive>) {
  return (
    <CalendarHeadingPrimitive className={cnState("flex-1 text-center text-sm font-medium", className)} {...props} />
  )
}

function CalendarGrid({ className, ...props }: ComponentProps<typeof CalendarGridPrimitive>) {
  return (
    <CalendarGridPrimitive
      className={cnState("border-separate border-spacing-x-0 border-spacing-y-0.5 outline-none", className)}
      {...props}
    />
  )
}

function CalendarWeekday({ className, ...props }: ComponentProps<typeof CalendarWeekdayPrimitive>) {
  return (
    <CalendarWeekdayPrimitive
      className={cnState("size-control text-xs font-normal text-muted-foreground", className)}
      {...props}
    />
  )
}

// A range is one band: the middle days' own fill, and under each end a half band (::after) on the side the range
// continues, so it joins the end's circle (::before). Days touch within a week, so the band breaks only between weeks.
// ::before also draws the hover and the focus ring, so every day's ring follows its shape; a focused day rises
// above its neighbours so the ring isn't covered.
const dayClassName = [
  "relative isolate size-control cursor-pointer p-0 text-center text-sm tabular-nums outline-none",
  "before:absolute before:inset-0 before:-z-10 before:rounded-control before:transition-colors before:content-['']",
  "after:absolute after:inset-y-0 after:-z-20 after:content-none",
  "hover:text-accent-foreground hover:before:bg-accent",
  "focus-visible:z-10 focus-visible:before:outline-2 focus-visible:before:outline-offset-2 focus-visible:before:outline-ring",
  "data-today:font-semibold data-today:underline data-today:underline-offset-4",
  "data-outside:text-muted-foreground data-unavailable:line-through data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "data-selected:not-data-range-middle:text-primary-foreground data-selected:not-data-range-middle:before:bg-primary",
  "data-range-middle:bg-accent data-range-middle:text-accent-foreground data-range-middle:hover:before:bg-transparent",
  "data-range-start:not-data-range-end:after:start-1/2 data-range-start:not-data-range-end:after:end-0 data-range-start:not-data-range-end:after:bg-accent data-range-start:not-data-range-end:after:content-['']",
  "data-range-end:not-data-range-start:after:start-0 data-range-end:not-data-range-start:after:end-1/2 data-range-end:not-data-range-start:after:bg-accent data-range-end:not-data-range-start:after:content-['']",
].join(" ")

function CalendarDay({ className, ...props }: ComponentProps<typeof CalendarDayPrimitive>) {
  return <CalendarDayPrimitive className={cnState(dayClassName, className)} {...props} />
}

function CalendarMonths({ months = 1, labels }: { months?: number; labels?: CalendarLabels }) {
  return (
    <>
      <div data-slot="calendar-header" className="flex items-center gap-inline">
        <ControlTooltip label={labels?.previousMonth ?? "Previous month"}>
          <CalendarPrevious aria-label={labels?.previousMonth} />
        </ControlTooltip>
        <CalendarHeading />
        <ControlTooltip label={labels?.nextMonth ?? "Next month"}>
          <CalendarNext aria-label={labels?.nextMonth} />
        </ControlTooltip>
      </div>
      <div data-slot="calendar-months" className="flex flex-wrap gap-group">
        {Array.from({ length: months }, (_, offset) => (
          <CalendarGrid key={offset} offset={offset}>
            <CalendarWeekdays>{(index) => <CalendarWeekday index={index} />}</CalendarWeekdays>
            <CalendarWeeks>{(cell) => <CalendarDay value={cell.date} />}</CalendarWeeks>
          </CalendarGrid>
        ))}
      </div>
    </>
  )
}

type CalendarProps = ComponentProps<typeof CalendarPrimitive> & { labels?: CalendarLabels }

function Calendar({ className, children, labels, ...props }: CalendarProps) {
  return (
    <CalendarPrimitive
      className={cnState(
        "inline-flex flex-col gap-items rounded-surface border bg-card/(--glass-opacity) p-items text-card-foreground backdrop-surface",
        className,
      )}
      {...props}
    >
      {children ?? <CalendarMonths months={props.months} labels={labels} />}
    </CalendarPrimitive>
  )
}

export {
  Calendar,
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarMonths,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  createCalendarController,
}
export type { CalendarLabels, CalendarProps }
export type { CalendarMode, CalendarValue, DateMatchers } from "@ui-sdk/react/calendar"
