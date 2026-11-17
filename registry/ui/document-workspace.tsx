"use client"

import { useId, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react"
import { BookOpenIcon, PanelLeftIcon, PanelRightIcon, PencilIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommandDialogTrigger, createCommandDialogController } from "@/components/ui/command-dialog"
import {
  DocumentWorkspaceContext,
  documentWorkspaceLabels,
  textBoxIn,
  useDocumentWorkspace,
  type DocumentEditor,
  type DocumentHeading,
  type DocumentSaveState,
  type DocumentWorkspaceContextValue,
  type DocumentWorkspaceLabels,
  type DocumentWorkspaceMode,
} from "@/components/ui/document-workspace-context"
import {
  DocumentOutline,
  DocumentQuickOpen,
  WorkspaceDrawer,
  type DocumentOutlineProps,
  type DocumentQuickOpenItem,
  type DocumentQuickOpenLabels,
} from "@/components/ui/document-workspace-parts"
import { Resizable, ResizableHandle, ResizablePanel, createResizableController } from "@/components/ui/resizable"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { StatusDot } from "@/components/ui/status-pill"
import type { Tone } from "@/lib/tone"
import {
  openSizes,
  focusWhenReady,
  watchLostFocus,
  readPanels,
  revealHeading,
  useContainerNarrow,
  useControllable,
  useModeScroll,
  usePanel,
  writePanels,
} from "@/components/ui/use-document-workspace"
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

const SAVE_TONES: Record<DocumentSaveState, Tone> = {
  saved: "success",
  saving: "info",
  unsaved: "warning",
  error: "destructive",
}

const NO_HEADINGS: readonly DocumentHeading[] = []

const toggleClassName = "shrink-0 text-muted-foreground aria-expanded:text-foreground"

function DocumentWorkspace({
  document: content,
  explorer,
  tabs,
  breadcrumb,
  toolbar,
  statusBar,
  aside,
  alert,
  quickOpen,
  narrow: narrowWidth = 760,
  saveState,
  storageKey,
  editorRef,
  headings = NO_HEADINGS,
  quickOpenShortcut = "mod+p",
  documentAs = "region",
  className,
  ...props
}: DocumentWorkspaceProps) {
  const labels = { ...documentWorkspaceLabels, ...props.labels }
  const rootRef = useRef<HTMLDivElement>(null)
  const documentRef = useRef<HTMLElement>(null)
  const narrow = useContainerNarrow(rootRef, narrowWidth)
  const id = useId()
  const ids = { explorer: `${id}-explorer`, center: `${id}-document`, aside: `${id}-aside` }
  const [stored] = useState(() => readPanels(storageKey))
  const [controller] = useState(() => createResizableController())
  const [quickOpenController] = useState(() => createCommandDialogController())

  const [mode, setModeState] = useControllable(props.mode, () => props.defaultMode ?? "edit", props.onModeChange)
  const [explorerOpen, setExplorerState] = useControllable(
    props.explorerOpen,
    () => stored.explorer ?? props.defaultExplorerOpen ?? true,
    props.onExplorerOpenChange,
  )
  const [asideOpen, setAsideState] = useControllable(
    props.asideOpen,
    () => stored.aside ?? props.defaultAsideOpen ?? true,
    props.onAsideOpenChange,
  )
  // Only the wide layout's choice is remembered: the drawers always start closed.
  const setExplorerOpen = (open: boolean) => {
    if (!narrow) writePanels(storageKey, { explorer: open })
    setExplorerState(open)
  }
  const setAsideOpen = (open: boolean) => {
    if (!narrow) writePanels(storageKey, { aside: open })
    setAsideState(open)
  }
  const explorerPanel = usePanel({
    narrow,
    open: explorerOpen,
    setOpen: setExplorerOpen,
    controller,
    panelId: ids.explorer,
  })
  const asidePanel = usePanel({ narrow, open: asideOpen, setOpen: setAsideOpen, controller, panelId: ids.aside })
  const explorerShown = narrow ? explorerPanel.drawerOpen : explorerOpen
  const asideShown = narrow ? asidePanel.drawerOpen : asideOpen

  const captureScroll = useModeScroll({ mode, headings, editorRef, documentRef })
  const setMode = (next: DocumentWorkspaceMode) => {
    if (next === mode) return
    captureScroll()
    setModeState(next)
  }

  const documentFocusTarget = () =>
    mode === "edit" ? (textBoxIn(documentRef.current) ?? documentRef.current) : documentRef.current
  const context: DocumentWorkspaceContextValue = {
    mode,
    setMode,
    narrow,
    headings,
    editorRef,
    documentRef,
    documentFocusTarget,
    revealHeading: (index) => revealHeading(documentRef.current, index),
    focusDocument: () => focusWhenReady(() => (mode === "edit" ? textBoxIn(documentRef.current) : documentRef.current)),
    refocusDocument: () => watchLostFocus(documentRef.current, () => context.focusDocument()),
    quickOpen: quickOpenController,
    setExplorerOpen,
    setAsideOpen,
    labels,
  }

  // A collapse by the handle (Enter, a double-click, a drag past half the minimum) closes the panel too.
  const remember = (layout: number[]) => {
    const panels = { explorerSize: explorer === undefined ? null : ids.explorer, center: ids.center }
    writePanels(
      storageKey,
      openSizes(controller, layout, { ...panels, asideSize: aside === undefined ? null : ids.aside }),
    )
    if (explorer !== undefined && controller.isCollapsed(ids.explorer) === explorerOpen) setExplorerOpen(!explorerOpen)
    if (aside !== undefined && controller.isCollapsed(ids.aside) === asideOpen) setAsideOpen(!asideOpen)
  }

  // A file chosen in the drawer is navigation: the drawer closes and focus goes to the document.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) setExplorerOpen(false)
  }

  const Document = documentAs === "main" ? "main" : "section"
  const center = (
    <div data-slot="document-workspace-center" className="@container/center flex size-full min-h-0 min-w-0 flex-col">
      <div
        data-slot="document-workspace-header"
        className="flex min-w-0 flex-wrap items-center gap-inline border-b px-inset-item py-inline"
      >
        {explorer !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={labels.explorerToggle}
            aria-expanded={explorerShown}
            aria-controls={ids.explorer}
            onClick={() => setExplorerOpen(!explorerShown)}
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
          value={mode}
          onValueChange={(next) => next && setMode(next)}
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
        {quickOpen !== undefined && (
          <CommandDialogTrigger
            controller={quickOpenController}
            shortcut={quickOpenShortcut || undefined}
            variant="ghost"
            size="icon"
            aria-label={labels.quickOpen}
            className={toggleClassName}
          >
            <SearchIcon />
          </CommandDialogTrigger>
        )}
        {aside !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={labels.asideToggle}
            aria-expanded={asideShown}
            aria-controls={ids.aside}
            onClick={() => setAsideOpen(!asideShown)}
            className={toggleClassName}
          >
            <PanelRightIcon className="rtl:-scale-x-100" />
          </Button>
        )}
      </div>
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
        data-mode={mode}
        className="flex min-h-0 flex-1 flex-col overflow-auto outline-none data-[mode=read]:px-inset-surface data-[mode=read]:py-group"
      >
        {content}
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

  return (
    <DocumentWorkspaceContext value={context}>
      <div
        ref={rootRef}
        data-slot="document-workspace"
        data-layout={narrow ? "narrow" : "wide"}
        data-mode={mode}
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
        {narrow ? (
          center
        ) : (
          <Resizable controller={controller} onLayoutCommit={remember} className="min-h-0 flex-1">
            {explorer !== undefined && (
              <>
                <ResizablePanel
                  id={ids.explorer}
                  collapsible
                  collapsedSize={0}
                  minSize="180px"
                  maxSize="45%"
                  defaultSize={explorerOpen ? (stored.explorerSize ?? "256px") : 0}
                  render={<nav aria-label={labels.explorer} />}
                  data-slot="document-workspace-explorer"
                  className="bg-muted/(--glass-opacity)"
                >
                  {explorer}
                </ResizablePanel>
                <ResizableHandle aria-label={labels.resizeExplorer} />
              </>
            )}
            <ResizablePanel id={ids.center} minSize="320px" className="overflow-hidden">
              {center}
            </ResizablePanel>
            {aside !== undefined && (
              <>
                <ResizableHandle aria-label={labels.resizeAside} />
                <ResizablePanel
                  id={ids.aside}
                  collapsible
                  collapsedSize={0}
                  minSize="220px"
                  maxSize="45%"
                  defaultSize={asideOpen ? (stored.asideSize ?? "288px") : 0}
                  render={<aside aria-label={labels.aside} />}
                  data-slot="document-workspace-aside"
                >
                  {aside}
                </ResizablePanel>
              </>
            )}
          </Resizable>
        )}
        {narrow && explorer !== undefined && (
          <WorkspaceDrawer
            open={explorerPanel.drawerOpen}
            onOpenChange={setExplorerOpen}
            side="start"
            title={labels.explorer}
            finalFocus={documentFocusTarget}
            onClosed={() => context.refocusDocument()}
          >
            {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- hears the clicks of the links inside, which Enter fires too */}
            <nav
              id={ids.explorer}
              aria-label={labels.explorer}
              data-slot="document-workspace-explorer"
              onClick={closeOnLink}
              className="min-h-0 flex-1 overflow-auto"
            >
              {explorer}
            </nav>
          </WorkspaceDrawer>
        )}
        {narrow && aside !== undefined && (
          <WorkspaceDrawer
            open={asidePanel.drawerOpen}
            onOpenChange={setAsideOpen}
            side="end"
            title={labels.aside}
            finalFocus={documentFocusTarget}
            onClosed={() => context.refocusDocument()}
          >
            <aside
              id={ids.aside}
              aria-label={labels.aside}
              data-slot="document-workspace-aside"
              className="min-h-0 flex-1 overflow-auto"
            >
              {aside}
            </aside>
          </WorkspaceDrawer>
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
