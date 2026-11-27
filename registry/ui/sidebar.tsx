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
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@/components/ui/scroll-area"
import { ControlTooltip } from "@/components/ui/tooltip"
import { cn, cssVars } from "@/lib/utils"
import { useSidebarState, type SidebarState, type SidebarStateOptions } from "@/components/ui/use-sidebar-state"

const { Root: SidebarRoot, Trigger: SidebarToggle } = createParts(sidebar, { root: "nav", trigger: "button" })

type SidebarDensity = "default" | "compact"

/** `"default"`, `"compact"`, or any CSS length or `var()`, like `"var(--gap-items)"` or `"0.25rem"`. */
type SidebarGroupSpacing = SidebarDensity | (string & {})

type SidebarProps = {
  label: string
  /**
   * The sidebar's own density, apart from the page's: `"compact"` tightens its items, spacing and type and narrows
   * it, `"default"` keeps the default density inside a compact page. Follows the page when left out.
   */
  density?: SidebarDensity
  /**
   * The space between groups (`--sidebar-group-gap`). `"default"` is `gap-group`, `"compact"` is `gap-items`; a
   * length or `var()` sets it exactly. Lists of collapsible groups keep 1px unless it's a length.
   */
  groupGap?: SidebarGroupSpacing
  /**
   * The height of the groups' headers (`--sidebar-group-header-height`). `"default"` keeps a label's line and a
   * collapsible group's trigger at the control height; `"compact"` tightens the label's line and makes the trigger
   * `control-height-sm`; a length or `var()` gives both that height.
   */
  groupHeaderHeight?: SidebarGroupSpacing
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

const surfaceClassName = "group/sidebar flex min-h-0 flex-col gap-group text-foreground"

function exactValue(spacing: SidebarGroupSpacing | undefined) {
  return spacing === undefined || spacing === "default" || spacing === "compact" ? undefined : spacing
}

function sidebarScale(
  density: SidebarDensity | undefined,
  groupGap: SidebarGroupSpacing | undefined,
  groupHeaderHeight: SidebarGroupSpacing | undefined,
) {
  return {
    "data-density": density,
    "data-group-gap": groupGap === "compact" ? groupGap : undefined,
    "data-group-header": groupHeaderHeight === "compact" ? groupHeaderHeight : undefined,
    style: cssVars({
      "--sidebar-group-gap": exactValue(groupGap),
      "--sidebar-group-header-height": exactValue(groupHeaderHeight),
    }),
  }
}

function Sidebar({
  label,
  density,
  groupGap,
  groupHeaderHeight,
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
  const scale = sidebarScale(density, groupGap, groupHeaderHeight)

  const body = (
    <ScrollArea className="flex min-h-0 flex-1 flex-col">
      <ScrollAreaViewport aria-label={label} className="h-auto min-h-0 flex-1">
        <ScrollAreaContent className="flex flex-col gap-(--sidebar-group-gap,var(--gap-group)) not-has-[>:not([data-collapsible])]:gap-(--sidebar-group-gap,1px) group-data-[group-gap=compact]/sidebar:has-[>:not([data-collapsible])]:gap-(--sidebar-group-gap,var(--gap-items))">
          {children}
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar>
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollArea>
  )

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
          data-density={density}
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
          <SidebarRoot aria-label={label} collapsed={false} {...scale} className={cn(surfaceClassName, "flex-1")}>
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
      {...scale}
      collapsed={collapsed}
      controller={controller}
      onCollapsedChange={(next, details) => {
        onCollapsedChange?.(next, details)
        if (!details.canceled) setOwnCollapsed(next)
      }}
      className={cn(
        surfaceClassName,
        // oxlint-disable-next-line shadcn/no-arbitrary-values -- transitions only the properties that move; transition-all also eased every colour and shadow change
        "h-full w-(--sidebar-width) shrink-0 overflow-hidden border-e bg-muted/(--glass-opacity) p-items backdrop-surface transition-[width] duration-panel ease-standard data-collapsed:w-(--sidebar-rail-width) motion-reduce:transition-none",
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
export type { SidebarController, SidebarDensity, SidebarGroupSpacing, SidebarLabels, SidebarProps }
export type { SidebarTriggerProps }
export type { SidebarGroupProps, SidebarItemProps }
