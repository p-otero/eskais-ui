"use client"

import {
  Select,
  SelectContent as SelectContentPrimitive,
  SelectGroup,
  SelectGroupLabel as SelectGroupLabelPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectItemIndicator as SelectItemIndicatorPrimitive,
  SelectLabel as SelectLabelPrimitive,
  SelectList,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
  createSelectController,
} from "@ui-sdk/react/select"
import type { ComponentProps } from "react"

import { fieldSurfaceClassName } from "@/components/ui/input"
import { cnState } from "@/lib/utils"

const triggerClassName = `${fieldSurfaceClassName} flex h-control w-full min-w-0 cursor-pointer items-center justify-between gap-inline rounded-control px-control-x text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground`

const listPopupClassName =
  "m-0 max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto overscroll-contain rounded-surface border bg-popover/(--glass-opacity) p-inline text-popover-foreground shadow-surface backdrop-surface outline-none transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0"

// A tint alone misses the 3:1 a state needs, so the highlight also draws a full ring.
const listItemClassName =
  "flex min-h-control-sm cursor-default items-center gap-inline rounded-control px-inset-item text-sm outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:ring-2 data-highlighted:ring-ring data-highlighted:ring-inset [&_svg]:size-4 [&_svg]:shrink-0"

const listIndicatorClassName = "ms-auto inline-flex items-center"

const listGroupLabelClassName = "px-inset-item py-inline text-xs font-medium text-muted-foreground"

const listSeparatorClassName = "-mx-inline my-inline h-px bg-border"

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function SelectLabel({ className, ...props }: ComponentProps<typeof SelectLabelPrimitive>) {
  return (
    <SelectLabelPrimitive
      className={cnState("text-sm font-medium select-none data-disabled:opacity-50", className)}
      {...props}
    />
  )
}

function SelectTrigger({ className, children, ...props }: ComponentProps<typeof SelectTriggerPrimitive>) {
  return (
    <SelectTriggerPrimitive className={cnState(triggerClassName, className)} {...props}>
      {typeof children === "function" ? (
        (state) => (
          <>
            {children(state)}
            <ChevronIcon />
          </>
        )
      ) : (
        <>
          {children}
          <ChevronIcon />
        </>
      )}
    </SelectTriggerPrimitive>
  )
}

function SelectValue({ className, ...props }: ComponentProps<typeof SelectValuePrimitive>) {
  return (
    <SelectValuePrimitive
      className={cnState("truncate data-placeholder:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectContent({ className, ...props }: ComponentProps<typeof SelectContentPrimitive>) {
  return <SelectContentPrimitive className={cnState(listPopupClassName, className)} {...props} />
}

function SelectItem<T = string>({ className, ...props }: ComponentProps<typeof SelectItemPrimitive<T>>) {
  return <SelectItemPrimitive<T> className={cnState(listItemClassName, className)} {...props} />
}

function SelectItemIndicator({ className, children, ...props }: ComponentProps<typeof SelectItemIndicatorPrimitive>) {
  return (
    <SelectItemIndicatorPrimitive className={cnState(listIndicatorClassName, className)} {...props}>
      {children ?? <CheckIcon />}
    </SelectItemIndicatorPrimitive>
  )
}

function SelectGroupLabel({ className, ...props }: ComponentProps<typeof SelectGroupLabelPrimitive>) {
  return <SelectGroupLabelPrimitive className={cnState(listGroupLabelClassName, className)} {...props} />
}

function SelectSeparator({ className, ...props }: ComponentProps<typeof SelectSeparatorPrimitive>) {
  return <SelectSeparatorPrimitive className={cnState(listSeparatorClassName, className)} {...props} />
}

export {
  CheckIcon,
  ChevronIcon,
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectList,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  createSelectController,
  listGroupLabelClassName,
  listIndicatorClassName,
  listItemClassName,
  listPopupClassName,
  listSeparatorClassName,
}
export type { ListData, SelectController, SelectItemState, SelectProps } from "@ui-sdk/react/select"
