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

type SidebarTriggerProps = Omit<ComponentProps<typeof Button>, "size" | "aria-label" | "onClick"> & {
  /** The controller passed to the Sidebar it toggles. */
  controller: SidebarController
  /** The sidebar's state, from `collapsed`/`onCollapsedChange`, for `aria-expanded` and the right name. */
  collapsed?: boolean
  labels?: Partial<SidebarLabels>
  /** Match the Sidebar's: on narrow screens it renders nothing, since the Sidebar shows its own drawer button. */
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
  if (narrow) return null
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

export { defaultNarrowQuery, PanelIcon, SidebarTrigger, sidebarLabels, useNarrow }
export type { SidebarLabels, SidebarTriggerProps }
