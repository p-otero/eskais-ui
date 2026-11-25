import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import type { DataTableColumn } from "@/components/ui/data-table"
import { ListItem } from "@/components/ui/list-item"
import { PageHeader } from "@/components/ui/page-header"
import { ServerDataTable, type ServerDataTableFilterUi } from "@/components/ui/server-data-table"
import { ServerList } from "@/components/ui/server-list"
import { hashUrlState } from "@/lib/url-state"

import { serverTaskFilters, taskSource, type ServerTask } from "../../../../test/fixtures/server-tasks"

const statusTone = { open: "info", in_progress: "violet", blocked: "warning", done: "success" } as const
const statusLabel = { open: "Open", in_progress: "In progress", blocked: "Blocked", done: "Done" } as const

const columns: DataTableColumn<ServerTask>[] = [
  {
    id: "id",
    header: "Task",
    cell: (task) => <span className="font-mono text-caption">{task.id}</span>,
    sortField: "id",
  },
  { id: "title", header: "Title", cell: (task) => task.title, sortField: "title" },
  {
    id: "status",
    header: "Status",
    cell: (task) => <Badge tone={statusTone[task.status]}>{statusLabel[task.status]}</Badge>,
  },
  { id: "assignee", header: "Assignee", cell: (task) => task.assignee, sortField: "assignee" },
  { id: "points", header: "Points", cell: (task) => task.points, sortField: "points", align: "end" },
]

const uis: ServerDataTableFilterUi[] = ["search", "chips", "panel"]

const labels = { errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }

function ServerListCheck({ source }: { source: ReturnType<typeof taskSource> }) {
  return (
    <ServerList<ServerTask, typeof serverTaskFilters>
      aria-label="Task list"
      source={source}
      filters={serverTaskFilters}
      pageSize={20}
      itemText={(task) => `${task.id} ${task.title}`}
      renderItem={(task) => <ListItem id={task.id} title={task.title} subtitle={task.id} onSelect={() => {}} />}
      labels={labels}
    />
  )
}

function ServerDataCheck() {
  const params = new URLSearchParams(location.search)
  const list = params.get("ui") === "list"
  const ui = uis.find((name) => name === params.get("ui")) ?? "search"
  const delay = Number(params.get("delay") ?? "500")
  const [source] = useState(() => taskSource({ key: ["check", ui], delay }))
  const [urlState] = useState(() => hashUrlState())
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-section p-section narrow:p-group">
      <PageHeader title="Tasks" description="Every task across the workspace, filtered and paged on the server." />
      {list ? <ServerListCheck source={source} /> : null}
      <ServerDataTable
        label="Tasks"
        source={source}
        columns={columns}
        filters={serverTaskFilters}
        filterUi={ui}
        urlState={urlState}
        pageSize={10}
        getRowLabel={(task) => `${task.id} ${task.title}`}
        labels={labels}
      />
    </main>
  )
}

export { ServerDataCheck }
