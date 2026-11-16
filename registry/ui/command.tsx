"use client"

import {
  Command as CommandPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemIcon as CommandItemIconPrimitive,
  CommandItemText,
  CommandList as CommandListPrimitive,
  CommandPage,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandShortcut as CommandShortcutPrimitive,
  CommandStatus as CommandStatusPrimitive,
  createCommandController,
} from "@ui-sdk/react/command"
import type { ComponentProps } from "react"
import { SearchIcon } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import { cnState } from "@/lib/utils"

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cnState(
        "flex w-full flex-col overflow-hidden rounded-surface bg-popover/(--glass-opacity) text-popover-foreground in-data-[slot=dialog-content]:rounded-none in-data-[slot=dialog-content]:bg-transparent",
        className,
      )}
      {...props}
    />
  )
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandInputPrimitive>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-inline border-b px-control-x">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <CommandInputPrimitive
        className={cnState(
          "h-control-lg w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      className={cnState(
        "max-h-80 scroll-py-inline overflow-x-hidden overflow-y-auto overscroll-contain p-inline",
        className,
      )}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={cnState("py-section text-center text-sm text-muted-foreground not-data-empty:hidden", className)}
      {...props}
    />
  )
}

function CommandStatus({ className, ...props }: ComponentProps<typeof CommandStatusPrimitive>) {
  return (
    <CommandStatusPrimitive
      className={cnState("px-inset-item py-inset-item text-xs text-muted-foreground empty:hidden", className)}
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandGroupPrimitive>) {
  return <CommandGroupPrimitive className={cnState("flex flex-col not-first:pt-inline", className)} {...props} />
}

function CommandGroupLabel({ className, ...props }: ComponentProps<typeof CommandGroupLabelPrimitive>) {
  return (
    <CommandGroupLabelPrimitive
      className={cnState("px-inset-item py-inline text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandItemPrimitive>) {
  return (
    <CommandItemPrimitive
      className={cnState(
        "relative flex h-control-sm shrink-0 cursor-default items-center gap-inline rounded-control px-inset-item text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 data-pending:cursor-progress [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

function CommandItemIcon({ className, ...props }: ComponentProps<typeof CommandItemIconPrimitive>) {
  return (
    <CommandItemIconPrimitive
      className={cnState(
        "inline-flex text-muted-foreground in-data-highlighted:text-current data-mirror:rtl:-scale-x-100",
        className,
      )}
      {...props}
    />
  )
}

function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandSeparatorPrimitive>) {
  return <CommandSeparatorPrimitive className={cnState("-mx-inline my-inline h-px bg-border", className)} {...props} />
}

function CommandShortcut({ className, ...props }: ComponentProps<typeof CommandShortcutPrimitive>) {
  return (
    <CommandShortcutPrimitive
      render={<Kbd />}
      className={cnState("ms-auto empty:hidden in-data-highlighted:bg-background", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandItemText,
  CommandList,
  CommandPage,
  CommandSeparator,
  CommandShortcut,
  CommandStatus,
  createCommandController,
}
