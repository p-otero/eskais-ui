import { useState } from "react"

import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

const statuses = ["pending", "error", "empty", "success"] as const
type Status = (typeof statuses)[number]

const projects = ["Apollo", "Gemini", "Mercury"]

function query(status: Status): { status: DataStatus; data: string[] | undefined; error?: Error } {
  if (status === "pending") return { status: "pending", data: undefined }
  if (status === "error") return { status: "error", data: undefined, error: new Error("The service answered 503.") }
  if (status === "empty") return { status: "success", data: [] }
  return { status: "success", data: projects }
}

export default function StatesDemo() {
  const [status, setStatus] = useState<Status>("success")
  const result = query(status)
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <Field>
        <FieldLabel>Status</FieldLabel>
        <SegmentedControl<Status> value={status} onValueChange={(next) => next && setStatus(next)}>
          <SegmentedControlIndicator />
          {statuses.map((name) => (
            <SegmentedControlItem key={name} value={name}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Field>
      <div className="flex min-h-40 rounded-surface border bg-background">
        <DataState
          status={result.status}
          data={result.data}
          error={result.error}
          onRetry={() => setStatus("success")}
          labels={{
            loading: "Loading projects",
            errorTitle: "Couldn't load projects",
            retry: "Retry loading projects",
            emptyTitle: "No projects yet",
          }}
        >
          {(items) => (
            <ul aria-label="Projects" className="flex w-full flex-col divide-y">
              {items.map((name) => (
                <li key={name} className="px-inset-item py-inset-item text-body">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </div>
    </div>
  )
}
