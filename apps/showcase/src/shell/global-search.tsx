import { useAsyncOptions } from "@ui-sdk/react/async-options"
import { useState } from "react"

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandStatus } from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogOpenButton,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"
import { toast } from "@/components/ui/toast"

type Result = { value: string; label: string; kind: string }

const index: Result[] = [
  { value: "project-apollo", label: "Apollo", kind: "Project" },
  { value: "project-atlas", label: "Atlas", kind: "Project" },
  { value: "project-hermes", label: "Hermes", kind: "Project" },
  { value: "deploy-1482", label: "Deploy #1482 to production", kind: "Deployment" },
  { value: "deploy-1481", label: "Deploy #1481 to preview", kind: "Deployment" },
  { value: "agent-planner", label: "Planner", kind: "Agent" },
  { value: "agent-reviewer", label: "Reviewer", kind: "Agent" },
  { value: "doc-rollbacks", label: "Rolling back a deployment", kind: "Doc" },
  { value: "doc-secrets", label: "Rotating secrets", kind: "Doc" },
]

// Stands in for a request to the server: it honours the abort signal, so a stale search never lands.
function searchWorkspace(query: string, { signal }: { signal: AbortSignal }) {
  return new Promise<Result[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase()
      resolve(index.filter((item) => `${item.label} ${item.kind}`.toLowerCase().includes(needle)))
    }, 300)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function useGlobalSearch() {
  const [controller] = useState(() => createCommandDialogController())
  const results = useAsyncOptions(searchWorkspace, { debounce: 200, immediate: true })

  const trigger = (
    <CommandDialogTrigger controller={controller} shortcut="mod+k" className="w-full max-w-sm">
      <span className="inline-flex items-center gap-2">
        <SearchIcon />
        Search the workspace
      </span>
      <CommandDialogShortcut />
    </CommandDialogTrigger>
  )
  const compactTrigger = (
    <CommandDialogOpenButton controller={controller} variant="ghost" size="icon" aria-label="Search the workspace">
      <SearchIcon />
    </CommandDialogOpenButton>
  )
  const dialog = (
    <CommandDialog controller={controller}>
      <CommandDialogContent title="Search the workspace">
        <Command
          filter={false}
          status={results.status}
          onQueryChange={(query) => results.setQuery(query)}
          onLoadMore={results.loadMore}
          onAction={(value) => {
            toast(`Opened ${index.find((item) => item.value === value)?.label ?? value}`)
            controller.close()
          }}
        >
          <CommandInput aria-label="Search the workspace" placeholder="Projects, deployments, agents, docs" />
          <CommandStatus>
            {(state) => (state.loading ? "Searching…" : `${state.count} ${state.count === 1 ? "result" : "results"}`)}
          </CommandStatus>
          <CommandEmpty>
            {(state) => (state.empty && !state.loading ? `Nothing matches “${state.query}”.` : null)}
          </CommandEmpty>
          <CommandList>
            {results.items.map((item) => (
              <CommandItem key={item.value} value={item.value} label={item.label}>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-xs text-muted-foreground in-data-highlighted:text-current">{item.kind}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
  return { trigger, compactTrigger, dialog }
}

export { useGlobalSearch }
