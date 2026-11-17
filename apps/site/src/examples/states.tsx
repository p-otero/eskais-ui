import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Field, FieldLabel } from "@/components/ui/field"
import { List, ListItem } from "@/components/ui/list-item"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { StatusPill } from "@/components/ui/status-pill"
import type { Tone } from "@/lib/tone"

const statuses = ["pending", "error", "empty", "success"] as const
type Status = (typeof statuses)[number]

type Project = { id: string; name: string; deployed: string; state: { label: string; tone: Tone } }

const projects: Project[] = [
  { id: "apollo", name: "Apollo", deployed: "Deployed 2 hours ago", state: { label: "Ready", tone: "success" } },
  { id: "gemini", name: "Gemini", deployed: "Building #1482", state: { label: "Building", tone: "info" } },
  { id: "mercury", name: "Mercury", deployed: "Failed 3 days ago", state: { label: "Failed", tone: "destructive" } },
]

function query(status: Status): { status: DataStatus; data: Project[] | undefined; error?: Error } {
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
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Your team's deployments.</CardDescription>
        </CardHeader>
        {/* One height for every status, so switching doesn't make the card jump. */}
        <CardContent className="flex min-h-48 flex-col">
          {/* A fresh state per status: DataState keeps the last data while it refetches, so switching from Success to
              Pending would keep the list and only add the refresh spinner. */}
          <DataState
            key={status}
            status={result.status}
            data={result.data}
            error={result.error}
            onRetry={() => setStatus("success")}
            labels={{
              loading: "Loading projects",
              errorTitle: "Couldn't load projects",
              retry: "Retry loading projects",
              emptyTitle: "No projects yet",
              emptyDescription: "Deploy one and it shows up here.",
            }}
          >
            {(items) => (
              // Pulled out by a row's inset, so the names line up with the card title.
              <List aria-label="Projects" className="-mx-(--item-padding-x)">
                {items.map((project) => (
                  <ListItem
                    key={project.id}
                    id={project.id}
                    title={project.name}
                    subtitle={project.deployed}
                    status={<StatusPill tone={project.state.tone}>{project.state.label}</StatusPill>}
                  />
                ))}
              </List>
            )}
          </DataState>
        </CardContent>
      </Card>
    </div>
  )
}
