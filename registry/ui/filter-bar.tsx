"use client"

import {
  Toolbar,
  ToolbarButton as ToolbarButtonPrimitive,
  ToolbarInput,
  ToolbarSeparator as ToolbarSeparatorPrimitive,
  createToolbarController,
} from "@ui-sdk/react/toolbar"
import type { ComponentProps, ReactNode } from "react"
import { SearchIcon } from "lucide-react"

import { buttonVariants, type ButtonLookProps } from "@/components/ui/button"
import { Input, InputGroup } from "@/components/ui/input"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cn, cnState } from "@/lib/utils"

type FilterBarProps = Omit<ComponentProps<typeof Toolbar>, "aria-label" | "children"> & {
  label: string
  children?: ReactNode
  isFiltered?: boolean
  onReset?: (event: MouseEvent) => void
  resetLabel?: string
}

function FilterBar({
  label,
  isFiltered = false,
  onReset,
  resetLabel = "Reset filters",
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <Toolbar
      aria-label={label}
      className={cnState("flex w-full flex-wrap items-center gap-items", className)}
      {...props}
    >
      {children}
      {isFiltered && onReset && (
        <FilterBarButton
          variant="ghost"
          render={(part) => <button {...part} data-slot="filter-bar-reset" />}
          onClick={(event) => onReset(event.nativeEvent)}
        >
          {resetLabel}
        </FilterBarButton>
      )}
    </Toolbar>
  )
}

type FilterBarButtonProps = Omit<ComponentProps<typeof ToolbarButtonPrimitive>, "aria-label"> & ButtonLookProps

function FilterBarButton({ className, variant = "outline", size, tooltip, ...props }: FilterBarButtonProps) {
  return (
    <ControlTooltip label={props["aria-label"]} tooltip={tooltip} iconOnly={size === "icon"}>
      <ToolbarButtonPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
    </ControlTooltip>
  )
}

function FilterBarSeparator({ className, ...props }: ComponentProps<typeof ToolbarSeparatorPrimitive>) {
  return <ToolbarSeparatorPrimitive className={cnState("h-5 w-px self-center bg-border", className)} {...props} />
}

type FilterBarSearchProps = Omit<ComponentProps<typeof Input>, "aria-label" | "type"> & {
  label: string
}

function FilterBarSearch({ label, className, ...props }: FilterBarSearchProps) {
  return (
    <InputGroup render={<search />} aria-label={label} className={cn("w-full sm:max-w-64 sm:flex-1", className)}>
      <SearchIcon />
      <ToolbarInput
        render={
          <Input type="search" aria-label={label} className="[&::-webkit-search-cancel-button]:hidden" {...props} />
        }
      />
    </InputGroup>
  )
}

export { createToolbarController, FilterBar, FilterBarButton, FilterBarSearch, FilterBarSeparator }
export type { FilterBarButtonProps, FilterBarProps, FilterBarSearchProps }
