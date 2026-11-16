import { SearchIcon } from "lucide-react"
import { useState } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogOpenButton,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"

import { docSections } from "./pages"
import { navigate } from "./router"

// The labelled trigger keeps ⌘K and the name agents open the dialog by while it is hidden on narrow screens, where
// an icon button opens the same dialog through the controller.
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
        <Command
          onAction={(route) => {
            search.close()
            navigate(route)
          }}
        >
          <CommandInput aria-label="Search pages" placeholder="Search components and guides" />
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandList className="max-h-96">
            {docSections.map((section) => (
              <CommandGroup key={section.name}>
                <CommandGroupLabel>{section.name}</CommandGroupLabel>
                {section.pages.map((page) => (
                  <CommandItem key={page.route} value={page.route} keywords={[page.title, ...page.keywords]}>
                    {page.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}

export { SiteSearch }
