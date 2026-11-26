import { useState } from "react"

import { FilterBar, FilterBarButton, FilterBarField, FilterBarSearch } from "@/components/ui/filter-bar"
import { Select } from "@/components/ui/select"

const projects = [
  { name: "Apollo", state: "active" },
  { name: "Borealis", state: "archived" },
  { name: "Cygnus", state: "active" },
  { name: "Draco", state: "active" },
  { name: "Eridanus", state: "archived" },
]

const stateOptions = [
  { value: "any", label: "Any state" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
]

export default function FilterBarDemo() {
  const [query, setQuery] = useState("")
  const [mine, setMine] = useState(false)
  const [state, setState] = useState("any")
  const shown = projects
    .filter((project) => project.name.toLowerCase().includes(query.toLowerCase()))
    .filter((project) => state === "any" || project.state === state)
    .map((project) => project.name)
  return (
    <div className="flex w-full max-w-xl flex-col gap-group">
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
      <FilterBar label="Filter projects with labels">
        <FilterBarField label="Search">
          <FilterBarSearch label="Search projects" value={query} onValueChange={setQuery} />
        </FilterBarField>
        <FilterBarField label="State" className="sm:flex-none sm:w-44">
          <Select
            aria-label="State"
            options={stateOptions}
            value={state}
            onValueChange={(next) => setState(next ?? "any")}
          />
        </FilterBarField>
        <FilterBarButton
          onClick={() => {
            setQuery("")
            setState("any")
          }}
        >
          Clear filters
        </FilterBarButton>
      </FilterBar>
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {shown.length} of {projects.length} projects: {shown.join(", ") || "none"}
      </p>
    </div>
  )
}
