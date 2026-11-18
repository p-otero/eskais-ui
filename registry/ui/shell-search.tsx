"use client"

import type { ReactNode } from "react"

import { RouteIcon, type NavigateTo } from "@/components/ui/shell-nav"
import type { ShellRouteSection } from "@/components/ui/shell-routes"
import {
  Command,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  type CommandProps,
} from "@/components/ui/command"
import { CommandDialog, CommandDialogContent, type CommandDialogController } from "@/components/ui/command-dialog"

// Keeps the generated commands apart from the consumer's own `commandGroups` values.
const goToPrefix = "shell:go-to:"

type ShellSearchLabels = { palette: string; search: string; searchPlaceholder?: string; empty: string; goTo: string }

type ShellSearchProps = {
  controller: CommandDialogController
  sections: readonly ShellRouteSection[]
  currentId: string | undefined
  navigate: NavigateTo
  labels: ShellSearchLabels
  commandGroups?: ReactNode
  onCommand?: (value: string) => unknown
  /** The search text, to control it. Without it, every open starts from `defaultQuery`. */
  query?: string
  /** The search text each open starts from, when `query` doesn't control it. Empty by default. */
  defaultQuery?: string
  onQueryChange?: CommandProps["onQueryChange"]
  /** Under the list, like key hints. Nothing by default. */
  footer?: ReactNode
}

function ShellSearch({
  controller,
  sections,
  currentId,
  navigate,
  labels,
  commandGroups,
  onCommand,
  query,
  defaultQuery,
  onQueryChange,
  footer,
}: ShellSearchProps) {
  // Route commands are links, which never reach onAction; only the consumer's commands run here.
  const run = async (value: string) => {
    await onCommand?.(value)
    controller.close()
  }
  const follow = (id: string) => {
    // Closed first, so focus is back on the trigger before the route changes.
    controller.close()
    navigate(id)
  }
  return (
    <CommandDialog controller={controller}>
      <CommandDialogContent title={labels.palette}>
        <Command onAction={run} query={query} defaultQuery={defaultQuery} onQueryChange={onQueryChange}>
          <CommandInput aria-label={labels.search} placeholder={labels.searchPlaceholder} />
          <CommandEmpty>{labels.empty}</CommandEmpty>
          <CommandList>
            <CommandGroup>
              <CommandGroupLabel>{labels.goTo}</CommandGroupLabel>
              {sections.flatMap((section) =>
                section.routes.map((route) => {
                  const current = route.id === currentId
                  return (
                    <CommandItem
                      key={route.id}
                      value={`${goToPrefix}${route.id}`}
                      href={route.href}
                      onFollow={() => follow(route.id)}
                      label={route.label}
                      keywords={[...(route.keywords ?? []), ...(section.label === undefined ? [] : [section.label])]}
                      aria-current={current ? "page" : undefined}
                      data-current={current ? "" : undefined}
                      className="group/shell-command"
                    >
                      {route.icon && (
                        <CommandItemIcon>
                          <RouteIcon route={route} />
                        </CommandItemIcon>
                      )}
                      <span className="min-w-0 flex-1 truncate">{route.label}</span>
                      <span
                        aria-hidden="true"
                        data-slot="shell-command-current"
                        className="hidden size-1.5 shrink-0 rounded-full bg-primary group-data-current/shell-command:block in-data-highlighted:bg-current"
                      />
                    </CommandItem>
                  )
                }),
              )}
            </CommandGroup>
            {commandGroups}
          </CommandList>
          {footer !== undefined && <CommandFooter>{footer}</CommandFooter>}
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}

export { ShellSearch, goToPrefix }
export type { ShellSearchLabels, ShellSearchProps }
