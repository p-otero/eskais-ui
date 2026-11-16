import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createCommandDialogController } from "@/components/ui/command-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MobileNav } from "@/components/ui/mobile-nav"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"
import { createSidebarController, Sidebar, SidebarGroup, SidebarItem, SidebarTrigger } from "@/components/ui/sidebar"
import { SkipLink } from "@/components/ui/skip-link"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { Topbar } from "@/components/ui/topbar"

import { GlobalSearch, SearchCompactTrigger, SearchTrigger } from "./global-search"
import { BellIcon, BotIcon, ChartIcon, FolderIcon, GearIcon, HomeIcon, RocketIcon } from "./shell-icons"

const views = ["Overview", "Deployments", "Logs", "Analytics", "Agents", "Usage", "Domains", "Secrets", "Settings"]
const initialView = views.find((view) => view === new URLSearchParams(location.search).get("view")) ?? "Overview"

const projects = [
  { name: "Apollo", detail: "Deployed 2 hours ago", tone: "success", state: "Ready" },
  { name: "Atlas", detail: "Building #1482", tone: "info", state: "Building" },
  { name: "Hermes", detail: "Failed 3 days ago", tone: "destructive", state: "Failed" },
  { name: "Gemini", detail: "Deployed yesterday", tone: "success", state: "Ready" },
] as const

function Brand() {
  return (
    <a
      href="#home"
      className="inline-flex items-center gap-2 rounded-control text-title-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-primary">
        <path fill="currentColor" d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L18.8 8 12 11.7 5.2 8 12 4.3Z" />
      </svg>
      <span className="narrow:sr-only">Northwind</span>
    </a>
  )
}

function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="ghost" size="icon" aria-label="Account">
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
        >
          AL
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ShellDemo() {
  const [controller] = useState(() => createSidebarController())
  const [collapsed, setCollapsed] = useState(false)
  const [search] = useState(() => createCommandDialogController())

  return (
    <div className="fixed inset-0 flex flex-col">
      <SkipLink>Skip to content</SkipLink>
      <Topbar
        brand={<Brand />}
        leading={<SidebarTrigger controller={controller} collapsed={collapsed} />}
        center={<SearchTrigger controller={search} />}
        centerCompact={<SearchCompactTrigger controller={search} />}
        trailing={
          <>
            <Button variant="ghost" size="icon" aria-label="Notifications, 3 unread">
              <BellIcon />
            </Button>
            <AccountMenu />
          </>
        }
      />
      <GlobalSearch controller={search} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          label="Workspace"
          controller={controller}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          trigger={false}
        >
          <SidebarGroup label="Workspace">
            <SidebarItem href="#overview" icon={<HomeIcon />} current>
              Overview
            </SidebarItem>
            <SidebarItem href="#projects" icon={<FolderIcon />} badge={4}>
              Projects
            </SidebarItem>
            <SidebarItem href="#deployments" icon={<RocketIcon />}>
              Deployments
            </SidebarItem>
            <SidebarItem href="#agents" icon={<BotIcon />}>
              Agents
            </SidebarItem>
          </SidebarGroup>
          <SidebarGroup label="Account">
            <SidebarItem href="#usage" icon={<ChartIcon />}>
              Usage
            </SidebarItem>
            <SidebarItem href="#settings" icon={<GearIcon />}>
              Settings
            </SidebarItem>
          </SidebarGroup>
        </Sidebar>
        <Tabs defaultValue={initialView} className="min-w-0 flex-1">
          <PageLayout
            as="main"
            width="dense"
            className="min-h-0 flex-1 overflow-y-auto narrow:mb-(--mobile-nav-offset)"
            header={
              <PageHeader
                eyebrow="Workspace"
                title="Overview"
                description="Every project, its latest deployment and what needs a look."
                actions={<Button>New project</Button>}
                tabs={
                  <TabsList aria-label="Workspace views">
                    {views.map((view) => (
                      <TabsTab key={view} value={view}>
                        {view}
                      </TabsTab>
                    ))}
                  </TabsList>
                }
              />
            }
          >
            {views.map((view) => (
              <TabsPanel key={view} value={view}>
                <div className="grid gap-section md:grid-cols-2">
                  {projects.map((project) => (
                    <Card key={project.name}>
                      <CardHeader>
                        <CardTitle headingLevel={2}>
                          {project.name} {view === "Overview" ? "" : view.toLowerCase()}
                        </CardTitle>
                        <CardDescription>{project.detail}</CardDescription>
                        <Badge tone={project.tone} className="w-fit">
                          {project.state}
                        </Badge>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsPanel>
            ))}
          </PageLayout>
        </Tabs>
      </div>
      <MobileNav
        label="Workspace"
        items={[
          { label: "Overview", href: "#overview", icon: <HomeIcon />, current: true },
          { label: "Projects", href: "#projects", icon: <FolderIcon />, badge: 4 },
          { label: "Deploys", href: "#deployments", icon: <RocketIcon /> },
          { label: "Agents", href: "#agents", icon: <BotIcon /> },
        ]}
        overflow={[
          { label: "Usage", href: "#usage", icon: <ChartIcon /> },
          { label: "Settings", href: "#settings", icon: <GearIcon /> },
        ]}
      />
    </div>
  )
}

export { ShellDemo }
