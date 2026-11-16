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
      className={cnState("border-separate border-spacing-0.5 outline-none", className)}
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

function CalendarDay({ className, ...props }: ComponentProps<typeof CalendarDayPrimitive>) {
  return (
    <CalendarDayPrimitive
      className={cnState(
        "size-control cursor-pointer rounded-control p-0 text-center text-sm tabular-nums outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-today:font-semibold data-today:underline data-today:underline-offset-4 data-outside:text-muted-foreground data-unavailable:line-through data-disabled:cursor-not-allowed data-disabled:opacity-50 data-selected:bg-primary data-selected:text-primary-foreground data-range-middle:rounded-none data-range-middle:bg-accent data-range-middle:text-accent-foreground data-preview:bg-accent data-preview:text-accent-foreground",
        className,
      )}
      {...props}
    />
  )
}

function CalendarMonths({ months = 1, labels }: { months?: number; labels?: CalendarLabels }) {
  return (
    <>
      <div data-slot="calendar-header" className="flex items-center gap-inline">
        <CalendarPrevious aria-label={labels?.previousMonth} />
        <CalendarHeading />
        <CalendarNext aria-label={labels?.nextMonth} />
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
