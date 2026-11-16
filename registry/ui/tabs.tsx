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

import { TabsScroll, type TabsScrollLabels } from "@/components/ui/tabs-scroll"
import { cn, cnState } from "@/lib/utils"

function Tabs<T extends string = string>({ className, ...props }: ComponentProps<typeof TabsPrimitive<T>>) {
  return (
    <TabsPrimitive<T>
      className={cnState("flex flex-col gap-items data-[orientation=vertical]:flex-row", className)}
      {...props}
    />
  )
}

const tabsListClassName =
  "relative inline-flex w-fit items-center rounded-control bg-muted p-control-inset text-muted-foreground data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch"

// A scrolling list clips on both axes, so a tab's focus ring drops its offset to fit inside the list's rim.
// The fades are masks over the list itself, so they work on any surface; each side's width is 0 until it overflows.
const scrollClassName = [
  "max-w-full overflow-x-auto overscroll-x-contain scroll-px-section [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_[data-slot=tabs-tab]]:focus-visible:ring-offset-0",
  "[--fade-left:0px] [--fade-right:0px] group-data-overflow-left/tabs-scroll:[--fade-left:2.5rem] group-data-overflow-right/tabs-scroll:[--fade-right:2.5rem]",
  "[mask-image:linear-gradient(to_right,transparent,black_var(--fade-left),black_calc(100%-var(--fade-right)),transparent)]",
].join(" ")

type TabsListProps = ComponentProps<typeof TabsListPrimitive> & {
  /**
   * `"auto"` (default) lets a horizontal list scroll when its tabs don't fit, with edge fades and, on fine pointers,
   * scroll buttons. `false` keeps it a plain list that never scrolls.
   */
  scrollable?: "auto" | false
  scrollLabels?: Partial<TabsScrollLabels>
}

function TabsList({ className, scrollable = "auto", scrollLabels, ...props }: TabsListProps) {
  if (scrollable === false) return <TabsListPrimitive className={cnState(tabsListClassName, className)} {...props} />
  return (
    <TabsScroll labels={scrollLabels}>
      {(ref) => (
        <TabsListPrimitive
          ref={ref}
          className={cnState(cn(tabsListClassName, scrollClassName), className)}
          {...props}
        />
      )}
    </TabsScroll>
  )
}

// A solid primary fill on muted, so the selected tab reads at 3:1 rather than as a faint tint.
function TabsTab({ className, ...props }: ComponentProps<typeof TabsTabPrimitive>) {
  return (
    <TabsTabPrimitive
      className={cnState(
        "touch-target inline-flex h-control-sm shrink-0 cursor-pointer items-center justify-center gap-inline rounded-control px-control-x text-sm font-medium whitespace-nowrap transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
export type { TabsListProps }
