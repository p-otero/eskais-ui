"use client"

import { useMemo, useSyncExternalStore, type ComponentProps } from "react"
import { PanelLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { SidebarController } from "@/components/ui/sidebar-primitive"
import { cn } from "@/lib/utils"

type SidebarLabels = {
  collapse: string
  expand: string
  /** A SidebarTrigger's name when it isn't told whether the sidebar is collapsed. */
  toggle: string
  open: string
  close: string
}

const sidebarLabels: SidebarLabels = {
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  toggle: "Toggle sidebar",
  open: "Open navigation",
  close: "Close navigation",
}

const defaultNarrowQuery = "(max-width: 767px)"

function subscribeTo(query: string) {
  return (notify: () => void) => {
    if (typeof matchMedia !== "function") return () => {}
    const list = matchMedia(query)
    list.addEventListener("change", notify)
    return () => list.removeEventListener("change", notify)
  }
}

// The server and the first client render assume a wide screen, so hydration matches before the query runs.
function useNarrow(query: string) {
  const subscribe = useMemo(() => subscribeTo(query), [query])
  return useSyncExternalStore(
    subscribe,
    () => typeof matchMedia === "function" && matchMedia(query).matches,
    () => false,
  )
}

type DrawerState = { open: boolean; listeners: Set<() => void> }

// The sidebar's controller drives the collapsed rail, which UI SDK binds to the mounted <nav>. On narrow screens that
// <nav> lives inside a closed drawer, so a SidebarTrigger elsewhere opens the drawer through this state, keyed by the
// same controller, instead.
const drawers = new WeakMap<SidebarController, DrawerState>()

function drawerOf(controller: SidebarController) {
  let state = drawers.get(controller)
  if (!state) {
    state = { open: false, listeners: new Set() }
    drawers.set(controller, state)
  }
  return state
}

function setSidebarDrawerOpen(controller: SidebarController, open: boolean) {
  const state = drawerOf(controller)
  if (state.open === open) return
  state.open = open
  for (const listener of state.listeners) listener()
}

const noController: SidebarController = {
  setCollapsed: () => undefined,
  collapse: () => undefined,
  expand: () => undefined,
  toggle: () => undefined,
}

/** Whether the narrow-screen drawer of the Sidebar with this controller is open. */
function useSidebarDrawerOpen(controller: SidebarController | undefined) {
  const state = drawerOf(controller ?? noController)
  const subscribe = useMemo(
    () => (notify: () => void) => {
      state.listeners.add(notify)
      return () => {
        state.listeners.delete(notify)
      }
    },
    [state],
  )
  return useSyncExternalStore(
    subscribe,
    () => state.open,
    () => false,
  )
}

type SidebarTriggerProps = Omit<ComponentProps<typeof Button>, "size" | "aria-label" | "onClick"> & {
  /** The controller passed to the Sidebar it toggles. */
  controller: SidebarController
  /** The sidebar's state, from `collapsed`/`onCollapsedChange`, for `aria-expanded` and the right name. */
  collapsed?: boolean
  labels?: Partial<SidebarLabels>
  /**
   * Match the Sidebar's. On narrow screens the trigger opens the Sidebar's drawer instead of collapsing it; give the
   * Sidebar `trigger={false}` (or `narrowTrigger={false}`) so it doesn't render a drawer button of its own.
   */
  narrowQuery?: string
}

function SidebarTrigger({
  controller,
  collapsed,
  labels: labelOverrides,
  narrowQuery = defaultNarrowQuery,
  variant = "ghost",
  className,
  ...props
}: SidebarTriggerProps) {
  const labels = { ...sidebarLabels, ...labelOverrides }
  const narrow = useNarrow(narrowQuery)
  const drawerOpen = useSidebarDrawerOpen(controller)
  if (narrow) {
    return (
      <Button
        data-slot="sidebar-trigger"
        variant={variant}
        size="icon"
        aria-label={labels.open}
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        className={cn("rtl:[&_svg]:-scale-x-100", className)}
        onClick={() => setSidebarDrawerOpen(controller, true)}
        {...props}
      >
        <PanelIcon />
      </Button>
    )
  }
  const name = collapsed === undefined ? labels.toggle : collapsed ? labels.expand : labels.collapse
  return (
    <Button
      data-slot="sidebar-trigger"
      variant={variant}
      size="icon"
      aria-label={name}
      aria-expanded={collapsed === undefined ? undefined : !collapsed}
      className={cn("rtl:[&_svg]:-scale-x-100", className)}
      onClick={(event) => {
        controller.toggle({ reason: "trigger-press", event: event.nativeEvent })
      }}
      {...props}
    >
      <PanelLeftIcon />
    </Button>
  )
}

/** @deprecated Import `PanelLeftIcon` from `lucide-react`. */
const PanelIcon = PanelLeftIcon

export {
  defaultNarrowQuery,
  PanelIcon,
  setSidebarDrawerOpen,
  SidebarTrigger,
  sidebarLabels,
  useNarrow,
  useSidebarDrawerOpen,
}
export type { SidebarLabels, SidebarTriggerProps }
