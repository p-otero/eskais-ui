"use client"

import { useId, useState, type RefObject } from "react"

import { createCommandDialogController } from "@/components/ui/command-dialog"
import type { DocumentWorkspaceProps } from "@/components/ui/document-workspace"
import {
  documentWorkspaceLabels,
  textBoxIn,
  type DocumentHeading,
  type DocumentWorkspaceContextValue,
  type DocumentWorkspaceMode,
} from "@/components/ui/document-workspace-context"
import { createResizableController } from "@/components/ui/resizable"
import {
  focusWhenReady,
  openSizes,
  readPanels,
  revealHeading,
  useContainerNarrow,
  useControllable,
  useModeScroll,
  useOnKeyChange,
  usePanel,
  watchLostFocus,
  writePanels,
} from "@/components/ui/use-document-workspace"

const NO_HEADINGS: readonly DocumentHeading[] = []

type WorkspaceIds = { explorer: string; center: string; aside: string }

/**
 * Everything `DocumentWorkspace` decides: the layout from its width, the mode, whether each side panel is open
 * (a column when wide, a drawer when narrow), what storage remembers, and the context its parts read.
 */
function useDocumentWorkspaceState(
  props: DocumentWorkspaceProps,
  rootRef: RefObject<HTMLDivElement | null>,
  documentRef: RefObject<HTMLElement | null>,
) {
  const { storageKey, editorRef, explorer, aside } = props
  const headings = props.headings ?? NO_HEADINGS
  const labels = { ...documentWorkspaceLabels, ...props.labels }
  const narrow = useContainerNarrow(rootRef, props.narrow ?? 760)
  const id = useId()
  const ids: WorkspaceIds = { explorer: `${id}-explorer`, center: `${id}-document`, aside: `${id}-aside` }
  const [stored] = useState(() => readPanels(storageKey))
  const [controller] = useState(() => createResizableController())
  const [quickOpen] = useState(() => createCommandDialogController())

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
  const panel = { narrow, controller }
  const explorerPanel = usePanel({ ...panel, open: explorerOpen, setOpen: setExplorerOpen, panelId: ids.explorer })
  const asidePanel = usePanel({ ...panel, open: asideOpen, setOpen: setAsideOpen, panelId: ids.aside })

  const closeExplorer = () => {
    if (narrow && explorerOpen) setExplorerOpen(false)
  }
  useOnKeyChange(props.documentId, closeExplorer)

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
    quickOpen,
    setExplorerOpen,
    closeExplorer,
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

  return {
    ids,
    labels,
    narrow,
    stored,
    controller,
    context,
    remember,
    explorer: {
      open: explorerOpen,
      shown: narrow ? explorerPanel.drawerOpen : explorerOpen,
      drawerOpen: explorerPanel.drawerOpen,
      setOpen: setExplorerOpen,
    },
    aside: {
      open: asideOpen,
      shown: narrow ? asidePanel.drawerOpen : asideOpen,
      drawerOpen: asidePanel.drawerOpen,
      setOpen: setAsideOpen,
    },
  }
}

type DocumentWorkspaceState = ReturnType<typeof useDocumentWorkspaceState>

export { useDocumentWorkspaceState }
export type { DocumentWorkspaceState, WorkspaceIds }
