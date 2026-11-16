import { useState } from "react"

import { StageFilter, StageTrack, type Stage } from "@/components/ui/stage-track"

const pipeline: Stage[] = [
  { id: "branch", label: "Branch" },
  { id: "pr", label: "Pull request" },
  { id: "dev", label: "In Dev", tone: "info" },
  { id: "staging", label: "In Staging", tone: "warning" },
  { id: "prod", label: "In Prod", tone: "success" },
]

const changes = [
  { id: "c1", title: "Retry webhook deliveries", stage: "prod" },
  { id: "c2", title: "Paginate the audit log export", stage: "staging" },
  { id: "c3", title: "Show seat usage on billing", stage: "dev" },
  { id: "c4", title: "Drop the legacy CSV importer", stage: "pr" },
]

const counts = Object.fromEntries(
  pipeline.map((stage) => [stage.id, changes.filter((change) => change.stage === stage.id).length]),
)

export default function StageTrackDemo() {
  const [filter, setFilter] = useState<string[]>([])
  const visible = filter.length === 0 ? changes : changes.filter((change) => filter.includes(change.stage))
  return (
    <div className="flex w-full min-w-0 flex-col gap-group">
      <StageTrack aria-label="Stage of Paginate the audit log export" stages={pipeline} current="staging" />
      <StageFilter
        aria-label="Filter changes by stage"
        stages={pipeline}
        counts={counts}
        value={filter}
        onValueChange={setFilter}
        size="sm"
        locale="en"
      />
      <ul className="flex flex-col gap-items" aria-label="Changes">
        {visible.map((change) => (
          <li key={change.id} className="flex flex-wrap items-center justify-between gap-items text-body-sm">
            <span className="min-w-0">{change.title}</span>
            <StageTrack
              aria-label={`Stage of ${change.title}`}
              stages={pipeline}
              current={change.stage}
              variant="pill"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
