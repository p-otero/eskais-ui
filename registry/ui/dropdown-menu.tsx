"use client"

import {
  Menu as DropdownMenu,
  MenuCheckboxItem as MenuCheckboxItemPrimitive,
  MenuContent as MenuContentPrimitive,
  MenuGroup as DropdownMenuGroup,
  MenuGroupLabel as MenuGroupLabelPrimitive,
  MenuItem as MenuItemPrimitive,
  MenuItemIcon as MenuItemIconPrimitive,
  MenuItemIndicator as MenuItemIndicatorPrimitive,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem as MenuRadioItemPrimitive,
  MenuSeparator as MenuSeparatorPrimitive,
  MenuShortcut as MenuShortcutPrimitive,
  MenuSub as DropdownMenuSub,
  MenuSubContent as MenuSubContentPrimitive,
  MenuSubTrigger as MenuSubTriggerPrimitive,
  MenuTrigger as MenuTriggerPrimitive,
  createMenuController,
} from "@ui-sdk/react/menu"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { CheckIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

const menuContentClassName =
  "z-popover m-0 flex max-h-(--available-height) min-w-48 flex-col overflow-y-auto overscroll-contain surface-floating p-inline text-sm outline-none origin-(--transform-origin) transition duration-micro ease-standard data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100"

const menuItemClassName =
  "relative flex h-control-sm shrink-0 cursor-default items-center gap-inline rounded-control px-inset-item outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 data-destructive:text-destructive data-pending:cursor-progress [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"

// oxlint-disable-next-line eskais/spacing-tokens -- clears the absolute size-4 indicator: its start inset, its size and a gap
const checkableItemClassName = `${menuItemClassName} ps-8`

function DropdownMenuTrigger({
  className,
  variant = "outline",
  size,
  ...props
}: ComponentProps<typeof MenuTriggerPrimitive> & ButtonLook) {
  return <MenuTriggerPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function DropdownMenuContent({ className, ...props }: ComponentProps<typeof MenuContentPrimitive>) {
  return <MenuContentPrimitive className={cnState(menuContentClassName, className)} {...props} />
}

function DropdownMenuSubContent({ className, ...props }: ComponentProps<typeof MenuSubContentPrimitive>) {
  return <MenuSubContentPrimitive className={cnState(menuContentClassName, className)} {...props} />
}

function DropdownMenuItem({ className, ...props }: ComponentProps<typeof MenuItemPrimitive>) {
  return <MenuItemPrimitive className={cnState(menuItemClassName, className)} {...props} />
}

function DropdownMenuSubTrigger({ className, ...props }: ComponentProps<typeof MenuSubTriggerPrimitive>) {
  return (
    <MenuSubTriggerPrimitive
      className={cnState(`${menuItemClassName} data-open:bg-accent data-open:text-accent-foreground`, className)}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({ className, ...props }: ComponentProps<typeof MenuCheckboxItemPrimitive>) {
  return <MenuCheckboxItemPrimitive className={cnState(checkableItemClassName, className)} {...props} />
}

function DropdownMenuRadioItem({ className, ...props }: ComponentProps<typeof MenuRadioItemPrimitive>) {
  return <MenuRadioItemPrimitive className={cnState(checkableItemClassName, className)} {...props} />
}

function DropdownMenuItemIndicator({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuItemIndicatorPrimitive>) {
  return (
    <MenuItemIndicatorPrimitive
      className={cnState("absolute start-(--item-padding-x) inline-flex size-4 items-center justify-center", className)}
      {...props}
    >
      {children ?? <CheckIcon />}
    </MenuItemIndicatorPrimitive>
  )
}

function DropdownMenuItemIcon({ className, ...props }: ComponentProps<typeof MenuItemIconPrimitive>) {
  return (
    <MenuItemIconPrimitive
      className={cnState("inline-flex text-muted-foreground in-data-highlighted:text-current", className)}
      {...props}
    />
  )
}

function DropdownMenuGroupLabel({ className, ...props }: ComponentProps<typeof MenuGroupLabelPrimitive>) {
  return (
    <MenuGroupLabelPrimitive
      className={cnState("px-inset-item py-inline text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuSeparatorPrimitive>) {
  return (
    <MenuSeparatorPrimitive className={cnState("-mx-inline my-inline h-px shrink-0 bg-border", className)} {...props} />
  )
}

function DropdownMenuShortcut({ className, ...props }: ComponentProps<typeof MenuShortcutPrimitive>) {
  return (
    <MenuShortcutPrimitive
      className={cnState("ms-auto ps-group text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  createMenuController,
}
