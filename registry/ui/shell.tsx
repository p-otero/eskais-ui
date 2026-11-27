"use client"

import { useCallback, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react"
import { SearchIcon } from "lucide-react"

import { ShellSidebarSections, useMobileNavItems } from "@/components/ui/shell-nav"
import {
  placedIn,
  type ShellMain,
  type ShellPlacement,
  type ShellRoute,
  type ShellRouteGroup,
  type ShellCurrent,
} from "@/components/ui/shell-routes"
import { ShellSearch, type ShellSearchProps } from "@/components/ui/shell-search"
import {
  CommandDialogOpenButton,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"
import { MobileNav } from "@/components/ui/mobile-nav"
import {
  Sidebar,
  SidebarTrigger,
  useSidebarState,
  type SidebarDensity,
  type SidebarGroupSpacing,
  type SidebarLabels,
  type SidebarState,
} from "@/components/ui/sidebar"
import { setSidebarDrawerOpen } from "@/components/ui/sidebar-trigger"
import { SkipLink } from "@/components/ui/skip-link"
import { Topbar } from "@/components/ui/topbar"
import { ShellSidebarContext, useShellRoutes, useShellSidebar } from "@/components/ui/use-shell"
import { cn, cssVars } from "@/lib/utils"

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
  /**
   * Every route, in order: the sidebar, the bottom bar (`mobile`), its More sheet and the palette's Go to group come
   * from it. A route's `placements` limits where it shows.
   */
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
  /**
   * Runs when someone is about to follow a sidebar route (a 65 ms hover, focus, a press), to preload its code or
   * data: `(href) => router.preload(href)`. It can run more than once per visit; keep it idempotent and stable.
   */
  onIntent?: (href: string, route: Route) => void
  /** A logo or product name, after the sidebar trigger. */
  brand?: ReactNode
  /** The topbar's end: notifications, appearance, an `AccountMenu`. It stays in place in every sidebar layout. */
  actions?: ReactNode
  /** More `CommandGroup`s in the palette, after Go to. */
  commandGroups?: ReactNode
  /** Runs the commands of `commandGroups` by value; the palette closes once a returned Promise settles. */
  onCommand?: (value: string) => unknown
  /**
   * Above the sidebar's routes, like a brand, a workspace switcher or a caption. Hidden while the sidebar is a rail;
   * in the narrow drawer it sits under the drawer's title.
   */
  sidebarHeader?: ReactNode
  /** Below the sidebar's routes, like an account or a plan. */
  sidebarFooter?: ReactNode
  labels?: Partial<ShellLabels>
  /** Remembers whether the sidebar is collapsed in localStorage under this key. */
  storageKey?: string
  defaultCollapsed?: boolean
  /**
   * The sidebar's state, from your own `useSidebarState()`, to read or toggle it outside the Shell. Then `storageKey`
   * and `defaultCollapsed` go to that call instead. Inside the Shell, `useShellSidebar()` returns the state either way.
   */
  sidebar?: SidebarState
  /**
   * A shortcut that toggles the sidebar, like `"mod+b"`: it collapses or expands it on wide screens and opens the
   * drawer on narrow ones. Off by default. The topbar's trigger shows it and `ShortcutsDialog` lists it.
   */
  sidebarShortcut?: string
  /** `rail` keeps icons when collapsed; `hide` slides the sidebar away. Rail when every route has an icon. */
  collapse?: "rail" | "hide"
  /** The sidebar's own density, apart from the page's, which `<main>` keeps. Follows the page when left out. */
  sidebarDensity?: SidebarDensity
  /** The space between the sidebar's groups: `"default"`, `"compact"`, or a length or `var()`. */
  sidebarGroupGap?: SidebarGroupSpacing
  /** The height of the sidebar's group labels: `"default"`, `"compact"`, or a length or `var()`. */
  sidebarGroupHeaderHeight?: SidebarGroupSpacing
  /** Opens the palette from anywhere; `false` when the page already uses it. */
  searchShortcut?: string | false
  /** The palette's search text, to control it. Without it, every open starts empty (or from `defaultSearchQuery`). */
  searchQuery?: string
  /** The search text each open of the palette starts from, when `searchQuery` doesn't control it. */
  defaultSearchQuery?: string
  onSearchQueryChange?: ShellSearchProps["onQueryChange"]
  /** At the bottom of the palette, like key hints (`<Kbd>↑</Kbd><Kbd>↓</Kbd>` and their words). Nothing by default. */
  searchFooter?: ReactNode
  /**
   * `fill` gives `<main>` the height left under the topbar and above the bottom bar (`--shell-column-height`), so a
   * page like a DocumentWorkspace fills it with `h-full`; its content scrolls inside. `flow` (default) lets the page
   * scroll. A route's `main` overrides it while that route is current.
   */
  main?: ShellMain
  /** The id of the `<main>` landmark, the skip link's target. */
  mainId?: string
  /** `div` when the page already has its `<main>`, like a preview inside another page. */
  as?: "main" | "div"
  children?: ReactNode
}

const narrowQuery = "(width <= 47.5rem)"

const columns = cssVars({
  "--shell-column-height": "calc(var(--shell-height) - var(--topbar-height))",
  "--shell-scroll-margin": "calc(var(--topbar-height) + var(--gap-group))",
  "--shell-column-height-above-bar": "calc(var(--shell-column-height) - var(--mobile-nav-offset))",
})

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
  onIntent,
  brand,
  actions,
  commandGroups,
  onCommand,
  sidebarHeader,
  sidebarFooter,
  labels: overrides,
  storageKey,
  defaultCollapsed,
  sidebar: sidebarState,
  sidebarShortcut,
  collapse,
  sidebarDensity,
  sidebarGroupGap,
  sidebarGroupHeaderHeight,
  searchShortcut = "mod+k",
  searchQuery,
  defaultSearchQuery,
  onSearchQueryChange,
  searchFooter,
  main = "flow",
  mainId = "main",
  as: Main = "main",
  className,
  style,
  children,
  ...props
}: ShellProps<Route>) {
  const labels = { ...shellLabels, ...overrides }
  const collapseMode =
    collapse ?? (routes.every((route) => route.icon !== undefined || !placedIn(route, "sidebar")) ? "rail" : "hide")
  const sidebarLabels: Partial<SidebarLabels> = {
    open: labels.openNavigation,
    close: labels.closeNavigation,
    collapse: labels.collapseSidebar,
    expand: labels.expandSidebar,
  }
  const ownSidebar = useSidebarState({ storageKey, defaultCollapsed })
  const sidebar = sidebarState ?? ownSidebar
  const [search] = useState(() => createCommandDialogController())
  const { sections, paletteSections, mobile, currentId } = useShellRoutes(routes, groups, currentHref)
  // Perf: stable while the routes and onNavigate are, so a navigation re-renders only the items whose current changed.
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
  const intent = useCallback(
    (id: string) => {
      const route = routes.find((candidate) => candidate.id === id)
      if (route) onIntent?.(route.href, route)
    },
    [routes, onIntent],
  )
  const mobileNav = useMobileNavItems(mobile, currentId, onNavigate ? navigate : undefined)
  const hasMobileNav = mobileNav.items.length > 0
  const mainLayout = routes.find((route) => route.id === currentId)?.main ?? main

  return (
    <ShellSidebarContext value={sidebar}>
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
              <SidebarTrigger
                {...sidebar.triggerProps}
                narrowQuery={narrowQuery}
                labels={sidebarLabels}
                shortcut={sidebarShortcut}
              />
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
          sections={paletteSections}
          currentId={currentId}
          navigate={navigate}
          labels={labels}
          commandGroups={commandGroups}
          onCommand={onCommand}
          query={searchQuery}
          defaultQuery={defaultSearchQuery}
          onQueryChange={onSearchQueryChange}
          footer={searchFooter}
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
              density={sidebarDensity}
              groupGap={sidebarGroupGap}
              groupHeaderHeight={sidebarGroupHeaderHeight}
              trigger={false}
              narrowQuery={narrowQuery}
              labels={sidebarLabels}
              header={sidebarHeader}
              footer={sidebarFooter}
            >
              <ShellSidebarSections
                sections={sections}
                currentId={currentId}
                navigate={navigate}
                intent={onIntent ? intent : undefined}
              />
            </Sidebar>
          </div>
          <Main
            id={mainId}
            tabIndex={-1}
            data-slot="shell-main"
            data-main={mainLayout}
            className={cn(
              "flex min-w-0 flex-1 flex-col self-stretch focus:outline-none **:scroll-mt-(--shell-scroll-margin)",
              hasMobileNav && "narrow:**:scroll-mb-(--mobile-nav-offset)",
              // oxlint-disable-next-line eskais/scroll-area -- the page-level main column: its viewport would re-read every focusable element on the page at each roving tabindex change, so it scrolls like the window
              mainLayout === "fill" && "h-(--shell-column-height) min-h-0 overflow-auto",
              mainLayout === "fill" && hasMobileNav && "narrow:h-(--shell-column-height-above-bar)",
            )}
          >
            {children}
          </Main>
        </div>
        {hasMobileNav && (
          <MobileNav
            label={labels.mobileNav}
            items={mobileNav.items}
            overflow={mobileNav.overflow}
            moreLabel={labels.more}
            className="sticky"
          />
        )}
      </div>
    </ShellSidebarContext>
  )
}

export { Shell, shellLabels, useShellSidebar }
export type { ShellMain, ShellRoute, ShellPlacement, ShellRouteGroup, ShellCurrent, ShellLabels, ShellProps }
