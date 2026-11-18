"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"

import { Drawer, DrawerBackdrop, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import type { DocumentWorkspaceState } from "@/components/ui/use-document-workspace-state"

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

type PanelsProps = { state: DocumentWorkspaceState; explorer?: ReactNode; aside?: ReactNode }

/** The wide layout: the explorer, the center and the aside as resizable columns that collapse to nothing. */
function WorkspaceColumns({ state, explorer, aside, children }: PanelsProps & { children: ReactNode }) {
  const { ids, labels, stored, controller } = state
  return (
    <Resizable controller={controller} onLayoutCommit={state.remember} className="min-h-0 flex-1">
      {explorer !== undefined && (
        <>
          <ResizablePanel
            id={ids.explorer}
            collapsible
            collapsedSize={0}
            minSize="180px"
            maxSize="45%"
            defaultSize={state.explorer.open ? (stored.explorerSize ?? "256px") : 0}
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
        {children}
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
            defaultSize={state.aside.open ? (stored.asideSize ?? "288px") : 0}
            render={<aside aria-label={labels.aside} />}
            data-slot="document-workspace-aside"
          >
            {aside}
          </ResizablePanel>
        </>
      )}
    </Resizable>
  )
}

/** The narrow layout: the explorer and the aside as drawers from their sides. */
function WorkspaceDrawers({ state, explorer, aside }: PanelsProps) {
  const { ids, labels, context } = state
  const onClosed = () => context.refocusDocument()

  // A file chosen in the drawer is navigation: the drawer closes and focus goes to the document.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) state.explorer.setOpen(false)
  }

  return (
    <>
      {explorer !== undefined && (
        <WorkspaceDrawer
          open={state.explorer.drawerOpen}
          onOpenChange={state.explorer.setOpen}
          side="start"
          title={labels.explorer}
          finalFocus={context.documentFocusTarget}
          onClosed={onClosed}
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
      {aside !== undefined && (
        <WorkspaceDrawer
          open={state.aside.drawerOpen}
          onOpenChange={state.aside.setOpen}
          side="end"
          title={labels.aside}
          finalFocus={context.documentFocusTarget}
          onClosed={onClosed}
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
    </>
  )
}

export { WorkspaceColumns, WorkspaceDrawer, WorkspaceDrawers }
