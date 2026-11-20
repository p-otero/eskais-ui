import { useState } from "react"
import { CalendarDaysIcon, HouseIcon, InboxIcon, SettingsIcon } from "lucide-react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Calendar } from "@/components/ui/calendar"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { List, ListItem } from "@/components/ui/list-item"
import { LogViewer } from "@/components/ui/log-viewer"
import { createLogStore } from "@/components/ui/log-viewer-store"
import { Sidebar, SidebarGroup, SidebarItem } from "@/components/ui/sidebar"
import { StatusDot } from "@/components/ui/status-pill"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

import { generateTasks } from "../../../../test/fixtures/agent-tasks"
import { simulatedLines } from "../sections/log-fixtures"

type Row = { id: string; title: string; from: string }

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `ROW-${String(index + 1)}`,
    title: `Row ${String(index + 1)}: a message subject long enough to wrap on narrow screens`,
    from: index % 3 === 0 ? "Maya Kowalski" : "Deploy bot",
  }))
}

function ListScenario({ count, virtualize }: { count: number; virtualize: "auto" | false }) {
  const rows = makeRows(count)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <List
        aria-label="Benchmark rows"
        items={rows}
        virtualize={virtualize}
        estimateSize={56}
        renderItem={(row) => (
          <ListItem
            id={row.id}
            title={row.title}
            subtitle={row.from}
            leading={<StatusDot tone="info" label="Unread" />}
            trailing="9:30"
            onSelect={() => {}}
          />
        )}
      />
    </div>
  )
}

type Deployment = { id: string; project: string; region: string; minutes: number; owner: string }

const regions = ["eu-west", "us-east", "ap-south"]
const deployments: Deployment[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `dep-${String(index + 1)}`,
  project: `${["Apollo", "Borealis", "Cygnus", "Draco"][index % 4] ?? ""} #${String(index + 1)}`,
  region: regions[index % 3] ?? "",
  minutes: ((index * 37) % 50) + 2,
  owner: index % 2 === 0 ? "Maya Kowalski" : "Deploy bot",
}))

const columns: DataTableColumn<Deployment>[] = [
  { id: "project", header: "Project", cell: (row) => row.project, sortValue: (row) => row.project },
  { id: "region", header: "Region", cell: (row) => row.region, sortValue: (row) => row.region },
  { id: "owner", header: "Owner", cell: (row) => row.owner },
  { id: "minutes", header: "Build minutes", cell: (row) => row.minutes, sortValue: (row) => row.minutes, align: "end" },
]

function TableScenario({ navigation }: { navigation?: "rows" | "cells" }) {
  return (
    <DataTable
      label="Deployments"
      navigation={navigation}
      rows={deployments}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.project}
      selectable
      // oxlint-disable-next-line shadcn/no-arbitrary-values -- the fixture geometry docs/perf/baseline.json was measured with
      className="max-h-[80dvh]"
    />
  )
}

const tabNames = Array.from({ length: 12 }, (_, index) => `View ${String(index + 1)}`)

function TabsScenario() {
  return (
    <Tabs defaultValue={tabNames[0]} className="w-full">
      <TabsList aria-label="Benchmark views">
        {tabNames.map((name) => (
          <TabsTab key={name} value={name}>
            {name}
          </TabsTab>
        ))}
      </TabsList>
      {tabNames.map((name) => (
        <TabsPanel key={name} value={name}>
          <ul className="flex flex-col gap-items">
            {makeRows(40).map((row) => (
              <li key={row.id}>
                {name}: {row.title}
              </li>
            ))}
          </ul>
        </TabsPanel>
      ))}
    </Tabs>
  )
}

const sidebarIcons = [HouseIcon, InboxIcon, CalendarDaysIcon, SettingsIcon]

function SidebarScenario() {
  return (
    // oxlint-disable-next-line shadcn/no-arbitrary-values -- the fixture geometry docs/perf/baseline.json was measured with
    <div className="flex h-[80dvh] overflow-hidden rounded-surface border">
      <Sidebar label="Benchmark navigation">
        {Array.from({ length: 6 }, (_group, group) => (
          <SidebarGroup key={group} label={`Group ${String(group + 1)}`}>
            {Array.from({ length: 10 }, (_, index) => {
              const Icon = sidebarIcons[index % sidebarIcons.length] ?? HouseIcon
              const id = `${String(group)}-${String(index)}`
              return (
                <SidebarItem key={id} href={`#item-${id}`} icon={<Icon />} current={id === "0-0"}>
                  {`Item ${id}`}
                </SidebarItem>
              )
            })}
          </SidebarGroup>
        ))}
      </Sidebar>
      <div className="flex-1 p-inset-surface">Page content</div>
    </div>
  )
}

const boardTasks = generateTasks(200)

function BoardScenario({ view }: { view: "board" | "table" }) {
  return <AgentTaskBoard mode="live" tasks={boardTasks} timeZone="UTC" defaultView={view} detailPresentation="dialog" />
}

// Ten thousand lines from three services, still: scrolling by key and stepping through errors, without a stream.
function LogViewerScenario() {
  const [store] = useState(() => {
    const created = createLogStore({ maxLines: 10_000 })
    created.append(simulatedLines(0, 10_000))
    return created
  })
  return (
    <LogViewer
      store={store}
      label="Perf log"
      sources={["frontend", "backend", "db"]}
      timestamps
      className="min-h-0 flex-1"
    />
  )
}

function CalendarScenario() {
  return <Calendar defaultValue="2026-11-17" locale="en-US" months={2} />
}

export {
  BoardScenario,
  CalendarScenario,
  ListScenario,
  LogViewerScenario,
  SidebarScenario,
  TableScenario,
  TabsScenario,
}
