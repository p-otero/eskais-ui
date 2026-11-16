import { useState } from "react"

import { FilterBar, FilterBarButton, FilterBarSearch } from "@/components/ui/filter-bar"

const projects = ["Apollo", "Borealis", "Cygnus", "Draco", "Eridanus"]

export default function FilterBarDemo() {
  const [query, setQuery] = useState("")
  const [mine, setMine] = useState(false)
  const shown = projects.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="flex w-full max-w-xl flex-col gap-items">
      <FilterBar
        label="Filter projects"
        isFiltered={query !== "" || mine}
        onReset={() => {
          setQuery("")
          setMine(false)
        }}
      >
        <FilterBarSearch label="Search projects" placeholder="Search projects" value={query} onValueChange={setQuery} />
        <FilterBarButton aria-pressed={mine} onClick={() => setMine(!mine)}>
          Only mine
        </FilterBarButton>
      </FilterBar>
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {shown.length} of {projects.length} projects: {shown.join(", ") || "none"}
      </p>
    </div>
  )
}
