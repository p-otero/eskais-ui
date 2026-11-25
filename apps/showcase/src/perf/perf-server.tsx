import { useState } from "react"

import type { DataTableColumn } from "@/components/ui/data-table"
import { ListItem } from "@/components/ui/list-item"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { ServerList } from "@/components/ui/server-list"

import { serverTaskFilters, taskSource, type ServerTask } from "../../../../test/fixtures/server-tasks"

const columns: DataTableColumn<ServerTask>[] = [
  { id: "id", header: "Task", cell: (task) => task.id, sortField: "id" },
  { id: "title", header: "Title", cell: (task) => task.title, sortField: "title" },
  { id: "assignee", header: "Assignee", cell: (task) => task.assignee, sortField: "assignee" },
  { id: "points", header: "Points", cell: (task) => task.points, sortField: "points", align: "end" },
]

const labels = { errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }

const fixtureDelay = Number(new URLSearchParams(globalThis.location?.search).get("delay") ?? 0)

function ServerDataTableScenario() {
  const [source] = useState(() => taskSource({ key: ["perf", "table"], delay: fixtureDelay }))
  return (
    <ServerDataTable
      label="Tasks"
      source={source}
      columns={columns}
      filters={serverTaskFilters}
      pageSize={100}
      selectable
      getRowLabel={(task) => `${task.id} ${task.title}`}
      labels={labels}
    />
  )
}

function ServerListScenario() {
  const [source] = useState(() => taskSource({ key: ["perf", "list"], delay: fixtureDelay }))
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ServerList<ServerTask, typeof serverTaskFilters>
        aria-label="Task list"
        source={source}
        filters={serverTaskFilters}
        pageSize={400}
        itemText={(task) => `${task.id} ${task.title}`}
        renderItem={(task) => <ListItem id={task.id} title={task.title} subtitle={task.id} onSelect={() => {}} />}
        labels={labels}
      />
    </div>
  )
}

export { ServerDataTableScenario, ServerListScenario }
