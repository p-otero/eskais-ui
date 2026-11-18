"use client"

import { useRef, type ReactNode, type RefObject } from "react"

import { WorkspaceCenter } from "@/components/ui/document-workspace-center"
import {
  DocumentWorkspaceContext,
  documentWorkspaceLabels,
  useDocumentWorkspace,
  type DocumentEditor,
  type DocumentHeading,
  type DocumentSaveState,
  type DocumentWorkspaceLabels,
  type DocumentWorkspaceMode,
} from "@/components/ui/document-workspace-context"
import { WorkspaceColumns, WorkspaceDrawers } from "@/components/ui/document-workspace-panels"
import { DocumentOutline, type DocumentOutlineProps } from "@/components/ui/document-workspace-parts"
import {
  DocumentQuickOpen,
  type DocumentQuickOpenItem,
  type DocumentQuickOpenLabels,
} from "@/components/ui/document-quick-open"
import { useDocumentWorkspaceState } from "@/components/ui/use-document-workspace-state"
import { cn } from "@/lib/utils"

type DocumentWorkspaceProps = {
  /** The open document: a `MarkdownEditor` in edit mode, a `MarkdownView` in read mode. */
  document: ReactNode
  /** A file tree or list, inside a navigation landmark: a resizable column when wide, a drawer when narrow. */
  explorer?: ReactNode
  /** Open documents, like a `TabsList`, in the header. */
  tabs?: ReactNode
  breadcrumb?: ReactNode
  /** Document actions, like a menu or a `MarkdownEditorToolbar` of your own, beside the breadcrumb. */
  toolbar?: ReactNode
  /** Word count, cursor position: before the save status. */
  statusBar?: ReactNode
  /** Backlinks, properties, a `DocumentOutline`, in a complementary landmark. */
  aside?: ReactNode
  /** A message read out at once when it appears, like a conflict `Alert` with your actions. */
  alert?: ReactNode
  /** A `DocumentQuickOpen`; with it, the header gets a Quick open button and `quickOpenShortcut`. */
  quickOpen?: ReactNode
  mode?: DocumentWorkspaceMode
  defaultMode?: DocumentWorkspaceMode
  onModeChange?: (mode: DocumentWorkspaceMode) => void
  explorerOpen?: boolean
  defaultExplorerOpen?: boolean
  onExplorerOpenChange?: (open: boolean) => void
  asideOpen?: boolean
  defaultAsideOpen?: boolean
  onAsideOpenChange?: (open: boolean) => void
  /** At this container width (px) or below, the explorer and the aside become drawers. 760 by default. */
  narrow?: number
  saveState?: DocumentSaveState
  labels?: Partial<DocumentWorkspaceLabels>
  /** Remembers whether the explorer and the aside are open, and their widths, in localStorage under this key. */
  storageKey?: string
  /** The editor's handle, for the outline, focus return and the reading position across modes. */
  editorRef?: RefObject<DocumentEditor | null>
  /** The document's headings, from `extractHeadings`: the outline lists them and a mode switch keeps to them. */
  headings?: readonly DocumentHeading[]
  /** `false` turns it off. */
  quickOpenShortcut?: string | false
  /** `"main"` when the workspace is the page's main content; inside an app shell's `<main>`, a named region. */
  documentAs?: "region" | "main"
  className?: string
}

function DocumentWorkspace(props: DocumentWorkspaceProps) {
  const { document: content, explorer, aside, alert, quickOpen, className } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const documentRef = useRef<HTMLElement>(null)
  const state = useDocumentWorkspaceState(props, rootRef, documentRef)
  const center = (
    <WorkspaceCenter
      state={state}
      documentRef={documentRef}
      tabs={props.tabs}
      breadcrumb={props.breadcrumb}
      toolbar={props.toolbar}
      statusBar={props.statusBar}
      saveState={props.saveState}
      documentAs={props.documentAs ?? "region"}
      hasExplorer={explorer !== undefined}
      hasAside={aside !== undefined}
      hasQuickOpen={quickOpen !== undefined}
      quickOpenShortcut={props.quickOpenShortcut ?? "mod+p"}
    >
      {content}
    </WorkspaceCenter>
  )

  return (
    <DocumentWorkspaceContext value={state.context}>
      <div
        ref={rootRef}
        data-slot="document-workspace"
        data-layout={state.narrow ? "narrow" : "wide"}
        data-mode={state.context.mode}
        className={cn(
          "@container flex h-(--document-workspace-height,100%) min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background text-body text-foreground",
          className,
        )}
      >
        <div
          role="alert"
          aria-atomic="true"
          data-slot="document-workspace-alert"
          className="not-empty:border-b not-empty:px-inset-item not-empty:py-inline"
        >
          {alert}
        </div>
        {state.narrow ? (
          <>
            {center}
            <WorkspaceDrawers state={state} explorer={explorer} aside={aside} />
          </>
        ) : (
          <WorkspaceColumns state={state} explorer={explorer} aside={aside}>
            {center}
          </WorkspaceColumns>
        )}
        {quickOpen}
      </div>
    </DocumentWorkspaceContext>
  )
}

export { DocumentOutline, DocumentQuickOpen, DocumentWorkspace, documentWorkspaceLabels, useDocumentWorkspace }
export type {
  DocumentEditor,
  DocumentHeading,
  DocumentOutlineProps,
  DocumentQuickOpenItem,
  DocumentQuickOpenLabels,
  DocumentSaveState,
  DocumentWorkspaceLabels,
  DocumentWorkspaceMode,
  DocumentWorkspaceProps,
}
