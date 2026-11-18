"use client"

import type { ReactNode } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { CommandDialog, CommandDialogContent } from "@/components/ui/command-dialog"
import { useDocumentWorkspace } from "@/components/ui/document-workspace-context"

type DocumentQuickOpenItem = {
  value: string
  label: string
  /** A folder or path, shown after the label. */
  description?: string
  keywords?: readonly string[]
  /** Items with the same group are listed under it. */
  group?: string
}

type DocumentQuickOpenLabels = { title: string; placeholder?: string; empty: ReactNode }

/**
 * Ctrl/Cmd+P in a `DocumentWorkspace`: a `CommandDialog` that searches `items` and calls `onOpen` with the chosen
 * value. Focus then goes back to the document, unless `onOpen` moved it.
 */
function DocumentQuickOpen({
  items,
  onOpen,
  labels: labelOverrides,
}: {
  items: readonly DocumentQuickOpenItem[]
  onOpen: (value: string) => void
  labels?: Partial<DocumentQuickOpenLabels>
}) {
  const workspace = useDocumentWorkspace()
  const labels = { title: workspace.labels.quickOpen, empty: "No matches", ...labelOverrides }
  const groups = new Map<string, DocumentQuickOpenItem[]>()
  for (const item of items) groups.set(item.group ?? "", [...(groups.get(item.group ?? "") ?? []), item])
  const row = (item: DocumentQuickOpenItem) => (
    <CommandItem key={item.value} value={item.value} label={item.label} keywords={item.keywords && [...item.keywords]}>
      <span className="truncate">{item.label}</span>
      {item.description && (
        <span className="ms-auto shrink-0 truncate text-caption text-muted-foreground">{item.description}</span>
      )}
    </CommandItem>
  )
  return (
    <CommandDialog
      controller={workspace.quickOpen}
      onOpenChangeComplete={(open) => open || workspace.refocusDocument()}
    >
      <CommandDialogContent title={labels.title} finalFocus={workspace.documentFocusTarget}>
        <Command
          onAction={(value) => {
            workspace.quickOpen.close()
            onOpen(value)
          }}
        >
          <CommandInput aria-label={labels.title} placeholder={labels.placeholder} />
          <CommandEmpty>{labels.empty}</CommandEmpty>
          <CommandList>
            {[...groups].map(([group, entries]) =>
              group ? (
                <CommandGroup key={group}>
                  <CommandGroupLabel>{group}</CommandGroupLabel>
                  {entries.map(row)}
                </CommandGroup>
              ) : (
                entries.map(row)
              ),
            )}
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}

export { DocumentQuickOpen }
export type { DocumentQuickOpenItem, DocumentQuickOpenLabels }
