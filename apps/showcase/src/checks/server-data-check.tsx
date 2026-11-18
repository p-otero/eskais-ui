import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import type { DataTableColumn } from "@/components/ui/data-table"
import { PageHeader } from "@/components/ui/page-header"
import { ServerDataTable, type ServerDataTableFilterUi } from "@/components/ui/server-data-table"
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

// ?demo=server-data-check&ui=search|chips|panel: a ServerDataTable over 312 tasks with 500 ms of latency and its
// state in the hash, for tooling/server-data-check.mjs and the screenshots it takes.
function ServerDataCheck() {
  const params = new URLSearchParams(location.search)
  const ui = uis.find((name) => name === params.get("ui")) ?? "search"
  const delay = Number(params.get("delay") ?? "500")
  const [source] = useState(() => taskSource({ key: ["check", ui], delay }))
  const [urlState] = useState(() => hashUrlState())
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-section p-section narrow:p-group">
      <PageHeader title="Tasks" description="Every task across the workspace, filtered and paged on the server." />
      <ServerDataTable
        label="Tasks"
        source={source}
        columns={columns}
        filters={serverTaskFilters}
        filterUi={ui}
        urlState={urlState}
        pageSize={10}
        getRowLabel={(task) => `${task.id} ${task.title}`}
        labels={{ errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }}
      />
    </main>
  )
}

export { ServerDataCheck }
