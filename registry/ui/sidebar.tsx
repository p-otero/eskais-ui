"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/react/primitive"
import { useState, type ReactNode } from "react"
import { PanelLeftIcon, XIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import {
  createSidebarController,
  sidebar,
  type SidebarCollapsedChangeReason,
  type SidebarController,
} from "@/components/ui/sidebar-primitive"
import {
  SidebarGroup,
  SidebarItem,
  SidebarRailContext,
  type SidebarGroupProps,
  type SidebarItemProps,
} from "@/components/ui/sidebar-items"
import {
  defaultNarrowQuery,
  setSidebarDrawerOpen,
  SidebarTrigger,
  sidebarLabels,
  useNarrow,
  useSidebarDrawerOpen,
  type SidebarLabels,
  type SidebarTriggerProps,
} from "@/components/ui/sidebar-trigger"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useSidebarState, type SidebarState, type SidebarStateOptions } from "@/components/ui/use-sidebar-state"

const { Root: SidebarRoot, Trigger: SidebarToggle } = createParts(sidebar, { root: "nav", trigger: "button" })

type SidebarProps = {
  label: string
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean, details: ChangeDetails<SidebarCollapsedChangeReason>) => void
  collapsible?: boolean
  /**
   * What collapsing does on wide screens: `rail` keeps the items as icons with tooltips; `hide` slides the sidebar
   * away, for items without icons, like a docs sidebar. Hidden, it has no toggle of its own, so pair it with a
   * SidebarTrigger elsewhere.
   */
  collapse?: "rail" | "hide"
  /**
   * `false` when a SidebarTrigger elsewhere, like in a Topbar's `leading`, takes the place of the sidebar's own
   * buttons: the collapse toggle in its header and, on narrow screens, the drawer button.
   */
  trigger?: boolean
  /** Whether the sidebar renders its drawer button on narrow screens. Follows `trigger` by default. */
  narrowTrigger?: boolean
  controller?: SidebarController
  narrowQuery?: string
  header?: ReactNode
  footer?: ReactNode
  labels?: Partial<SidebarLabels>
  className?: string
  children: ReactNode
}

const surfaceClassName = "flex min-h-0 flex-col gap-group text-foreground"

function Sidebar({
  label,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  collapsible = true,
  collapse = "rail",
  controller,
  narrowQuery = defaultNarrowQuery,
  trigger = true,
  narrowTrigger = trigger,
  header,
  footer,
  labels: labelOverrides,
  className,
  children,
}: SidebarProps) {
  const labels = { ...sidebarLabels, ...labelOverrides }
  const narrow = useNarrow(narrowQuery)
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed)
  const [ownDrawerOpen, setOwnDrawerOpen] = useState(false)
  const sharedDrawerOpen = useSidebarDrawerOpen(controller, narrowQuery)
  const drawerOpen = controller ? sharedDrawerOpen : ownDrawerOpen
  const setDrawerOpen = (open: boolean) =>
    controller ? setSidebarDrawerOpen(controller, open) : setOwnDrawerOpen(open)
  const collapsed = collapsible && !narrow && (collapsedProp ?? ownCollapsed)
  const rail = collapsed && collapse === "rail"

  const body = <div className="flex min-h-0 flex-1 flex-col gap-group overflow-y-auto">{children}</div>

  if (narrow) {
    return (
      <Drawer side="start" open={drawerOpen} onOpenChange={setDrawerOpen}>
        {narrowTrigger && (
          <DrawerTrigger variant="ghost" size="icon" aria-label={labels.open} className={className}>
            <PanelLeftIcon />
          </DrawerTrigger>
        )}
        <DrawerBackdrop />
        <DrawerContent
          className="gap-group p-items"
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest("a[href]")) setDrawerOpen(false)
          }}
        >
          <div className="flex items-center gap-inline">
            <DrawerTitle className="flex-1 truncate px-inset-item text-base">{label}</DrawerTitle>
            <DrawerClose variant="ghost" size="icon" aria-label={labels.close}>
              <XIcon />
            </DrawerClose>
          </div>
          <SidebarRoot aria-label={label} collapsed={false} className={cn(surfaceClassName, "flex-1")}>
            {header}
            {body}
            {footer}
          </SidebarRoot>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <SidebarRoot
      aria-label={label}
      data-collapse={collapse}
      collapsed={collapsed}
      controller={controller}
      onCollapsedChange={(next, details) => {
        onCollapsedChange?.(next, details)
        if (!details.canceled) setOwnCollapsed(next)
      }}
      className={cn(
        surfaceClassName,
        "group/sidebar h-full w-(--sidebar-width) shrink-0 overflow-hidden border-e bg-muted/(--glass-opacity) p-items backdrop-surface transition-all duration-panel ease-standard data-collapsed:w-(--sidebar-rail-width) motion-reduce:transition-none",
        collapse === "hide" &&
          "data-collapsed:invisible data-collapsed:w-0 data-collapsed:border-e-0 data-collapsed:px-0",
        className,
      )}
    >
      <div data-slot="sidebar-header" className="flex items-center gap-inline group-data-collapsed/sidebar:flex-col">
        <div className="min-w-0 flex-1 group-data-collapsed/sidebar:hidden">{header}</div>
        {collapsible && trigger && (
          <ControlTooltip label={collapsed ? labels.expand : labels.collapse}>
            <SidebarToggle
              aria-label={collapsed ? labels.expand : labels.collapse}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rtl:[&_svg]:-scale-x-100")}
            >
              <PanelLeftIcon />
            </SidebarToggle>
          </ControlTooltip>
        )}
      </div>
      <SidebarRailContext value={rail}>{body}</SidebarRailContext>
      {footer !== undefined && (
        <div data-slot="sidebar-footer" className="group-data-collapsed/sidebar:hidden">
          {footer}
        </div>
      )}
    </SidebarRoot>
  )
}

export { createSidebarController, Sidebar, SidebarGroup, SidebarItem, sidebarLabels, SidebarTrigger, useSidebarState }
export type { SidebarState, SidebarStateOptions }
export type { SidebarController, SidebarLabels, SidebarProps }
export type { SidebarTriggerProps }
export type { SidebarGroupProps, SidebarItemProps }
