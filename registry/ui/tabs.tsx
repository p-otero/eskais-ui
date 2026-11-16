"use client"

import {
  Tabs as TabsPrimitive,
  TabsIndicator,
  TabsList as TabsListPrimitive,
  TabsPanel as TabsPanelPrimitive,
  TabsTab as TabsTabPrimitive,
  TabsTabIcon,
  createTabsController,
} from "@ui-sdk/react/tabs"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function Tabs<T extends string = string>({ className, ...props }: ComponentProps<typeof TabsPrimitive<T>>) {
  return (
    <TabsPrimitive<T>
      className={cnState("flex flex-col gap-items data-[orientation=vertical]:flex-row", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: ComponentProps<typeof TabsListPrimitive>) {
  return (
    <TabsListPrimitive
      className={cnState(
        "relative inline-flex w-fit items-center rounded-control bg-muted p-control-inset text-muted-foreground data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className,
      )}
      {...props}
    />
  )
}

// A solid primary fill on muted, so the selected tab reads at 3:1 rather than as a faint tint.
function TabsTab({ className, ...props }: ComponentProps<typeof TabsTabPrimitive>) {
  return (
    <TabsTabPrimitive
      className={cnState(
        "inline-flex h-control-sm shrink-0 cursor-pointer items-center justify-center gap-inline rounded-control px-control-x text-sm font-medium whitespace-nowrap transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: ComponentProps<typeof TabsPanelPrimitive>) {
  return (
    <TabsPanelPrimitive
      className={cnState(
        "flex-1 rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  )
}

export { createTabsController, Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab, TabsTabIcon }
