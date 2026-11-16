import { useState } from "react"

import { StageFilter, StageTrack, type Stage } from "@/components/ui/stage-track"

import { Section } from "../section"

const pipeline: Stage[] = [
  { id: "branch", label: "Branch" },
  { id: "pr", label: "Pull request" },
  { id: "dev", label: "In Dev", tone: "info" },
  { id: "staging", label: "In Staging", tone: "warning" },
  { id: "prod", label: "In Prod", tone: "success" },
]

const changes = [
  { id: "c1", title: "Retry webhook deliveries with backoff", stage: "prod" },
  { id: "c2", title: "Paginate the audit log export", stage: "staging" },
  { id: "c3", title: "Show seat usage on the billing page", stage: "dev" },
  { id: "c4", title: "Drop the legacy CSV importer", stage: "pr" },
  { id: "c5", title: "Warm the search index on deploy", stage: "dev" },
  { id: "c6", title: "Rename workspace slugs", stage: "branch" },
]

const counts = Object.fromEntries(
  pipeline.map((stage) => [stage.id, changes.filter((change) => change.stage === stage.id).length]),
)

function StagesSection() {
  const [filter, setFilter] = useState<string[]>([])
  const visible = filter.length === 0 ? changes : changes.filter((change) => filter.includes(change.stage))
  return (
    <Section
      title="StageTrack"
      description="Where a change is in a configurable pipeline: the whole track, or only the current stage as a pill. StageFilter filters by stage with counts."
    >
      <div className="flex w-full min-w-0 flex-col gap-6">
        <StageTrack
          aria-label="Stage of Paginate the audit log export"
          stages={pipeline}
          current="staging"
          getHref={(stage) => (stage.id === "pr" ? "#pr-1287" : undefined)}
        />
        <StageTrack aria-label="Stage of Show seat usage" stages={pipeline} current="dev" size="sm" />
        <StageFilter
          aria-label="Filter changes by stage"
          stages={pipeline}
          counts={counts}
          value={filter}
          onValueChange={setFilter}
          size="sm"
          locale="en"
        />
        <ul className="flex flex-col gap-2" aria-label="Changes">
          {visible.map((change) => (
            <li key={change.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
    </Section>
  )
}

export { StagesSection }
