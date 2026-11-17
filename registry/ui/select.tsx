"use client"

import {
  Select as SelectPrimitive,
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
  type ListData,
  type SelectProps as SelectPrimitiveProps,
} from "@ui-sdk/react/select"
import { cva } from "class-variance-authority"
import { Fragment, useState, type ComponentProps, type ReactNode } from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { floatingLabelControls } from "@/components/ui/field"
import { fieldSurfaceClassName } from "@/components/ui/input"
import { cnState } from "@/lib/utils"

const triggerClassName = `${fieldSurfaceClassName} flex w-full min-w-0 cursor-pointer items-center justify-between gap-inline rounded-control px-control-x text-start text-entry outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground`

// `default` follows the Field (taller with a floating label); `sm` is a fixed compact height for toolbars and filters.
const selectTriggerVariants = cva(triggerClassName, {
  variants: { size: { default: "h-field-control", sm: "h-control-sm" } },
  defaultVariants: { size: "default" },
})

type SelectSize = "default" | "sm"

const listPopupClassName =
  "m-0 max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto overscroll-contain surface-floating p-inline outline-none transition-opacity duration-micro ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0"

// A tint alone misses the 3:1 a state needs, so the highlight also draws a full ring.
const listItemClassName =
  "flex min-h-control-sm cursor-default items-center gap-inline rounded-control px-inset-item text-sm outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:ring-2 data-highlighted:ring-ring data-highlighted:ring-inset [&_svg]:size-4 [&_svg]:shrink-0"

const listIndicatorClassName = "ms-auto inline-flex items-center"

const listGroupLabelClassName = "px-inset-item py-inline text-xs font-medium text-muted-foreground"

const listSeparatorClassName = "-mx-inline my-inline h-px bg-border"

function SelectLabel({ className, ...props }: ComponentProps<typeof SelectLabelPrimitive>) {
  return (
    <SelectLabelPrimitive
      className={cnState("text-sm font-medium select-none data-disabled:opacity-50", className)}
      {...props}
    />
  )
}

type SelectTriggerProps = ComponentProps<typeof SelectTriggerPrimitive> & { size?: SelectSize }

function SelectTrigger({ className, size = "default", children, ...props }: SelectTriggerProps) {
  return (
    <SelectTriggerPrimitive data-size={size} className={cnState(selectTriggerVariants({ size }), className)} {...props}>
      {typeof children === "function" ? (
        (state) => (
          <>
            {children(state)}
            <ChevronDownIcon />
          </>
        )
      ) : (
        <>
          {children}
          <ChevronDownIcon />
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
      {children ?? <CheckIcon strokeWidth={2.5} />}
    </SelectItemIndicatorPrimitive>
  )
}

function SelectGroupLabel({ className, ...props }: ComponentProps<typeof SelectGroupLabelPrimitive>) {
  return <SelectGroupLabelPrimitive className={cnState(listGroupLabelClassName, className)} {...props} />
}

function SelectSeparator({ className, ...props }: ComponentProps<typeof SelectSeparatorPrimitive>) {
  return <SelectSeparatorPrimitive className={cnState(listSeparatorClassName, className)} {...props} />
}

type SelectValueChangeDetails = Parameters<NonNullable<SelectPrimitiveProps<string, false>["onValueChange"]>>[1]

// Distributes over the single and multiple variants, so `onValueChange` keeps its parameter type.
type WithoutItems<Props> = Props extends unknown ? Omit<Props, "items"> : never

type SelectOption<T = string> = { value: T; label: string; disabled?: boolean; description?: ReactNode }
type SelectOptionGroup<T = string> = { label: string; options: readonly SelectOption<T>[] }
type SelectOptions<T = string> = readonly (SelectOption<T> | SelectOptionGroup<T>)[]

type SelectProps<T = string, Multiple extends boolean | undefined = false> = WithoutItems<
  SelectPrimitiveProps<T, Multiple>
> & {
  /** UI SDK's list data, for the parts API; a readonly array works too. */
  items?: readonly ListData<T>[number][]
  /** The choices as data, flat or in groups. Without children, the trigger and list render from them. */
  options?: SelectOptions<T>
  /** The label of a first "none" choice that sets the value to `null`, like "No team". Single selects only. */
  clearable?: string
  /** Names the trigger when no `FieldLabel` or `SelectLabel` does. Used only when rendering from `options`. */
  "aria-label"?: string
  /** The trigger's height when rendering from `options`: `sm` for toolbars and filters (not with a floating label). */
  size?: SelectSize
  /** Props for the trigger when rendering from `options`: `id`, `className`, `data-*`, `size`… */
  triggerProps?: Omit<SelectTriggerProps, "children"> & DataAttributes
}

type DataAttributes = { [attribute: `data-${string}`]: string | number | boolean | undefined }

// Never held by the select: choosing it reports null, and the controlled value stays null.
const noneValue = "\u0000eskais-select-none"

const isGroup = <T,>(option: SelectOption<T> | SelectOptionGroup<T>): option is SelectOptionGroup<T> =>
  "options" in option

function toListData<T>(options: SelectOptions<T>, clearable?: string): ListData<T> {
  const items: ListData<T> = options.map((option) =>
    isGroup(option)
      ? {
          type: "group" as const,
          label: option.label,
          items: option.options.map((item) => ({ value: item.value, label: item.label, disabled: item.disabled })),
        }
      : { value: option.value, label: option.label, disabled: option.disabled },
  )
  return clearable === undefined ? items : ([{ value: noneValue, label: clearable }, ...items] as ListData<T>)
}

function OptionItem<T>({ option }: { option: SelectOption<T> }) {
  return (
    <SelectItem<T> value={option.value} label={option.label} disabled={option.disabled}>
      {option.description === undefined ? (
        option.label
      ) : (
        <span className="flex min-w-0 flex-col">
          <span>{option.label}</span>
          <span className="text-caption text-muted-foreground">{option.description}</span>
        </span>
      )}
      <SelectItemIndicator />
    </SelectItem>
  )
}

function OptionList<T>({ options, clearable }: { options: SelectOptions<T>; clearable?: string }) {
  return (
    <SelectContent>
      {clearable === undefined ? null : (
        <SelectItem<T> value={noneValue as T} className="text-muted-foreground">
          {clearable}
        </SelectItem>
      )}
      {options.map((option, index) =>
        isGroup(option) ? (
          <Fragment key={`group:${option.label}`}>
            {index > 0 || clearable !== undefined ? <SelectSeparator /> : null}
            <SelectGroup>
              <SelectGroupLabel>{option.label}</SelectGroupLabel>
              {option.options.map((item) => (
                <OptionItem<T> key={String(item.value)} option={item} />
              ))}
            </SelectGroup>
          </Fragment>
        ) : (
          <OptionItem<T> key={String(option.value)} option={option} />
        ),
      )}
    </SelectContent>
  )
}

/** UI SDK's Select, plus `options` and `clearable`. With children it renders them, as the parts API always has. */
function Select<T = string, Multiple extends boolean | undefined = false>(props: SelectProps<T, Multiple>) {
  const { options, clearable, "aria-label": ariaLabel, size, triggerProps, children, ...root } = props
  const single = root.multiple !== true
  const [own, setOwn] = useState(() => (root.defaultValue ?? null) as T | null)
  const items = options ? toListData(options, single ? clearable : undefined) : (root.items as ListData<T> | undefined)
  const rendered =
    children ??
    (options ? (
      <>
        <SelectTrigger aria-label={ariaLabel} size={size} {...triggerProps}>
          <SelectValue />
        </SelectTrigger>
        <OptionList<T> options={options} clearable={single ? clearable : undefined} />
      </>
    ) : null)

  if (clearable === undefined || !single) {
    return (
      <SelectPrimitive<T, Multiple> {...(root as SelectPrimitiveProps<T, Multiple>)} items={items}>
        {rendered}
      </SelectPrimitive>
    )
  }
  const one = root as { value?: T | null; onValueChange?: (value: T | null, details: SelectValueChangeDetails) => void }
  const controlled = one.value !== undefined
  const clearing = {
    ...root,
    items,
    value: controlled ? one.value : own,
    onValueChange: (next: T | null, details: SelectValueChangeDetails) => {
      const value = next === (noneValue as T) ? null : next
      one.onValueChange?.(value, details)
      if (!details.canceled && !controlled) setOwn(value)
    },
  } as SelectPrimitiveProps<T, false>
  return <SelectPrimitive<T, false> {...clearing}>{rendered}</SelectPrimitive>
}

floatingLabelControls.add(Select)

/** @deprecated Import `ChevronDownIcon` from `lucide-react`. */
const ChevronIcon = ChevronDownIcon

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
  selectTriggerVariants,
}
export type { ListData, SelectController, SelectItemState } from "@ui-sdk/react/select"
export type { SelectOption, SelectOptionGroup, SelectOptions, SelectProps, SelectSize, SelectTriggerProps }
