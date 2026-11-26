import { useCallback, useMemo, useState, useSyncExternalStore } from "react"
import {
  ArchiveIcon,
  BellIcon,
  CalendarIcon,
  ChartColumnIcon,
  FolderIcon,
  InboxIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react"

import { AccountMenu } from "@/components/ui/account-menu"
import { Shell, type ShellRoute, type ShellRouteGroup } from "@/components/ui/shell"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentWorkspace } from "@/components/ui/document-workspace"
import { Kbd } from "@/components/ui/kbd"
import { CommandGroup, CommandGroupLabel, CommandItem, CommandItemIcon } from "@/components/ui/command"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { toast, ToastStack } from "@/components/ui/toast"

const params = new URLSearchParams(location.search)
const hashMode = params.get("router") === "hash"
const fillMode = params.get("main") === "fill"

const pages: ShellRoute[] = [
  { id: "inbox", label: "Inbox", href: "/inbox", icon: InboxIcon, group: "work", mobile: true, badge: 3 },
  { id: "today", label: "Today", href: "/today", icon: SunIcon, group: "work", mobile: true },
  { id: "projects", label: "Projects", href: "/projects", icon: FolderIcon, group: "work", mobile: true },
  { id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarIcon, group: "work", mobile: true },
  { id: "reports", label: "Reports", href: "/reports", icon: ChartColumnIcon, group: "work", keywords: ["stats"] },
  { id: "team", label: "Team", href: "/team", icon: UsersIcon, group: "work", keywords: ["people"] },
  { id: "dashboard", label: "Old dashboard", href: "/legacy", icon: LayoutDashboardIcon, group: "legacy" },
  { id: "archive", label: "Archive", href: "/archive", icon: ArchiveIcon, group: "legacy" },
]

const routes = hashMode ? pages.map((page) => ({ ...page, href: `#${page.href}` })) : pages

const groups: ShellRouteGroup[] = [
  { id: "work", label: "Workspace" },
  { id: "legacy", label: "Retiring", tone: "muted" },
]

const cards = Array.from({ length: 12 }, (_, index) => `Project ${String(index + 1)}`)

function subscribeToHash(notify: () => void) {
  addEventListener("hashchange", notify)
  return () => removeEventListener("hashchange", notify)
}

function ShellBlockDemo() {
  const [statePath, setStatePath] = useState("/inbox")
  const hash = useSyncExternalStore(subscribeToHash, () => location.hash)
  const currentHref = hashMode ? hash || "#/inbox" : statePath
  const onNavigate = useCallback((href: string) => setStatePath(href), [])
  const current = useMemo(() => routes.find((route) => route.href === currentHref), [currentHref])

  return (
    <>
      <Shell
        routes={routes}
        groups={groups}
        currentHref={currentHref}
        onNavigate={hashMode ? undefined : onNavigate}
        storageKey="showcase-shell"
        sidebarShortcut="mod+b"
        main={fillMode ? "fill" : "flow"}
        searchFooter={
          <>
            <span className="inline-flex items-center gap-inline">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-inline">
              <Kbd>Esc</Kbd>
              close
            </span>
          </>
        }
        sidebarHeader={<p className="truncate px-inset-item text-caption text-muted-foreground">Acme workspace</p>}
        labels={{ searchPlaceholder: "Pages and commands" }}
        brand={<span className="text-title-sm narrow:sr-only">Acme</span>}
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <BellIcon />
            </Button>
            <AccountMenu
              user={{ name: "Ana Ruiz", email: "ana@acme.example" }}
              roleLabel="Admin"
              items={[{ value: "devices", label: "Devices" }]}
              signOutLabel="Sign out"
              onSignOut={() => toast("Signed out")}
            />
          </>
        }
        commandGroups={
          <CommandGroup>
            <CommandGroupLabel>Actions</CommandGroupLabel>
            <CommandItem value="new-project">
              <CommandItemIcon>
                <PlusIcon />
              </CommandItemIcon>
              New project
            </CommandItem>
          </CommandGroup>
        }
        onCommand={(value) => toast(`Ran ${value}`)}
      >
        {fillMode ? (
          <DocumentWorkspace
            explorer={<p className="p-inset-surface text-body-sm">Notes</p>}
            document={
              <div data-testid="fill-document" className="flex flex-col gap-group p-inset-surface">
                {cards.map((title) => (
                  <p key={title}>{title}: a paragraph long enough to make the document scroll on its own.</p>
                ))}
              </div>
            }
          />
        ) : (
          <PageLayout
            width="dense"
            header={
              <PageHeader
                eyebrow="Workspace"
                title={current?.label ?? "Not found"}
                description="Everything that needs a look, newest first."
              />
            }
          >
            <div className="grid gap-section md:grid-cols-2">
              {cards.map((title) => (
                <Card key={title} data-testid={title === cards.at(-1) ? "last-card" : undefined}>
                  <CardHeader>
                    <CardTitle headingLevel={2}>{title}</CardTitle>
                    <CardDescription>Updated 2 hours ago.</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </PageLayout>
        )}
      </Shell>
      <ToastStack />
    </>
  )
}

export { ShellBlockDemo }
