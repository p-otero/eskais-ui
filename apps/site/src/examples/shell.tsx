import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react"
import {
  ArchiveIcon,
  BellIcon,
  CalendarIcon,
  ChartColumnIcon,
  FolderIcon,
  InboxIcon,
  LayoutDashboardIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react"

import { Shell, type ShellRoute, type ShellRouteGroup } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

type Mode = "state" | "hash" | "links"

const pages: (Omit<ShellRoute, "href"> & { path: string })[] = [
  { id: "inbox", label: "Inbox", path: "/inbox", icon: InboxIcon, group: "work", mobile: true, badge: 3 },
  { id: "today", label: "Today", path: "/today", icon: SunIcon, group: "work", mobile: true },
  { id: "projects", label: "Projects", path: "/projects", icon: FolderIcon, group: "work", mobile: true },
  { id: "calendar", label: "Calendar", path: "/calendar", icon: CalendarIcon, group: "work", mobile: true },
  { id: "reports", label: "Reports", path: "/reports", icon: ChartColumnIcon, group: "work", keywords: ["stats"] },
  { id: "team", label: "Team", path: "/team", icon: UsersIcon, group: "work", keywords: ["people"] },
  { id: "dashboard", label: "Old dashboard", path: "/legacy", icon: LayoutDashboardIcon, group: "legacy" },
  { id: "archive", label: "Archive", path: "/archive", icon: ArchiveIcon, group: "legacy" },
]

const [inbox] = pages as [(typeof pages)[number], ...typeof pages]

const groups: ShellRouteGroup[] = [
  { id: "work", label: "Workspace" },
  { id: "legacy", label: "Retiring", tone: "muted" },
]

// A page load keeps the demo's route and mode in the query, so plain links (and middle clicks) land back here.
const query = new URLSearchParams(location.search)
const loadedPath = query.get("shell") ?? "/inbox"
const loadedMode: Mode = query.get("router") === "links" ? "links" : query.get("router") === "hash" ? "hash" : "state"

function hrefFor(mode: Mode, path: string) {
  if (mode === "hash") return `#${path}`
  return `?shell=${path}&router=${mode}#shell-demo`
}

function subscribeToHash(notify: () => void) {
  addEventListener("hashchange", notify)
  return () => removeEventListener("hashchange", notify)
}

// The demo scrolls inside its own box, so the shell measures its sticky columns against that box.
const pane = { "--shell-height": "36rem" } as CSSProperties

export default function ShellDemo() {
  const [mode, setMode] = useState<Mode>(loadedMode)
  const [statePath, setStatePath] = useState(loadedPath)
  const hash = useSyncExternalStore(subscribeToHash, () => location.hash)
  const routes = useMemo(() => pages.map((page) => ({ ...page, href: hrefFor(mode, page.path) })), [mode])
  // A history router: `router.push(href)`; here the route lives in state.
  const onNavigate = useCallback((_href: string, route: (typeof routes)[number]) => setStatePath(route.path), [])
  const path = mode === "state" ? statePath : mode === "hash" ? hash.slice(1) || "/inbox" : loadedPath
  const current = pages.find((page) => page.path === path) ?? inbox

  return (
    <div className="flex w-full flex-col gap-items">
      <Field>
        <FieldLabel>Router</FieldLabel>
        <SegmentedControl value={mode} onValueChange={(next) => next && setMode(next)}>
          <SegmentedControlIndicator />
          <SegmentedControlItem value="state">State (onNavigate)</SegmentedControlItem>
          <SegmentedControlItem value="hash">Hash (#/route)</SegmentedControlItem>
          <SegmentedControlItem value="links">Plain links</SegmentedControlItem>
        </SegmentedControl>
      </Field>
      <div id="shell-demo" className="h-144 w-full overflow-y-auto rounded-surface border bg-background">
        <Shell
          as="div"
          style={pane}
          routes={routes}
          groups={groups}
          currentHref={hrefFor(mode, current.path)}
          onNavigate={mode === "state" ? onNavigate : undefined}
          mainId="shell-demo-main"
          // The docs site already opens its own search with ⌘K.
          searchShortcut={false}
          brand={<span className="text-title-sm narrow:sr-only">Acme</span>}
          sidebarHeader={<p className="truncate px-inset-item text-caption text-muted-foreground">Acme workspace</p>}
          actions={
            <Button variant="ghost" size="icon" aria-label="Notifications (example)">
              <BellIcon />
            </Button>
          }
          labels={{
            skipToContent: "Skip to the example's content",
            sidebar: "Example app",
            mobileNav: "Example app, bottom bar",
            openSearch: "Search the example",
            searchPlaceholder: "Pages and commands",
            openNavigation: "Open the example's navigation",
            closeNavigation: "Close the example's navigation",
            collapseSidebar: "Collapse the example's sidebar",
            expandSidebar: "Expand the example's sidebar",
          }}
        >
          <PageLayout
            width="dense"
            header={
              <PageHeader
                headingLevel={3}
                eyebrow={mode === "state" ? "onNavigate" : mode === "hash" ? "Hash router" : "Plain links"}
                title={current.label}
                description={`Everything in ${current.label.toLowerCase()}, as of this morning.`}
              />
            }
          >
            <div className="flex flex-col gap-section">
              {["Design review", "Quarterly plan", "Hiring loop", "Launch checklist", "Support rota", "Budget"].map(
                (title) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle headingLevel={4}>{title}</CardTitle>
                      <CardDescription>Updated 2 hours ago by Ada.</CardDescription>
                    </CardHeader>
                  </Card>
                ),
              )}
            </div>
          </PageLayout>
        </Shell>
      </div>
    </div>
  )
}
