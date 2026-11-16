"use client"

import {
  Field as FieldPrimitive,
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldGroup as FieldGroupPrimitive,
  FieldLabel as FieldLabelPrimitive,
  FieldLegend as FieldLegendPrimitive,
  FieldSet as FieldSetPrimitive,
} from "@ui-sdk/react/field"
import type { ComponentProps, ReactNode } from "react"

import { cnState } from "@/lib/utils"

const checkboxRowClassName =
  "has-[>[data-slot=checkbox]]:flex-row has-[>[data-slot=checkbox]]:items-start has-[>[data-slot=checkbox]]:gap-inline has-[>[data-slot=switch]]:flex-row has-[>[data-slot=switch]]:items-center has-[>[data-slot=switch]]:gap-inline pointer-coarse:has-[>[data-slot=checkbox]]:items-center pointer-coarse:has-[>[data-slot=checkbox],>[data-slot=switch]]:min-h-(--control-height-touch)"

function Field({ className, ...props }: ComponentProps<typeof FieldPrimitive>) {
  return (
    <FieldPrimitive className={cnState(`flex flex-col gap-inline ${checkboxRowClassName}`, className)} {...props} />
  )
}

function FieldLabel({ className, ...props }: ComponentProps<typeof FieldLabelPrimitive>) {
  return (
    <FieldLabelPrimitive
      className={cnState("text-sm font-medium select-none data-disabled:opacity-50", className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: ComponentProps<typeof FieldDescriptionPrimitive>) {
  return <FieldDescriptionPrimitive className={cnState("text-sm text-muted-foreground", className)} {...props} />
}

function FieldError({ className, ...props }: ComponentProps<typeof FieldErrorPrimitive>) {
  return <FieldErrorPrimitive className={cnState("text-sm text-destructive", className)} {...props} />
}

function FieldLegend({ className, ...props }: ComponentProps<typeof FieldLegendPrimitive>) {
  return (
    <FieldLegendPrimitive
      className={cnState("p-0 text-title-sm tracking-tight data-disabled:opacity-50", className)}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: ComponentProps<typeof FieldGroupPrimitive>) {
  return <FieldGroupPrimitive className={cnState("flex flex-col gap-group", className)} {...props} />
}

type FieldSetProps = Omit<ComponentProps<typeof FieldSetPrimitive>, "children"> & {
  /** Names the group, and the radio or checkbox group inside it. */
  legend?: ReactNode
  description?: ReactNode
  children?: ReactNode
}

/** A native fieldset: its legend names the group, and `disabled` disables every control inside. */
function FieldSet({ legend, description, className, children, ...props }: FieldSetProps) {
  return (
    <FieldSetPrimitive className={cnState("m-0 flex min-w-0 flex-col gap-group border-0 p-0", className)} {...props}>
      {legend === undefined ? null : <FieldLegend>{legend}</FieldLegend>}
      {description === undefined ? null : <FieldDescription>{description}</FieldDescription>}
      {children}
    </FieldSetPrimitive>
  )
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet }
export type { FieldSetProps }
