import { useId, useState } from "react"

import { DependencyChips, type DependencyChip } from "@/components/ui/dependency-chips"
import { StatusDot, StatusPill } from "@/components/ui/status-pill"

import { Section } from "../section"

const upstream: DependencyChip[] = [
  { id: "schema", label: "Design the schema", tone: "success" },
  { id: "migration", label: "Write the migration for every table in the warehouse", tone: "warning" },
  { id: "access", label: "Review access", tone: "destructive" },
  { id: "fixtures", label: "Seed fixtures", tone: "muted" },
  { id: "load", label: "Load test", tone: "info" },
  { id: "docs", label: "Update the runbook", tone: "neutral" },
]

function StatusSection() {
  const upstreamId = useId()
  const downstreamId = useId()
  const [selected, setSelected] = useState<string>()
  const selectedLabel = upstream.find((item) => item.id === selected)?.label

  return (
    <Section
      title="StatusPill and DependencyChips"
      description="Tinted status pills with an optional pulsing dot, and chip lists that agents can press when onSelect is set."
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="neutral">Draft</StatusPill>
        <StatusPill tone="info" dot pulse>
          Running
        </StatusPill>
        <StatusPill tone="success" dot>
          Passed
        </StatusPill>
        <StatusPill tone="warning" dot>
          Waiting
        </StatusPill>
        <StatusPill tone="destructive" dot>
          Failed
        </StatusPill>
        <StatusPill tone="violet">Design</StatusPill>
        <StatusPill tone="muted">Archived</StatusPill>
      </div>
      <ul className="flex flex-wrap items-center gap-4 text-sm">
        <li className="flex items-center gap-1.5">
          <StatusDot tone="success" label="Online" pulse />
          api-1
        </li>
        <li className="flex items-center gap-1.5">
          <StatusDot tone="warning" label="Degraded" />
          api-2
        </li>
        <li className="flex items-center gap-1.5">
          <StatusDot tone="destructive" label="Offline" />
          worker-1
        </li>
        <li className="flex items-center gap-1.5">
          <StatusDot tone="neutral" label="Unknown" />
          worker-2
        </li>
      </ul>
      <div className="flex w-full flex-col gap-2">
        <h3 id={upstreamId} className="text-sm font-medium">
          Depends on
        </h3>
        <DependencyChips aria-labelledby={upstreamId} items={upstream} max={4} onSelect={setSelected} />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {selectedLabel ? `Selected ${selectedLabel}.` : "Press a chip to select it."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <h3 id={downstreamId} className="text-sm font-medium">
          Unblocks
        </h3>
        <DependencyChips
          aria-labelledby={downstreamId}
          items={[]}
          empty={<p className="text-sm text-muted-foreground">Nothing waits on this.</p>}
        />
      </div>
    </Section>
  )
}

export { StatusSection }
