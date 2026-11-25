"use client"

import type { CommandDialogController } from "@/components/ui/command-dialog"
import { createContext, use, type RefObject } from "react"

type DocumentWorkspaceMode = "edit" | "read"
type DocumentSaveState = "saved" | "saving" | "unsaved" | "error"

/** A heading of the open document, as `extractHeadings` (from `markdown-view`) returns it. */
type DocumentHeading = {
  level: number
  text: string
  line: number
  textFrom: number
  /** The anchor `MarkdownView` puts on the rendered heading (`data-slug`); read mode finds the heading by it. */
  slug?: string
}

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
  /**
   * Read mode: scrolls a heading to the top and moves focus to it. Pass a heading from `extractHeadings`, found by
   * its `slug` (a filtered list still finds the right one), or by its text without one; a number is the index among
   * the rendered headings.
   */
  revealHeading: (heading: DocumentHeading | number) => void
  quickOpen: CommandDialogController
  /** Shows or hides the explorer: its column when wide, its drawer when narrow. */
  setExplorerOpen: (open: boolean) => void
  /**
   * Closes the explorer drawer in the narrow layout, as a link in it does; the wide layout's column stays. Call it
   * when a button in your tree opens a document, or pass `documentId` to the workspace instead.
   */
  closeExplorer: () => void
  setAsideOpen: (open: boolean) => void
  labels: DocumentWorkspaceLabels
}

const DocumentWorkspaceContext = createContext<DocumentWorkspaceContextValue | null>(null)

function useDocumentWorkspace() {
  const context = use(DocumentWorkspaceContext)
  if (!context) throw new Error("useDocumentWorkspace needs a DocumentWorkspace around it.")
  return context
}

/** Leaves out any heading inside an embed. */
function readHeadings(root: HTMLElement | null) {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")].filter(
    (heading) => !heading.closest("[data-slot=markdown-embed], [data-slot=markdown-properties]"),
  )
}

/** The rendered heading for `heading`: by its slug, else the first with its text; a number is an index. */
function findHeading(root: HTMLElement | null, heading: DocumentHeading | number) {
  const rendered = readHeadings(root)
  if (typeof heading === "number") return rendered[heading]
  if (heading.slug !== undefined) {
    const bySlug = rendered.find((element) => element.dataset.slug === heading.slug)
    if (bySlug) return bySlug
  }
  return rendered.find((element) => element.textContent.replace(/\s+/g, " ").trim() === heading.text)
}

function textBoxIn(root: HTMLElement | null) {
  return root?.querySelector<HTMLElement>("[contenteditable=true], [role=textbox], textarea") ?? null
}

export { DocumentWorkspaceContext, documentWorkspaceLabels, findHeading, readHeadings, textBoxIn, useDocumentWorkspace }
export type {
  DocumentEditor,
  DocumentHeading,
  DocumentSaveState,
  DocumentWorkspaceContextValue,
  DocumentWorkspaceLabels,
  DocumentWorkspaceMode,
}
