"use client"

import { useCallback, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react"
import { SearchIcon } from "lucide-react"

import { ShellSidebarSections, useMobileNavItems } from "@/components/ui/shell-nav"
import type { ShellRoute, ShellRouteGroup, ShellCurrent } from "@/components/ui/shell-routes"
import { ShellSearch } from "@/components/ui/shell-search"
import {
  CommandDialogOpenButton,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"
import { MobileNav } from "@/components/ui/mobile-nav"
import { Sidebar, SidebarTrigger, useSidebarState, type SidebarLabels } from "@/components/ui/sidebar"
import { setSidebarDrawerOpen } from "@/components/ui/sidebar-trigger"
import { SkipLink } from "@/components/ui/skip-link"
import { Topbar } from "@/components/ui/topbar"
import { useShellRoutes } from "@/components/ui/use-shell"
import { cn } from "@/lib/utils"

type ShellLabels = {
  skipToContent: string
  /** Names the sidebar's navigation landmark and its drawer. */
  sidebar: string
  /** Names the bottom bar's navigation landmark; keep it apart from `sidebar`, as both can show at once. */
  mobileNav: string
  /** The palette's group of routes. */
  goTo: string
  more: string
  /** The search triggers in the topbar. */
  openSearch: string
  /** The palette dialog's title. */
  palette: string
  /** Names the palette's input; keep it apart from `palette` and `openSearch`, so agents tell them apart. */
  search: string
  searchPlaceholder?: string
  /** Shown when nothing in the palette matches. */
  empty: string
  openNavigation: string
  closeNavigation: string
  collapseSidebar: string
  expandSidebar: string
}

const shellLabels: ShellLabels = {
  skipToContent: "Skip to content",
  sidebar: "Main",
  mobileNav: "Bottom bar",
  goTo: "Go to",
  more: "More",
  openSearch: "Search",
  palette: "Command palette",
  search: "Find a page or command",
  empty: "No results",
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
}

type ShellProps<Route extends ShellRoute = ShellRoute> = Omit<ComponentProps<"div">, "children"> & {
  /** Every route, in order: the sidebar, the bottom bar (`mobile: true`) and the palette's Go to group come from it. */
  routes: readonly Route[]
  /** The sidebar's groups, in order, with their labels and tone. Without them, routes group by their `group` text. */
  groups?: readonly ShellRouteGroup[]
  /** Marks the current route (`aria-current="page"`, the primary fill): its href, or a matcher for nested routes. */
  currentHref?: ShellCurrent<Route>
  /**
   * Takes over following a route from the sidebar, the bottom bar and the palette, for a client-side router:
   * `(href) => router.push(href)`. Without it, routes are plain links (fast links follow them on press), and a
   * hash router's `#/route` hrefs just work. Keep it stable (module level, `useCallback` or React Compiler) so a
   * navigation re-renders only the two routes whose current state changed.
   */
  onNavigate?: (href: string, route: Route) => void
  /** A logo or product name, after the sidebar trigger. */
  brand?: ReactNode
  /** The topbar's end: notifications, appearance, the account menu. */
  actions?: ReactNode
  /** More `CommandGroup`s in the palette, after Go to. */
  commandGroups?: ReactNode
  /** Runs the commands of `commandGroups` by value; the palette closes once a returned Promise settles. */
  onCommand?: (value: string) => unknown
  /** Below the sidebar's routes, like an account or a plan. */
  sidebarFooter?: ReactNode
  labels?: Partial<ShellLabels>
  /** Remembers whether the sidebar is collapsed in localStorage under this key. */
  storageKey?: string
  defaultCollapsed?: boolean
  /** `rail` keeps icons when collapsed; `hide` slides the sidebar away. Rail when every route has an icon. */
  collapse?: "rail" | "hide"
  /** Opens the palette from anywhere; `false` when the page already uses it. */
  searchShortcut?: string | false
  /** The id of the `<main>` landmark, the skip link's target. */
  mainId?: string
  /** `div` when the page already has its `<main>`, like a preview inside another page. */
  as?: "main" | "div"
  children?: ReactNode
}

// The theme's `narrow:` breakpoint, so the drawer, the bottom bar and the stacked layout switch together.
const narrowQuery = "(width <= 47.5rem)"

// Derived below the root, where a consumer's `--shell-height` is set.
const columns = {
  "--shell-column-height": "calc(var(--shell-height) - var(--topbar-height))",
  "--shell-scroll-margin": "calc(var(--topbar-height) + var(--gap-group))",
} as CSSProperties

/**
 * An application's shell from its routes: a skip link, a topbar with the sidebar trigger, a brand, search and
 * actions, a grouped sidebar that sticks under it (a drawer on narrow screens), a ⌘K palette that goes to any route,
 * a bottom bar on narrow screens and the main landmark. `--shell-height` (the viewport by default) is the height
 * of the box that scrolls the page, for a shell inside a pane.
 */
function Shell<Route extends ShellRoute>({
  routes,
  groups,
  currentHref,
  onNavigate,
  brand,
  actions,
  commandGroups,
  onCommand,
  sidebarFooter,
  labels: overrides,
  storageKey,
  defaultCollapsed,
  collapse,
  searchShortcut = "mod+k",
  mainId = "main",
  as: Main = "main",
  className,
  style,
  children,
  ...props
}: ShellProps<Route>) {
  const labels = { ...shellLabels, ...overrides }
  const collapseMode = collapse ?? (routes.every((route) => route.icon !== undefined) ? "rail" : "hide")
  const sidebarLabels: Partial<SidebarLabels> = {
    open: labels.openNavigation,
    close: labels.closeNavigation,
    collapse: labels.collapseSidebar,
    expand: labels.expandSidebar,
  }
  const sidebar = useSidebarState({ storageKey, defaultCollapsed })
  const [search] = useState(() => createCommandDialogController())
  const { sections, mobile, currentId } = useShellRoutes(routes, groups, currentHref)
  // Stable while the routes and onNavigate are, so a navigation re-renders only the items whose current changed.
  const navigate = useCallback(
    (id: string) => {
      const route = routes.find((candidate) => candidate.id === id)
      if (!route) return
      setSidebarDrawerOpen(sidebar.controller, false)
      if (onNavigate) onNavigate(route.href, route)
      else location.assign(route.href)
    },
    [routes, onNavigate, sidebar.controller],
  )
  const mobileNav = useMobileNavItems(mobile, currentId, onNavigate ? navigate : undefined)
  const hasMobileNav = mobileNav.items.length > 0

  return (
    <div
      data-slot="shell"
      className={cn("flex min-h-(--shell-height) w-full min-w-0 flex-col", className)}
      style={{ "--shell-height": "100dvh", ...style } as CSSProperties}
      {...props}
    >
      <SkipLink target={mainId}>{labels.skipToContent}</SkipLink>
      <Topbar
        leading={
          <>
            <SidebarTrigger {...sidebar.triggerProps} narrowQuery={narrowQuery} labels={sidebarLabels} />
            {brand}
          </>
        }
        center={
          <CommandDialogTrigger
            controller={search}
            shortcut={searchShortcut === false ? undefined : searchShortcut}
            className="w-full max-w-sm"
          >
            <span className="inline-flex min-w-0 items-center gap-inline">
              <SearchIcon className="size-4 shrink-0" />
              <span className="truncate">{labels.openSearch}</span>
            </span>
            <CommandDialogShortcut />
          </CommandDialogTrigger>
        }
        centerCompact={
          <CommandDialogOpenButton controller={search} variant="ghost" size="icon" aria-label={labels.openSearch}>
            <SearchIcon />
          </CommandDialogOpenButton>
        }
        trailing={actions}
      />
      <ShellSearch
        controller={search}
        sections={sections}
        currentId={currentId}
        navigate={navigate}
        labels={labels}
        commandGroups={commandGroups}
        onCommand={onCommand}
      />
      <div data-slot="shell-body" className="flex min-w-0 flex-1 items-start" style={columns}>
        <div
          data-slot="shell-sidebar"
          className="sticky top-(--topbar-height) flex h-(--shell-column-height) shrink-0 narrow:contents"
        >
          <Sidebar
            label={labels.sidebar}
            {...sidebar.sidebarProps}
            collapse={collapseMode}
            trigger={false}
            narrowQuery={narrowQuery}
            labels={sidebarLabels}
            footer={sidebarFooter}
          >
            <ShellSidebarSections sections={sections} currentId={currentId} navigate={navigate} />
          </Sidebar>
        </div>
        <Main
          id={mainId}
          tabIndex={-1}
          data-slot="shell-main"
          // Anchors, focus and scrollIntoView stop below the topbar and above the bottom bar.
          className={cn(
            "flex min-w-0 flex-1 flex-col self-stretch outline-none **:scroll-mt-(--shell-scroll-margin)",
            hasMobileNav && "narrow:**:scroll-mb-(--mobile-nav-offset)",
          )}
        >
          {children}
        </Main>
      </div>
      {hasMobileNav && (
        // Sticky in the flow rather than fixed: it keeps its own height at the end of the shell, so the page always
        // ends above it, and it stays inside a pane or an iframe.
        <MobileNav
          label={labels.mobileNav}
          items={mobileNav.items}
          overflow={mobileNav.overflow}
          moreLabel={labels.more}
          className="sticky"
        />
      )}
    </div>
  )
}

export { Shell, shellLabels }
export type { ShellRoute, ShellRouteGroup, ShellCurrent, ShellLabels, ShellProps }
