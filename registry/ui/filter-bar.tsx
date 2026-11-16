"use client"

import {
  Toolbar,
  ToolbarButton as ToolbarButtonPrimitive,
  ToolbarInput,
  ToolbarSeparator as ToolbarSeparatorPrimitive,
  createToolbarController,
} from "@ui-sdk/react/toolbar"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { Input, InputGroup } from "@/components/ui/input"
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
    <Toolbar aria-label={label} className={cnState("flex w-full flex-wrap items-center gap-2", className)} {...props}>
      {children}
      {isFiltered && onReset && (
        <FilterBarButton variant="ghost" data-slot="filter-bar-reset" onClick={(event) => onReset(event.nativeEvent)}>
          {resetLabel}
        </FilterBarButton>
      )}
    </Toolbar>
  )
}

type FilterBarButtonProps = ComponentProps<typeof ToolbarButtonPrimitive> & VariantProps<typeof buttonVariants>

function FilterBarButton({ className, variant = "outline", size, ...props }: FilterBarButtonProps) {
  return <ToolbarButtonPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function FilterBarSeparator({ className, ...props }: ComponentProps<typeof ToolbarSeparatorPrimitive>) {
  return <ToolbarSeparatorPrimitive className={cnState("mx-1 h-5 w-px self-center bg-border", className)} {...props} />
}

type FilterBarSearchProps = Omit<ComponentProps<typeof Input>, "aria-label" | "type"> & {
  label: string
}

function FilterBarSearch({ label, className, ...props }: FilterBarSearchProps) {
  return (
    <InputGroup render={<search />} aria-label={label} className={cn("w-full sm:max-w-64 sm:flex-1", className)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
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
