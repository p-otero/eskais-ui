"use client"

import { useFieldControl } from "@ui-sdk/react/field"
import { createParts } from "@ui-sdk/react/primitive"
import type { ComponentProps, ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"

import { floatingLabelControls } from "@/components/ui/field"
import { fieldSurfaceClassName } from "@/components/ui/input"
import { nativeSelect, type NativeSelectItem, type NativeSelectOptions } from "@/components/ui/native-select-primitive"
import { cn } from "@/lib/utils"

const { Root: NativeSelectRoot } = createParts(nativeSelect, { root: "select" })

type NativeSelectOption = { value: string; label: string; disabled?: boolean; description?: ReactNode }
type NativeSelectOptionGroup = { label: string; options: readonly NativeSelectOption[] }
type NativeSelectOptionList = readonly (NativeSelectOption | NativeSelectOptionGroup)[]

type NativeSelectProps = Omit<
  ComponentProps<"select">,
  "value" | "defaultValue" | "onChange" | "children" | "multiple"
> &
  Pick<NativeSelectOptions, "value" | "defaultValue" | "onValueChange"> & {
    /** The same shape as Select's `options`; a description has no place in a native list and is left out. */
    options: NativeSelectOptionList
    /** Shows while nothing is chosen; it can't be chosen again once something is, unless `clearable` is set. */
    placeholder?: string
    /** The label of a first choice that sets the value to `null`, like "No team". */
    clearable?: string
  }

const isGroup = (option: NativeSelectOption | NativeSelectOptionGroup): option is NativeSelectOptionGroup =>
  "options" in option

function agentItems(options: NativeSelectOptionList, clearable?: string): NativeSelectItem[] {
  const items = options.flatMap((option) => (isGroup(option) ? option.options : [option]))
  return [
    ...(clearable === undefined ? [] : [{ value: "", label: clearable }]),
    ...items.filter((item) => !item.disabled).map(({ value, label }) => ({ value, label })),
  ]
}

function renderOption(option: NativeSelectOption) {
  return (
    <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  )
}

/** A styled native `<select>`: the platform's own picker, best on touch screens. Agents set it by label. */
function NativeSelect({
  options,
  placeholder,
  clearable,
  value,
  defaultValue,
  onValueChange,
  className,
  disabled,
  ...props
}: NativeSelectProps) {
  const field = useFieldControl()
  const own = {
    ...props,
    name: props.name ?? field?.name,
    disabled: disabled ?? field?.disabled,
    "data-slot": "native-select",
    className: cn(
      fieldSurfaceClassName,
      // oxlint-disable-next-line eskais/spacing-tokens -- the end padding clears the chevron drawn over the select
      "h-field-control w-full min-w-0 cursor-pointer appearance-none rounded-control ps-control-x pe-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    ),
  }
  const merged = field ? (field.props(own) as typeof own) : own
  return (
    <div data-slot="native-select-wrapper" className="relative w-full min-w-0">
      <NativeSelectRoot
        {...merged}
        items={agentItems(options, clearable)}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
      >
        {clearable === undefined ? (
          <option value="" disabled={placeholder !== undefined} hidden={placeholder === undefined}>
            {placeholder}
          </option>
        ) : (
          <option value="">{clearable}</option>
        )}
        {options.map((option) =>
          isGroup(option) ? (
            <optgroup key={`group:${option.label}`} label={option.label}>
              {option.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(option)
          ),
        )}
      </NativeSelectRoot>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-control-x flex items-center text-muted-foreground [&>svg]:size-4"
      >
        <ChevronDownIcon />
      </span>
    </div>
  )
}

floatingLabelControls.add(NativeSelect)

export { NativeSelect }
export type { NativeSelectOption, NativeSelectOptionGroup, NativeSelectOptionList, NativeSelectProps }
