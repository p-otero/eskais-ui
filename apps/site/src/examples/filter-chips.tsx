import { Code } from "@/components/ui/code-block"
import { FilterChips } from "@/components/ui/filter-chips"
import { FilterScope } from "@/components/ui/filter-scope"
import { usePageController } from "@/components/ui/use-server-data"

import { serverTaskFilters, taskSource } from "./fixtures"

const source = taskSource({ key: ["docs", "filter-chips"] })

export default function FilterChipsDemo() {
  const { state, controller } = usePageController(source, {
    filter: { status: ["open", "blocked"], points: { op: "gte", value: 3 } },
    search: { key: "q" },
  })
  return (
    <div className="flex w-full max-w-2xl flex-col gap-group">
      <FilterScope schema={serverTaskFilters} controller={controller} label="Task filters">
        <FilterChips />
      </FilterScope>
      <p className="flex flex-wrap items-center gap-inline text-body-sm text-muted-foreground">
        Applied <Code>{JSON.stringify(state.filter)}</Code>
      </p>
    </div>
  )
}
