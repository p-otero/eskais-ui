import { useState } from "react"

import { SearchField } from "@/components/ui/search-field"

export default function SearchFieldDemo() {
  const [searches, setSearches] = useState<string[]>([])
  return (
    <div className="flex w-full max-w-md flex-col gap-items">
      <SearchField
        label="Search projects"
        placeholder="Search projects"
        onSearch={(query, details) => setSearches((list) => [`"${query}" (${details.source})`, ...list].slice(0, 3))}
      />
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {searches.length === 0 ? "Press Enter to search, Escape to clear." : `Searched ${searches.join(", ")}`}
      </p>
    </div>
  )
}
