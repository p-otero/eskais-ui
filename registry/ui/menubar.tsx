"use client"

import { Menu as MenubarMenu, MenuTrigger as MenuTriggerPrimitive } from "@ui-sdk/react/menu"
import { Menubar as MenubarPrimitive, createMenubarController } from "@ui-sdk/react/menubar"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

export {
  DropdownMenuCheckboxItem as MenubarCheckboxItem,
  DropdownMenuContent as MenubarContent,
  DropdownMenuGroup as MenubarGroup,
  DropdownMenuGroupLabel as MenubarGroupLabel,
  DropdownMenuItem as MenubarItem,
  DropdownMenuItemIcon as MenubarItemIcon,
  DropdownMenuItemIndicator as MenubarItemIndicator,
  DropdownMenuRadioGroup as MenubarRadioGroup,
  DropdownMenuRadioItem as MenubarRadioItem,
  DropdownMenuSeparator as MenubarSeparator,
  DropdownMenuShortcut as MenubarShortcut,
  DropdownMenuSub as MenubarSub,
  DropdownMenuSubContent as MenubarSubContent,
  DropdownMenuSubTrigger as MenubarSubTrigger,
} from "@/components/ui/dropdown-menu"

function Menubar({ className, ...props }: ComponentProps<typeof MenubarPrimitive>) {
  return (
    <MenubarPrimitive
      className={cnState(
        "flex w-fit items-center rounded-control border bg-background/(--glass-opacity) p-control-inset data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className,
      )}
      {...props}
    />
  )
}

function MenubarTrigger({ className, ...props }: ComponentProps<typeof MenuTriggerPrimitive>) {
  return (
    <MenuTriggerPrimitive
      className={cnState(
        "inline-flex h-control-sm cursor-default items-center gap-inline rounded-control px-control-x text-sm font-medium outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-open:bg-accent data-open:text-accent-foreground data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

export { Menubar, MenubarMenu, MenubarTrigger, createMenubarController }
