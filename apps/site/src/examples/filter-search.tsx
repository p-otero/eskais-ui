import { Code } from "@/components/ui/code-block"
import { FilterScope } from "@/components/ui/filter-scope"
import { FilterSearch } from "@/components/ui/filter-search"
import { usePageController } from "@/components/ui/use-server-data"

import { serverTaskFilters, taskSource } from "./fixtures"

const source = taskSource({ key: ["docs", "filter-search"] })

export default function FilterSearchDemo() {
  const { state, controller } = usePageController(source, { search: { key: "q" } })
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <FilterScope schema={serverTaskFilters} controller={controller} label="Task filters">
        <FilterSearch placeholder="Title, id or person" />
      </FilterScope>
      <p className="flex flex-wrap items-center gap-inline text-body-sm text-muted-foreground">
        Typed <Code>{JSON.stringify(state.searchText)}</Code>, sent after 250 ms{" "}
        <Code>{JSON.stringify(state.request.filter)}</Code>
      </p>
    </div>
  )
}
