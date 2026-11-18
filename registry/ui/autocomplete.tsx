"use client"

import {
  Autocomplete,
  AutocompleteClear as AutocompleteClearPrimitive,
  AutocompleteContent as AutocompleteContentPrimitive,
  AutocompleteEmpty as AutocompleteEmptyPrimitive,
  AutocompleteGroup,
  AutocompleteGroupLabel as AutocompleteGroupLabelPrimitive,
  AutocompleteInput as AutocompleteInputPrimitive,
  AutocompleteItem as AutocompleteItemPrimitive,
  AutocompleteItemIcon as AutocompleteItemIconPrimitive,
  AutocompleteItemText as AutocompleteItemTextPrimitive,
  AutocompleteList,
  AutocompleteSeparator as AutocompleteSeparatorPrimitive,
  AutocompleteStatus as AutocompleteStatusPrimitive,
  AutocompleteTrigger as AutocompleteTriggerPrimitive,
  createAutocompleteController,
} from "@ui-sdk/react/autocomplete"
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import type { ComponentProps } from "react"
import { ChevronDownIcon, XIcon } from "lucide-react"

import { floatingLabelControls, formControlAdapters, useFloatingPlaceholder } from "@/components/ui/field"
import { fieldSurfaceClassName } from "@/components/ui/input"
import {
  listGroupLabelClassName,
  listItemClassName,
  listPopupClassName,
  listSeparatorClassName,
} from "@/components/ui/select"
import { ControlTooltip, type ControlTooltipOption } from "@/components/ui/tooltip"
import { cn, cnState } from "@/lib/utils"

const iconButtonClassName =
  "touch-target inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed [&_svg]:size-4"

/** The field's box around the input and its Clear and Trigger buttons. Put the input first. */
function AutocompleteControl({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "autocomplete-control",
      className: cn(
        fieldSurfaceClassName,
        "flex h-field-control w-full min-w-0 items-center gap-inline rounded-control ps-control-x pe-inline text-entry has-aria-invalid:border-destructive has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring",
        className,
      ),
      ...props,
    },
    render,
  )
}

function AutocompleteInput({ className, placeholder, ...props }: ComponentProps<typeof AutocompleteInputPrimitive>) {
  return (
    <AutocompleteInputPrimitive
      placeholder={useFloatingPlaceholder(placeholder)}
      className={cnState(
        "h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

function AutocompleteTrigger({
  className,
  children,
  "aria-label": ariaLabel = "Show suggestions",
  tooltip,
  ...props
}: ComponentProps<typeof AutocompleteTriggerPrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <AutocompleteTriggerPrimitive
        aria-label={ariaLabel}
        className={cnState(`${iconButtonClassName} data-open:[&_svg]:rotate-180`, className)}
        {...props}
      >
        {children ?? <ChevronDownIcon />}
      </AutocompleteTriggerPrimitive>
    </ControlTooltip>
  )
}

function AutocompleteClear({
  className,
  children,
  "aria-label": ariaLabel = "Clear",
  tooltip,
  ...props
}: ComponentProps<typeof AutocompleteClearPrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <AutocompleteClearPrimitive aria-label={ariaLabel} className={cnState(iconButtonClassName, className)} {...props}>
        {children ?? <XIcon />}
      </AutocompleteClearPrimitive>
    </ControlTooltip>
  )
}

function AutocompleteContent({ className, ...props }: ComponentProps<typeof AutocompleteContentPrimitive>) {
  return <AutocompleteContentPrimitive className={cnState(listPopupClassName, className)} {...props} />
}

const messageClassName = "px-inset-item py-inset-item text-body-sm text-muted-foreground empty:hidden"

function AutocompleteEmpty({ className, ...props }: ComponentProps<typeof AutocompleteEmptyPrimitive>) {
  return <AutocompleteEmptyPrimitive className={cnState(messageClassName, className)} {...props} />
}

function AutocompleteStatus({ className, ...props }: ComponentProps<typeof AutocompleteStatusPrimitive>) {
  return <AutocompleteStatusPrimitive className={cnState(messageClassName, className)} {...props} />
}

function AutocompleteItem({ className, ...props }: ComponentProps<typeof AutocompleteItemPrimitive>) {
  return <AutocompleteItemPrimitive className={cnState(listItemClassName, className)} {...props} />
}

function AutocompleteItemIcon({ className, ...props }: ComponentProps<typeof AutocompleteItemIconPrimitive>) {
  return (
    <AutocompleteItemIconPrimitive
      className={cnState(
        "inline-flex shrink-0 text-muted-foreground data-mirror:rtl:-scale-x-100 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  )
}

// The matched part reads in the full foreground weight, the rest muted, so the match never rests on colour alone.
function AutocompleteItemText({ className, ...props }: ComponentProps<typeof AutocompleteItemTextPrimitive>) {
  return (
    <AutocompleteItemTextPrimitive
      className={cnState(
        "min-w-0 flex-1 truncate data-matched:[&_mark]:bg-transparent data-matched:[&_mark]:font-semibold data-matched:[&_mark]:text-current",
        className,
      )}
      {...props}
    />
  )
}

function AutocompleteGroupLabel({ className, ...props }: ComponentProps<typeof AutocompleteGroupLabelPrimitive>) {
  return <AutocompleteGroupLabelPrimitive className={cnState(listGroupLabelClassName, className)} {...props} />
}

function AutocompleteSeparator({ className, ...props }: ComponentProps<typeof AutocompleteSeparatorPrimitive>) {
  return <AutocompleteSeparatorPrimitive className={cnState(listSeparatorClassName, className)} {...props} />
}

floatingLabelControls.add(Autocomplete)
formControlAdapters.set(Autocomplete, {
  value: "value",
  change: "onValueChange",
  toControl: (value) => value ?? "",
})

export {
  Autocomplete,
  AutocompleteClear,
  AutocompleteContent,
  AutocompleteControl,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteItemIcon,
  AutocompleteItemText,
  AutocompleteList,
  AutocompleteSeparator,
  AutocompleteStatus,
  AutocompleteTrigger,
  createAutocompleteController,
}
export { useAsyncOptions } from "@ui-sdk/react/async-options"
export type { AsyncOptionsStatus } from "@ui-sdk/react/async-options"
export type { AutocompleteController, AutocompleteValueChangeReason } from "@ui-sdk/react/autocomplete"
