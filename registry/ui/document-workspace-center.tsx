"use client"

import type { ReactNode, RefObject } from "react"
import { BookOpenIcon, PanelLeftIcon, PanelRightIcon, PencilIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommandDialogTrigger } from "@/components/ui/command-dialog"
import type { DocumentSaveState, DocumentWorkspaceMode } from "@/components/ui/document-workspace-context"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { StatusDot } from "@/components/ui/status-pill"
import type { DocumentWorkspaceState } from "@/components/ui/use-document-workspace-state"
import type { Tone } from "@/lib/tone"

const SAVE_TONES: Record<DocumentSaveState, Tone> = {
  saved: "success",
  saving: "info",
  unsaved: "warning",
  error: "destructive",
}

const toggleClassName = "shrink-0 text-muted-foreground aria-expanded:text-foreground"

type WorkspaceHeaderProps = {
  state: DocumentWorkspaceState
  tabs: ReactNode
  hasExplorer: boolean
  hasAside: boolean
  hasQuickOpen: boolean
  quickOpenShortcut: string | false
}

/** The explorer toggle, the tabs, the mode switch, quick open and the aside toggle. */
function WorkspaceHeader({
  state,
  tabs,
  hasExplorer,
  hasAside,
  hasQuickOpen,
  quickOpenShortcut,
}: WorkspaceHeaderProps) {
  const { labels, ids, context, explorer, aside } = state
  return (
    <div
      data-slot="document-workspace-header"
      className="flex min-w-0 flex-wrap items-center gap-inline border-b px-inset-item py-inline"
    >
      {hasExplorer && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.explorerToggle}
          aria-expanded={explorer.shown}
          aria-controls={ids.explorer}
          onClick={() => explorer.setOpen(!explorer.shown)}
          className={toggleClassName}
        >
          <PanelLeftIcon className="rtl:-scale-x-100" />
        </Button>
      )}
      {/* A narrow column gives the tabs a row of their own instead of squeezing them beside the controls. */}
      <div
        data-slot="document-workspace-tabs"
        className="min-w-0 flex-1 @max-xl/center:order-last @max-xl/center:basis-full"
      >
        {tabs}
      </div>
      <SegmentedControl<DocumentWorkspaceMode>
        aria-label={labels.mode}
        value={context.mode}
        onValueChange={(next) => next && context.setMode(next)}
        className="ms-auto shrink-0"
      >
        <SegmentedControlIndicator />
        <SegmentedControlItem value="edit" className="@max-xl:px-inline">
          <PencilIcon />
          <span className="@max-xl:sr-only">{labels.edit}</span>
        </SegmentedControlItem>
        <SegmentedControlItem value="read" className="@max-xl:px-inline">
          <BookOpenIcon />
          <span className="@max-xl:sr-only">{labels.read}</span>
        </SegmentedControlItem>
      </SegmentedControl>
      {hasQuickOpen && (
        <CommandDialogTrigger
          controller={context.quickOpen}
          shortcut={quickOpenShortcut || undefined}
          variant="ghost"
          size="icon"
          aria-label={labels.quickOpen}
          className={toggleClassName}
        >
          <SearchIcon />
        </CommandDialogTrigger>
      )}
      {hasAside && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.asideToggle}
          aria-expanded={aside.shown}
          aria-controls={ids.aside}
          onClick={() => aside.setOpen(!aside.shown)}
          className={toggleClassName}
        >
          <PanelRightIcon className="rtl:-scale-x-100" />
        </Button>
      )}
    </div>
  )
}

type WorkspaceCenterProps = Omit<WorkspaceHeaderProps, "tabs"> & {
  tabs?: ReactNode
  breadcrumb?: ReactNode
  toolbar?: ReactNode
  statusBar?: ReactNode
  saveState?: DocumentSaveState
  documentAs: "region" | "main"
  documentRef: RefObject<HTMLElement | null>
  children: ReactNode
}

/** The header, the breadcrumb bar, the document region and the status bar, in a column. */
function WorkspaceCenter({
  state,
  tabs,
  breadcrumb,
  toolbar,
  statusBar,
  saveState,
  documentAs,
  documentRef,
  children,
  ...header
}: WorkspaceCenterProps) {
  const { labels, context } = state
  const Document = documentAs === "main" ? "main" : "section"
  return (
    <div data-slot="document-workspace-center" className="@container/center flex size-full min-h-0 min-w-0 flex-col">
      <WorkspaceHeader state={state} tabs={tabs} {...header} />
      {(breadcrumb !== undefined || toolbar !== undefined) && (
        <div
          data-slot="document-workspace-bar"
          className="flex min-w-0 flex-wrap items-center gap-items border-b px-inset-item py-inline"
        >
          <div className="min-w-0 flex-1">{breadcrumb}</div>
          {toolbar !== undefined && <div className="flex shrink-0 items-center gap-inline">{toolbar}</div>}
        </div>
      )}
      <Document
        ref={documentRef}
        tabIndex={-1}
        aria-label={labels.document}
        data-slot="document-workspace-document"
        data-mode={context.mode}
        // oxlint-disable-next-line eskais/scroll-area -- the page-level document, which hosts the editor (see markdown-editor.tsx)
        className="flex min-h-0 flex-1 flex-col overflow-auto outline-none data-[mode=read]:px-inset-surface data-[mode=read]:py-group"
      >
        {children}
      </Document>
      <div
        data-slot="document-workspace-status"
        className="flex min-w-0 items-center gap-items border-t px-inset-item py-inline text-caption text-muted-foreground"
      >
        <div className="flex min-w-0 flex-1 items-center gap-items">{statusBar}</div>
        <output data-state={saveState} className="inline-flex shrink-0 items-center gap-inline">
          {saveState && (
            <>
              <StatusDot tone={SAVE_TONES[saveState]} pulse={saveState === "saving"} label="" aria-hidden="true" />
              {labels[saveState]}
            </>
          )}
        </output>
      </div>
    </div>
  )
}

export { WorkspaceCenter }
export type { WorkspaceCenterProps }
