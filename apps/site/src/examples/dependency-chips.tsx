import { useId, useState } from "react"

import { DependencyChips, type DependencyChip } from "@/components/ui/dependency-chips"

const upstream: DependencyChip[] = [
  { id: "schema", label: "Design the schema", tone: "success" },
  { id: "migration", label: "Write the migration for every table in the warehouse", tone: "warning" },
  { id: "access", label: "Review access", tone: "destructive" },
  { id: "fixtures", label: "Seed fixtures", tone: "muted" },
  { id: "load", label: "Load test", tone: "info" },
]

export default function DependencyChipsDemo() {
  const headingId = useId()
  const [selected, setSelected] = useState<string>()
  return (
    <div className="flex w-full max-w-lg flex-col gap-items">
      <h3 id={headingId} className="text-title-sm">
        Depends on
      </h3>
      <DependencyChips aria-labelledby={headingId} items={upstream} max={4} onSelect={setSelected} />
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {selected ? `Selected ${upstream.find((item) => item.id === selected)?.label}.` : "Press a chip to select it."}
      </p>
    </div>
  )
}
