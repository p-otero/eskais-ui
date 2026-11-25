import { SearchIcon } from "lucide-react"
import { lazy, Suspense, useState } from "react"

import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogOpenButton,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"
import { Spinner } from "@/components/ui/spinner"

// Perf: loaded after the page while the browser is idle, so the first page's code doesn't wait for the palette and
// ⌘K still finds it ready.
const loadResults = () => import("./search-results")
const SearchResults = lazy(() => loadResults().then((module) => ({ default: module.SearchResults })))
if (typeof window !== "undefined") {
  addEventListener("load", () => (globalThis.requestIdleCallback ?? setTimeout)(() => void loadResults()), {
    once: true,
  })
}

function SiteSearch() {
  const [search] = useState(() => createCommandDialogController())
  return (
    <CommandDialog controller={search}>
      <CommandDialogTrigger controller={search} shortcut="mod+k" variant="outline" className="w-56 narrow:hidden">
        <span className="flex items-center gap-inline">
          <SearchIcon />
          Search docs
        </span>
        <CommandDialogShortcut />
      </CommandDialogTrigger>
      <CommandDialogOpenButton
        controller={search}
        variant="ghost"
        size="icon"
        aria-label="Search docs"
        className="hidden narrow:inline-flex"
      >
        <SearchIcon />
      </CommandDialogOpenButton>
      <CommandDialogContent title="Search the docs">
        <Suspense
          fallback={
            <div className="flex justify-center py-section">
              <Spinner label="Loading search" />
            </div>
          }
        >
          <SearchResults onFollow={() => search.close()} />
        </Suspense>
      </CommandDialogContent>
    </CommandDialog>
  )
}

export { SiteSearch }
