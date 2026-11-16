"use client"

import {
  Combobox,
  ComboboxClear as ComboboxClearPrimitive,
  ComboboxContent as ComboboxContentPrimitive,
  ComboboxEmpty as ComboboxEmptyPrimitive,
  ComboboxGroup,
  ComboboxGroupLabel as ComboboxGroupLabelPrimitive,
  ComboboxInput as ComboboxInputPrimitive,
  ComboboxItem as ComboboxItemPrimitive,
  ComboboxItemIndicator as ComboboxItemIndicatorPrimitive,
  ComboboxList,
  ComboboxSeparator as ComboboxSeparatorPrimitive,
  ComboboxTrigger as ComboboxTriggerPrimitive,
  createComboboxController,
} from "@ui-sdk/react/combobox"
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import type { ComponentProps } from "react"

import { floatingLabelControls, useFloatingPlaceholder } from "@/components/ui/field"
import { fieldSurfaceClassName } from "@/components/ui/input"
import {
  CheckIcon,
  ChevronIcon,
  listGroupLabelClassName,
  listIndicatorClassName,
  listItemClassName,
  listPopupClassName,
  listSeparatorClassName,
} from "@/components/ui/select"
import { cn, cnState } from "@/lib/utils"

const iconButtonClassName =
  "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed [&_svg]:size-4"

function ComboboxControl({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "combobox-control",
      className: cn(
        fieldSurfaceClassName,
        "flex h-field-control w-full min-w-0 items-center gap-inline rounded-control ps-control-x pe-inline text-sm has-aria-invalid:border-destructive has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring",
        className,
      ),
      ...props,
    },
    render,
  )
}

function ComboboxInput({ className, placeholder, ...props }: ComponentProps<typeof ComboboxInputPrimitive>) {
  return (
    <ComboboxInputPrimitive
      placeholder={useFloatingPlaceholder(placeholder)}
      className={cnState(
        "h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

function ComboboxTrigger({
  className,
  children,
  "aria-label": ariaLabel = "Show options",
  ...props
}: ComponentProps<typeof ComboboxTriggerPrimitive>) {
  return (
    <ComboboxTriggerPrimitive
      aria-label={ariaLabel}
      className={cnState(`${iconButtonClassName} data-open:[&_svg]:rotate-180`, className)}
      {...props}
    >
      {children ?? <ChevronIcon />}
    </ComboboxTriggerPrimitive>
  )
}

function ComboboxClear({
  className,
  children,
  "aria-label": ariaLabel = "Clear",
  ...props
}: ComponentProps<typeof ComboboxClearPrimitive>) {
  return (
    <ComboboxClearPrimitive aria-label={ariaLabel} className={cnState(iconButtonClassName, className)} {...props}>
      {children ?? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )}
    </ComboboxClearPrimitive>
  )
}

function ComboboxContent({ className, ...props }: ComponentProps<typeof ComboboxContentPrimitive>) {
  return <ComboboxContentPrimitive className={cnState(listPopupClassName, className)} {...props} />
}

function ComboboxEmpty({ className, ...props }: ComponentProps<typeof ComboboxEmptyPrimitive>) {
  return (
    <ComboboxEmptyPrimitive
      className={cnState("px-inset-item py-inset-item text-sm text-muted-foreground empty:hidden", className)}
      {...props}
    />
  )
}

function ComboboxItem<T = string>({ className, ...props }: ComponentProps<typeof ComboboxItemPrimitive<T>>) {
  return <ComboboxItemPrimitive<T> className={cnState(listItemClassName, className)} {...props} />
}

function ComboboxItemIndicator({
  className,
  children,
  ...props
}: ComponentProps<typeof ComboboxItemIndicatorPrimitive>) {
  return (
    <ComboboxItemIndicatorPrimitive className={cnState(listIndicatorClassName, className)} {...props}>
      {children ?? <CheckIcon />}
    </ComboboxItemIndicatorPrimitive>
  )
}

function ComboboxGroupLabel({ className, ...props }: ComponentProps<typeof ComboboxGroupLabelPrimitive>) {
  return <ComboboxGroupLabelPrimitive className={cnState(listGroupLabelClassName, className)} {...props} />
}

function ComboboxSeparator({ className, ...props }: ComponentProps<typeof ComboboxSeparatorPrimitive>) {
  return <ComboboxSeparatorPrimitive className={cnState(listSeparatorClassName, className)} {...props} />
}

floatingLabelControls.add(Combobox)

export {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  createComboboxController,
}
export type { ComboboxController, ComboboxItemState, ComboboxProps, ListData } from "@ui-sdk/react/combobox"
