import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ui/code-block"
import type { DataTableColumn } from "@/components/ui/data-table"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Select } from "@/components/ui/select"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { usePageController } from "@/components/ui/use-server-data"

import {
  backendSource,
  serverTaskFilters,
  wireFilter,
  type Backend,
  type ServerTask,
  type WireFormat,
} from "../../examples/fixtures"

const backends: { value: Backend; label: string }[] = [
  { value: "page", label: "Page" },
  { value: "cursor", label: "Cursor" },
  { value: "spring", label: "Spring" },
]

const formats: { value: WireFormat; label: string }[] = [
  { value: "params", label: "Query params" },
  { value: "rsql", label: "RSQL" },
  { value: "odata", label: "OData" },
  { value: "spring", label: "Spring Filter" },
  { value: "graphql", label: "GraphQL where" },
  { value: "json", label: "JSON AST" },
  { value: "q", label: "q only" },
]

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
  { id: "points", header: "Points", cell: (task) => task.points, sortField: "points", align: "end" },
]

const labels = { errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }

function Backend({ backend, format }: { backend: Backend; format: WireFormat }) {
  const [wire, setWire] = useState("")
  const [source] = useState(() => backendSource(backend, setWire))
  const { state, controller } = usePageController(source, {
    filter: { status: ["open", "blocked"] },
    pageSize: 5,
    pageSizes: [5, 10, 25],
    search: { key: "q" },
  })
  return (
    <div className="flex flex-col gap-group">
      <ServerDataTable
        label="Backend tasks"
        source={source}
        columns={columns}
        filters={serverTaskFilters}
        filterUi="chips"
        controller={controller}
        labels={labels}
      />
      <div className="grid gap-items lg:grid-cols-2">
        <CodeBlock code={wire || "…"} language="bash" title="Request the adapter sent" wrap />
        <CodeBlock
          code={wireFilter(format, state.filter)}
          language={format === "graphql" || format === "json" ? "json" : "bash"}
          title="The filter in this wire format"
          wrap
        />
      </div>
    </div>
  )
}

export default function BackendSwitcher() {
  const [backend, setBackend] = useState<Backend>("page")
  const [format, setFormat] = useState<WireFormat>("rsql")
  return (
    <div
      data-slot="backend-switcher"
      className="flex w-full min-w-0 flex-col gap-group rounded-surface border p-inset-surface"
    >
      <div className="flex flex-wrap items-end gap-group">
        <Field>
          <FieldLabel>Backend</FieldLabel>
          <SegmentedControl value={backend} onValueChange={(next) => next && setBackend(next)}>
            <SegmentedControlIndicator />
            {backends.map((item) => (
              <SegmentedControlItem key={item.value} value={item.value}>
                {item.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </Field>
        <Field className="w-full max-w-48">
          <FieldLabel>Wire format</FieldLabel>
          <Select options={formats} value={format} onValueChange={(next) => next && setFormat(next)} />
        </Field>
      </div>
      <Backend key={backend} backend={backend} format={format} />
    </div>
  )
}
