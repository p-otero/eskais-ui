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
  CommandDialogShortcut,
  CommandDialogTrigger,
} from "@/components/ui/command-dialog"

import { SearchIcon } from "./icons"
import { docSections } from "./pages"
import { navigate } from "./router"

function SiteSearch() {
  const [open, setOpen] = useState(false)
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandDialogTrigger
        shortcut="mod+k"
        variant="outline"
        aria-label="Search docs"
        className="w-56 narrow:w-auto narrow:px-0 narrow:size-control"
      >
        <span className="flex items-center gap-inline">
          <SearchIcon />
          <span className="narrow:sr-only">Search docs</span>
        </span>
        <CommandDialogShortcut className="narrow:hidden" />
      </CommandDialogTrigger>
      <CommandDialogContent title="Search the docs">
        <Command
          onAction={(route) => {
            setOpen(false)
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
