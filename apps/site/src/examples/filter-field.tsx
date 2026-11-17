import { useState } from "react"

import { Code } from "@/components/ui/code-block"
import { FilterField } from "@/components/ui/filter-field"
import type { FilterValues } from "@/lib/filter-schema"

import { serverTaskFilters } from "./fixtures"

type Values = FilterValues<typeof serverTaskFilters>

export default function FilterFieldDemo() {
  const [values, setValues] = useState<Values>({ priority: "high" })
  const set = (key: keyof Values) => (value: unknown) => setValues((previous) => ({ ...previous, [key]: value }))
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <FilterField field={serverTaskFilters.priority} value={values.priority} onValueChange={set("priority")} />
      <FilterField field={serverTaskFilters.points} value={values.points} onValueChange={set("points")} />
      <FilterField field={serverTaskFilters.created} value={values.created} onValueChange={set("created")} />
      <p className="flex flex-wrap items-center gap-inline text-body-sm text-muted-foreground">
        Values <Code>{JSON.stringify(values)}</Code>
      </p>
    </div>
  )
}
