import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

import { docSections } from "./pages"
import { hrefFor, navigate } from "./router"

/** The palette's search and pages, loaded apart from the header so the first page's code doesn't carry them. */
function SearchResults({ onFollow }: { onFollow: () => void }) {
  return (
    <Command>
      <CommandInput aria-label="Search pages" placeholder="Search components and guides" />
      <CommandEmpty>No pages found.</CommandEmpty>
      <CommandList className="max-h-96">
        {docSections.map((section) => (
          <CommandGroup key={section.name}>
            <CommandGroupLabel>{section.name}</CommandGroupLabel>
            {section.pages.map((page) => (
              <CommandItem
                key={page.route}
                value={page.route}
                keywords={[page.title, ...page.keywords]}
                href={hrefFor(page.route)}
                onFollow={() => {
                  onFollow()
                  navigate(page.route)
                }}
              >
                {page.title}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

export { SearchResults }
