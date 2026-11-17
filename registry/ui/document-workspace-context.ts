"use client"

import type { CommandDialogController } from "@/components/ui/command-dialog"
import { createContext, use, type RefObject } from "react"

type DocumentWorkspaceMode = "edit" | "read"
type DocumentSaveState = "saved" | "saving" | "unsaved" | "error"

/** A heading of the open document, as `extractHeadings` (from `markdown-view`) returns it. */
type DocumentHeading = { level: number; text: string; line: number; textFrom: number }

/** What the workspace needs from an editor: `MarkdownEditorHandle` (from `markdown-editor`) has it. */
type DocumentEditor = {
  focus: () => void
  scrollToLine: (line: number) => void
  setSelection: (anchor: number, head?: number) => void
  getScrollLine: () => number
}

type DocumentWorkspaceLabels = {
  /** The explorer's navigation landmark and drawer title. */
  explorer: string
  /** The button that shows or hides the explorer. */
  explorerToggle: string
  /** The aside's complementary landmark and drawer title. */
  aside: string
  asideToggle: string
  /** The document region. */
  document: string
  /** The mode switch and its two choices. */
  mode: string
  edit: string
  read: string
  quickOpen: string
  resizeExplorer: string
  resizeAside: string
  saved: string
  saving: string
  unsaved: string
  error: string
}

const documentWorkspaceLabels: DocumentWorkspaceLabels = {
  explorer: "Files",
  explorerToggle: "Files",
  aside: "Details",
  asideToggle: "Details",
  document: "Document",
  mode: "Mode",
  edit: "Edit",
  read: "Read",
  quickOpen: "Quick open",
  resizeExplorer: "Resize files",
  resizeAside: "Resize details",
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
  error: "Couldn't save",
}

type DocumentWorkspaceContextValue = {
  mode: DocumentWorkspaceMode
  /** Switches the mode, keeping the reading position by heading. */
  setMode: (mode: DocumentWorkspaceMode) => void
  narrow: boolean
  headings: readonly DocumentHeading[]
  editorRef: RefObject<DocumentEditor | null> | undefined
  /** The document region, which scrolls in read mode. */
  documentRef: RefObject<HTMLElement | null>
  /** Where focus goes back to: the editor's text in edit mode, the document region in read mode. */
  documentFocusTarget: () => HTMLElement | null
  /** Focuses the document once it is there: an editor that remounts for another note builds its view later. */
  focusDocument: () => void
  /** After a popup closed: focuses the document if focus was left nowhere in particular. */
  refocusDocument: () => void
  /** Read mode: scrolls the `index`th heading of the document to the top and moves focus to it. */
  revealHeading: (index: number) => void
  quickOpen: CommandDialogController
  setExplorerOpen: (open: boolean) => void
  setAsideOpen: (open: boolean) => void
  labels: DocumentWorkspaceLabels
}

const DocumentWorkspaceContext = createContext<DocumentWorkspaceContextValue | null>(null)

/** The enclosing `DocumentWorkspace`: its mode, headings, editor and focus helpers. */
function useDocumentWorkspace() {
  const context = use(DocumentWorkspaceContext)
  if (!context) throw new Error("useDocumentWorkspace needs a DocumentWorkspace around it.")
  return context
}

/** The rendered headings of a read view in `root`, leaving out any inside an embed. */
function readHeadings(root: HTMLElement | null) {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")].filter(
    (heading) => !heading.closest("[data-slot=markdown-embed], [data-slot=markdown-properties]"),
  )
}

function textBoxIn(root: HTMLElement | null) {
  return root?.querySelector<HTMLElement>("[contenteditable=true], [role=textbox], textarea") ?? null
}

export { DocumentWorkspaceContext, documentWorkspaceLabels, readHeadings, textBoxIn, useDocumentWorkspace }
export type {
  DocumentEditor,
  DocumentHeading,
  DocumentSaveState,
  DocumentWorkspaceContextValue,
  DocumentWorkspaceLabels,
  DocumentWorkspaceMode,
}
