import { useRef, useState } from "react"

import { Code } from "@/components/ui/code-block"
import { countActiveFilters, FilterPanel, FilterPanelTrigger } from "@/components/ui/filter-panel"
import { FilterScope } from "@/components/ui/filter-scope"
import { usePageController } from "@/components/ui/use-server-data"

import { serverTaskFilters, taskSource } from "./fixtures"

const source = taskSource({ key: ["docs", "filter-panel"] })

export default function FilterPanelDemo() {
  const { state, controller } = usePageController(source, { filter: { archived: false }, search: { key: "q" } })
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <FilterScope schema={serverTaskFilters} controller={controller} label="Task filters" className="w-full">
      <div className="flex w-full flex-wrap items-start gap-section">
        <div className="flex min-w-0 flex-1 flex-col gap-group">
          <FilterPanelTrigger
            ref={trigger}
            open={open}
            onOpenChange={setOpen}
            count={countActiveFilters(serverTaskFilters, state.filter)}
            className="self-start"
          />
          <p className="flex flex-wrap items-center gap-inline text-body-sm text-muted-foreground">
            Applied <Code>{JSON.stringify(state.filter)}</Code>
          </p>
        </div>
        <FilterPanel
          open={open}
          onOpenChange={setOpen}
          returnFocus={() => trigger.current}
          className="rounded-surface border"
        />
      </div>
    </FilterScope>
  )
}
