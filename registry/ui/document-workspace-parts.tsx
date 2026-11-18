"use client"

import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
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
import { useDocumentWorkspace, type DocumentHeading } from "@/components/ui/document-workspace-context"
import { Drawer, DrawerBackdrop, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

type DocumentOutlineProps = {
  /** The headings to list; the workspace's `headings` by default. */
  headings?: readonly DocumentHeading[]
  /** The navigation landmark's name. */
  label?: string
  /** Deeper headings are left out. */
  maxLevel?: number
  className?: string
}

/**
 * The document's headings as buttons. In edit mode one puts the caret at its heading's text, scrolled to the top,
 * and focuses the editor; in read mode it scrolls to the heading and moves focus to it.
 */
function DocumentOutline({ headings: own, label = "Outline", maxLevel = 6, className }: DocumentOutlineProps) {
  const workspace = useDocumentWorkspace()
  const headings = own ?? workspace.headings
  const shallowest = Math.min(...headings.map((heading) => heading.level))

  const go = (index: number) => {
    const heading = headings[index]
    if (!heading) return
    const editor = workspace.editorRef?.current
    if (workspace.mode === "edit" && editor) {
      editor.setSelection(heading.textFrom)
      editor.scrollToLine(heading.line)
      editor.focus()
      return
    }
    workspace.revealHeading(index)
  }

  return (
    <nav aria-label={label} data-slot="document-outline" className={cn("flex min-w-0 flex-col", className)}>
      <ol className="flex flex-col">
        {headings.map(
          (heading, index) =>
            heading.level <= maxLevel && (
              <li key={`${String(heading.line)}:${heading.text}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  data-level={heading.level}
                  onClick={() => go(index)}
                  className="w-full min-w-0 justify-start gap-0 px-inset-item pointer-coarse:h-(--control-height-touch) font-normal text-muted-foreground hover:text-foreground data-[level='1']:font-medium data-[level='1']:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    data-depth={Math.min(heading.level - shallowest, 5)}
                    className="shrink-0 data-[depth='1']:w-3 data-[depth='2']:w-6 data-[depth='3']:w-9 data-[depth='4']:w-12 data-[depth='5']:w-15"
                  />
                  <span className="truncate">{heading.text}</span>
                </Button>
              </li>
            ),
        )}
      </ol>
    </nav>
  )
}

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

type WorkspaceDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "start" | "end"
  title: string
  finalFocus: ComponentProps<typeof DrawerContent>["finalFocus"]
  onClosed: () => void
  children: ReactNode
}

/** The explorer or the aside in the narrow layout: a 20rem drawer from its side, named by its landmark. */
function WorkspaceDrawer({ open, onOpenChange, side, title, finalFocus, onClosed, children }: WorkspaceDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} onOpenChangeComplete={(next) => next || onClosed()} side={side}>
      <DrawerBackdrop />
      <DrawerContent finalFocus={finalFocus} className="gap-0 p-0 data-[side=left]:max-w-80 data-[side=right]:max-w-80">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {children}
      </DrawerContent>
    </Drawer>
  )
}

export { DocumentOutline, DocumentQuickOpen, WorkspaceDrawer }
export type { DocumentOutlineProps, DocumentQuickOpenItem, DocumentQuickOpenLabels }
