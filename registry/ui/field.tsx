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
import { createContext, useContext, type ComponentProps, type ReactNode } from "react"

import { cnState } from "@/lib/utils"

/** Where a Field's label sits: above the control, inside it (floating up once there's a value), or on its border. */
type FieldLabelPlacement = "top" | "in" | "on"

const FieldLabelPlacementContext = createContext<FieldLabelPlacement>("top")

/** The label placement of the Field around a control; controls give `in` a blank placeholder to float on. */
function useFieldLabelPlacement() {
  return useContext(FieldLabelPlacementContext)
}

// Controls that can hold a floating label. FormField applies a Form's default placement only to these, so radio
// groups, sliders and switches keep their label on top. Each control's module adds itself.
const floatingLabelControls = new WeakSet<object>()

/** A blank placeholder for an input in a `labelPlacement="in"` Field: the label floats on `:placeholder-shown`. */
function useFloatingPlaceholder(placeholder: string | undefined) {
  const placement = useFieldLabelPlacement()
  return placeholder ?? (placement === "in" ? " " : undefined)
}

const checkboxRowClassName =
  "has-[>[data-slot=checkbox]]:flex-row has-[>[data-slot=checkbox]]:items-start has-[>[data-slot=checkbox]]:gap-inline has-[>[data-slot=switch]]:flex-row has-[>[data-slot=switch]]:items-center has-[>[data-slot=switch]]:gap-inline pointer-coarse:has-[>[data-slot=checkbox]]:items-center pointer-coarse:has-[>[data-slot=checkbox],>[data-slot=switch]]:min-h-(--control-height-touch)"

const textControls =
  "[data-slot=input],[data-slot=native-select],[data-slot=select-value],[data-slot=number-input-control],[data-slot=date-picker-input],[data-slot=combobox-input],[data-slot=time-input]"

// Every control sizes from --field-control-height, so `in` makes the text controls taller and moves their text below
// the floated label. A placeholder would collide with the resting label, so it shows only while its control is focused.
const placementClassName: Record<FieldLabelPlacement, string> = {
  top: "[--field-control-height:var(--control-height)]",
  in: [
    "relative [--field-control-height:calc(var(--control-height)+var(--field-label-offset))]",
    "[--field-label-start:calc(var(--control-padding)+1px)] [--field-label-rest-y:calc((var(--field-control-height)-1lh)/2)]",
    "has-[>[data-slot=input-group]>svg:first-child]:[--field-label-start:calc(var(--control-padding)+1rem+var(--gap-inline)+1px)]",
    "has-[[data-slot=number-input-group]>[data-slot=number-input-decrement]:first-child]:[--field-label-start:calc(var(--control-height)+var(--gap-inline)+1px)]",
    "has-[>[data-slot=textarea]]:[--field-label-rest-y:calc(var(--field-label-offset)+var(--item-padding-y)+1px)]",
    `[&_:is(${textControls})]:pt-(--field-label-offset)`,
    "[&>[data-slot=textarea]]:pt-[calc(var(--field-label-offset)+var(--item-padding-y))]",
    "[&_:is(input,textarea):not(:focus,[data-slot=time-input-segment])]:placeholder:text-transparent",
    "[&_[data-slot=select-trigger]:not(:focus)_[data-placeholder]]:invisible",
    '[&_select:not(:focus):has(option[value=""]:checked)]:text-transparent',
  ].join(" "),
  on: [
    "relative pt-[calc(var(--type-caption-leading)/2)] [--field-control-height:var(--control-height)]",
    "[--field-label-start:calc(max(var(--control-padding),min(var(--control-radius),var(--control-height)/2))-var(--gap-inline))]",
  ].join(" "),
}

const labelPlacementClassName: Record<FieldLabelPlacement, string> = {
  top: "text-sm font-medium",
  in: [
    "pointer-events-none absolute start-(--field-label-start) top-0 z-10 max-w-[calc(100%-2*var(--field-label-start))] origin-top-left truncate text-body text-muted-foreground rtl:origin-top-right",
    "translate-y-(--field-label-rest-y) transition-[translate,scale,color] duration-micro ease-standard",
    "field-floated:translate-y-(--field-label-float-y) field-floated:scale-(--field-label-scale)",
    "[:focus-within>&:not([data-invalid])]:text-foreground data-invalid:text-destructive",
  ].join(" "),
  // A band of the surface's fill covers the border line and the 2px focus ring above it, so the label cuts the
  // line while a translucent (glass) surface still shows through around the text.
  on: [
    "absolute start-(--field-label-start) top-0 z-10 max-w-[calc(100%-2*var(--field-label-start))] truncate px-inline text-caption font-medium text-muted-foreground",
    "bg-[linear-gradient(to_bottom,transparent_calc(50%-3px),var(--field-label-surface)_calc(50%-3px),var(--field-label-surface)_calc(50%+2px),transparent_calc(50%+2px))]",
    "[:focus-within>&:not([data-invalid])]:text-foreground data-invalid:text-destructive",
  ].join(" "),
}

type FieldProps = ComponentProps<typeof FieldPrimitive> & {
  /**
   * `top` (default) puts the label above the control. `in` puts it inside, like a placeholder, and floats it up on
   * focus or once there's a value; a placeholder then shows only while focused. `on` sets it on the control's border,
   * over `--field-label-surface`. `in` and `on` suit text controls: Input, InputGroup, Textarea, Select, NativeSelect,
   * NumberInput, DatePicker, DateTimePicker and Combobox.
   */
  labelPlacement?: FieldLabelPlacement
}

function Field({ className, labelPlacement = "top", ...props }: FieldProps) {
  return (
    <FieldLabelPlacementContext value={labelPlacement}>
      <FieldPrimitive
        data-label-placement={labelPlacement}
        className={cnState(
          `flex flex-col gap-inline ${checkboxRowClassName} ${placementClassName[labelPlacement]}`,
          className,
        )}
        {...props}
      />
    </FieldLabelPlacementContext>
  )
}

function FieldLabel({ className, ...props }: ComponentProps<typeof FieldLabelPrimitive>) {
  const placement = useFieldLabelPlacement()
  return (
    <FieldLabelPrimitive
      className={cnState(`select-none data-disabled:opacity-50 ${labelPlacementClassName[placement]}`, className)}
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

export {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  floatingLabelControls,
  useFieldLabelPlacement,
  useFloatingPlaceholder,
}
export type { FieldLabelPlacement, FieldProps, FieldSetProps }
