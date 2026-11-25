"use client"

import type { ComponentProps, MouseEvent, ReactNode } from "react"

import { Drawer, DrawerBackdrop, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { Resizable, ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
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

function PanelScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="size-full">
      <ScrollAreaViewport>{children}</ScrollAreaViewport>
      <ScrollAreaScrollbar data-agent-hidden="" />
      <ScrollAreaScrollbar orientation="horizontal" data-agent-hidden="" />
    </ScrollArea>
  )
}

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
            className="overflow-hidden bg-muted/(--glass-opacity)"
          >
            <PanelScroll>{explorer}</PanelScroll>
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
            className="overflow-hidden"
          >
            <PanelScroll>{aside}</PanelScroll>
          </ResizablePanel>
        </>
      )}
    </Resizable>
  )
}

function WorkspaceDrawers({ state, explorer, aside }: PanelsProps) {
  const { ids, labels, context } = state
  const onClosed = () => context.refocusDocument()

  const closeExplorerWhenALinkIsFollowed = (event: MouseEvent<HTMLElement>) => {
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
          <ScrollArea className="flex min-h-0 flex-1 flex-col">
            <ScrollAreaViewport
              id={ids.explorer}
              aria-label={labels.explorer}
              onClick={closeExplorerWhenALinkIsFollowed}
              className="h-auto min-h-0 flex-1"
              render={(part) => <nav {...part} data-slot="document-workspace-explorer" />}
            >
              {explorer}
            </ScrollAreaViewport>
            <ScrollAreaScrollbar data-agent-hidden="" />
            <ScrollAreaScrollbar orientation="horizontal" data-agent-hidden="" />
          </ScrollArea>
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
          <ScrollArea className="flex min-h-0 flex-1 flex-col">
            <ScrollAreaViewport
              id={ids.aside}
              aria-label={labels.aside}
              className="h-auto min-h-0 flex-1"
              render={(part) => <aside {...part} data-slot="document-workspace-aside" />}
            >
              {aside}
            </ScrollAreaViewport>
            <ScrollAreaScrollbar data-agent-hidden="" />
            <ScrollAreaScrollbar orientation="horizontal" data-agent-hidden="" />
          </ScrollArea>
        </WorkspaceDrawer>
      )}
    </>
  )
}

export { WorkspaceColumns, WorkspaceDrawer, WorkspaceDrawers }
