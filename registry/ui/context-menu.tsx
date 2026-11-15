"use client"

import { Menu as ContextMenu, MenuContextTrigger as MenuContextTriggerPrimitive } from "@ui-sdk/react/menu"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

export {
  DropdownMenuCheckboxItem as ContextMenuCheckboxItem,
  DropdownMenuContent as ContextMenuContent,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuGroupLabel as ContextMenuGroupLabel,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuItemIcon as ContextMenuItemIcon,
  DropdownMenuItemIndicator as ContextMenuItemIndicator,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
  DropdownMenuSeparator as ContextMenuSeparator,
  DropdownMenuShortcut as ContextMenuShortcut,
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
  createMenuController as createContextMenuController,
} from "@/components/ui/dropdown-menu"

const contextMenuTriggerVariants = cva(
  "rounded-surface outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        plain: "",
        area: "flex min-h-24 items-center justify-center border border-dashed p-surface text-center text-sm text-muted-foreground data-open:border-ring",
      },
    },
    defaultVariants: { variant: "plain" },
  },
)

// tabIndex 0 by default: Shift+F10 and the context-menu key only reach an area that can take focus.
function ContextMenuTrigger({
  className,
  variant,
  tabIndex = 0,
  ...props
}: ComponentProps<typeof MenuContextTriggerPrimitive> & VariantProps<typeof contextMenuTriggerVariants>) {
  return (
    <MenuContextTriggerPrimitive
      tabIndex={tabIndex}
      className={cnState(contextMenuTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

export { ContextMenu, ContextMenuTrigger }
