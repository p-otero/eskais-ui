"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { createParts } from "@ui-sdk/react/primitive"
import { useState, type ReactNode } from "react"

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
  PanelIcon,
  SidebarTrigger,
  sidebarLabels,
  useNarrow,
  type SidebarLabels,
  type SidebarTriggerProps,
} from "@/components/ui/sidebar-trigger"
import { cn } from "@/lib/utils"

const { Root: SidebarRoot, Trigger: SidebarToggle } = createParts(sidebar, { root: "nav", trigger: "button" })

type SidebarProps = {
  label: string
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean, details: ChangeDetails<SidebarCollapsedChangeReason>) => void
  collapsible?: boolean
  /** Hides the toggle in the header when a SidebarTrigger elsewhere, like in a Topbar, takes its place. */
  trigger?: boolean
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
  controller,
  narrowQuery = defaultNarrowQuery,
  trigger = true,
  header,
  footer,
  labels: labelOverrides,
  className,
  children,
}: SidebarProps) {
  const labels = { ...sidebarLabels, ...labelOverrides }
  const narrow = useNarrow(narrowQuery)
  const [ownCollapsed, setOwnCollapsed] = useState(defaultCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const collapsed = collapsible && !narrow && (collapsedProp ?? ownCollapsed)

  const body = <div className="flex min-h-0 flex-1 flex-col gap-group overflow-y-auto">{children}</div>

  if (narrow) {
    return (
      <Drawer side="start" open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger variant="ghost" size="icon" aria-label={labels.open} className={className}>
          <PanelIcon />
        </DrawerTrigger>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
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
      collapsed={collapsed}
      controller={controller}
      onCollapsedChange={(next, details) => {
        onCollapsedChange?.(next, details)
        if (!details.canceled) setOwnCollapsed(next)
      }}
      className={cn(
        surfaceClassName,
        "group/sidebar h-full w-(--sidebar-width) shrink-0 overflow-hidden border-e bg-muted/(--glass-opacity) p-items backdrop-surface transition-all duration-panel ease-standard data-collapsed:w-(--sidebar-rail-width) motion-reduce:transition-none",
        className,
      )}
    >
      <div data-slot="sidebar-header" className="flex items-center gap-inline group-data-collapsed/sidebar:flex-col">
        <div className="min-w-0 flex-1 group-data-collapsed/sidebar:hidden">{header}</div>
        {collapsible && trigger && (
          <SidebarToggle
            aria-label={collapsed ? labels.expand : labels.collapse}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rtl:[&_svg]:-scale-x-100")}
          >
            <PanelIcon />
          </SidebarToggle>
        )}
      </div>
      <SidebarRailContext value={collapsed}>{body}</SidebarRailContext>
      {footer !== undefined && (
        <div data-slot="sidebar-footer" className="group-data-collapsed/sidebar:hidden">
          {footer}
        </div>
      )}
    </SidebarRoot>
  )
}

export { createSidebarController, Sidebar, SidebarGroup, SidebarItem, sidebarLabels, SidebarTrigger }
export type { SidebarController, SidebarLabels, SidebarProps }
export type { SidebarTriggerProps }
export type { SidebarGroupProps, SidebarItemProps }
