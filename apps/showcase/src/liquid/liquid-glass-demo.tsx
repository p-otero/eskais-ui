import { useState } from "react"

import {
  BellIcon,
  BoldIcon,
  BotIcon,
  ChartColumnIcon,
  CopyIcon,
  FolderIcon,
  HouseIcon,
  ItalicIcon,
  PauseIcon,
  PlayIcon,
  RocketIcon,
  SettingsIcon,
  ShareIcon,
  SkipBackIcon,
  SkipForwardIcon,
  TrashIcon,
  UnderlineIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Floating, FloatingContent } from "@/components/ui/floating"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { createSidebarController, Sidebar, SidebarGroup, SidebarItem, SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs"
import { ToastStack, toast } from "@/components/ui/toast"
import { Toggle } from "@/components/ui/toggle"
import { Topbar } from "@/components/ui/topbar"

import { AppearanceControls } from "../appearance"

const projects = [
  { name: "Apollo", detail: "Deployed 2 hours ago from main", tone: "success", state: "Ready" },
  { name: "Atlas", detail: "Building #1482, 3 of 7 steps", tone: "info", state: "Building" },
  { name: "Hermes", detail: "Failed 3 days ago on migrate", tone: "destructive", state: "Failed" },
  { name: "Gemini", detail: "Deployed yesterday by Ada", tone: "success", state: "Ready" },
  { name: "Orion", detail: "Waiting for review", tone: "warning", state: "Review" },
  { name: "Vega", detail: "Preview from feat/search", tone: "neutral", state: "Preview" },
] as const

const ranges = ["Day", "Week", "Month", "Year"] as const
type Range = (typeof ranges)[number]

function ProjectMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger variant="secondary">Project actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Redeploy</DropdownMenuItem>
        <DropdownMenuItem>Promote to production</DropdownMenuItem>
        <DropdownMenuItem>Copy deployment URL</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-agent-confirm="Deletes the project">Delete project</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Controls() {
  const [range, setRange] = useState<Range>("Week")
  const [playing, setPlaying] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-items">
      <SegmentedControl<Range> aria-label="Range" value={range} onValueChange={(next) => next && setRange(next)}>
        <SegmentedControlIndicator />
        {ranges.map((name) => (
          <SegmentedControlItem key={name} value={name}>
            {name}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <Button>Deploy</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="secondary" size="icon" aria-label="Share">
        <ShareIcon />
      </Button>
      <Toggle size="icon" aria-label="Bold" defaultPressed>
        <BoldIcon />
      </Toggle>
      <Toggle size="icon" variant="outline" aria-label="Italic">
        <ItalicIcon />
      </Toggle>
      <Toggle size="icon" aria-label="Underline">
        <UnderlineIcon />
      </Toggle>
      <ProjectMenu />
      <Button variant="outline" onClick={() => toast.success("Apollo deployed", { description: "Live in 42 s." })}>
        Show toast
      </Button>
      <Button variant="ghost" size="icon" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Button>
    </div>
  )
}

function LiquidGlassDemo() {
  const [controller] = useState(() => createSidebarController())
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="fixed inset-0 flex flex-col">
      <Topbar
        brand={<span className="text-title-sm">Northwind</span>}
        leading={<SidebarTrigger controller={controller} collapsed={collapsed} />}
        trailing={
          <Button variant="ghost" size="icon" aria-label="Notifications, 3 unread">
            <BellIcon />
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          label="Workspace"
          controller={controller}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          trigger={false}
        >
          <SidebarGroup label="Workspace">
            <SidebarItem href="#overview" icon={<HouseIcon />} current>
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
            <SidebarItem href="#usage" icon={<ChartColumnIcon />}>
              Usage
            </SidebarItem>
            <SidebarItem href="#settings" icon={<SettingsIcon />}>
              Settings
            </SidebarItem>
          </SidebarGroup>
        </Sidebar>
        <main className="relative flex min-w-0 flex-1 flex-col gap-group overflow-y-auto p-inset-surface">
          <AppearanceControls />
          <div className="flex flex-col gap-items">
            <h1 className="text-display-sm tracking-tight">Overview</h1>
            <Tabs defaultValue="Projects">
              <TabsList aria-label="Views" scrollable={false}>
                {["Projects", "Deployments", "Logs", "Usage"].map((view) => (
                  <TabsTab key={view} value={view}>
                    {view}
                  </TabsTab>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <Controls />
          <div className="grid grid-cols-3 gap-section narrow:grid-cols-1">
            {projects.map((project) => (
              <Card key={project.name}>
                <CardHeader>
                  <CardTitle headingLevel={2}>{project.name}</CardTitle>
                  <CardDescription>{project.detail}</CardDescription>
                  <Badge tone={project.tone} className="w-fit">
                    {project.state}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Floating side="bottom" align="center">
            <FloatingContent>
              <Button variant="ghost" size="icon" aria-label="Previous">
                <SkipBackIcon />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Play">
                <PlayIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next">
                <SkipForwardIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Copy link">
                <CopyIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete" data-agent-confirm="Deletes the track">
                <TrashIcon />
              </Button>
            </FloatingContent>
          </Floating>
        </main>
      </div>
      <ToastStack />
    </div>
  )
}

export { LiquidGlassDemo }
