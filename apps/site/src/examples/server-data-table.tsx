import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import type { DataTableColumn } from "@/components/ui/data-table"
import { Label } from "@/components/ui/label"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { Switch } from "@/components/ui/switch"

import { serverTaskFilters, taskSource, type ServerTask } from "./fixtures"

const failing = { on: false }
const source = taskSource({ key: ["docs", "server-data-table"], delay: 450, fail: () => failing.on })

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

export default function ServerDataTableDemo() {
  const [fail, setFail] = useState(false)
  return (
    <div className="flex w-full flex-col gap-group">
      <Label className="flex items-center gap-items self-start">
        <Switch
          checked={fail}
          onCheckedChange={(checked) => {
            failing.on = checked
            setFail(checked)
          }}
        />
        Fail requests
      </Label>
      <ServerDataTable
        label="Tasks"
        source={source}
        columns={columns}
        filters={serverTaskFilters}
        getRowLabel={(task) => `${task.id} ${task.title}`}
        pageSize={10}
        labels={{ errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }}
      />
    </div>
  )
}
