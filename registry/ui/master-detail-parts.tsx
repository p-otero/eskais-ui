"use client"

import { createContext, use, type ReactNode } from "react"
import { ArrowLeftIcon, PanelRightCloseIcon, PanelRightOpenIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type MasterDetailLabels = {
  /** Names the list's region. */
  list: string
  /** Names the detail's region while nothing is open (an open item's title names it). */
  detail: string
  back: string
  close: string
  collapse: string
  expand: string
  resize: string
}

const masterDetailLabels: MasterDetailLabels = {
  list: "List",
  detail: "Detail",
  back: "Back",
  close: "Close detail",
  collapse: "Collapse detail",
  expand: "Expand detail",
  resize: "Resize detail",
}

/** What the detail pane shows for an item. */
type MasterDetailView = {
  title: ReactNode
  description?: ReactNode
  /** Buttons for the detail's header, after the title. */
  actions?: ReactNode
  content: ReactNode
}

type MasterDetailState = {
  selectedId: string | null
  /** Opens an item's detail, as a press on its row does. */
  open: (id: string) => void
  close: () => void
  /** Spread on a `ListItem`: its `id`, `selected` (`aria-current`) and an `onSelect` that opens it. */
  itemProps: (id: string) => { id: string; selected: boolean; onSelect: () => void }
}

const MasterDetailContext = createContext<MasterDetailState | null>(null)

/** The selection of the nearest MasterDetail, for rows rendered deeper than its `list` function. */
function useMasterDetail() {
  const context = use(MasterDetailContext)
  if (!context) throw new Error("useMasterDetail must be used inside a MasterDetail.")
  return context
}

const bar = "flex flex-wrap items-center gap-items border-b px-inset-item py-inline"

function MasterDetailListPane({
  label,
  header,
  toolbar,
  paneRef,
  onFocusRow,
  children,
}: {
  label: string
  header?: ReactNode
  toolbar?: ReactNode
  paneRef: (element: HTMLElement | null) => void
  onFocusRow: (target: EventTarget) => void
  children: ReactNode
}) {
  return (
    <section
      ref={paneRef}
      aria-label={label}
      data-slot="master-detail-list"
      className="flex size-full min-h-0 min-w-0 flex-col"
    >
      {header !== undefined && (
        <div data-slot="master-detail-header" className={bar}>
          {header}
        </div>
      )}
      {toolbar !== undefined && (
        <div data-slot="master-detail-toolbar" className={bar}>
          {toolbar}
        </div>
      )}
      <div
        data-slot="master-detail-list-body"
        className="min-h-0 flex-1 overflow-y-auto p-inline"
        onFocus={(event) => onFocusRow(event.target)}
      >
        {children}
      </div>
    </section>
  )
}

type DetailHeaderProps = {
  view: MasterDetailView
  titleId: string
  headingLevel: 2 | 3 | 4
  labels: MasterDetailLabels
  /** Back on a stacked layout, Close and Collapse beside the list. */
  stacked: boolean
  onClose?: () => void
  onCollapse?: () => void
}

function MasterDetailDetailHeader({
  view,
  titleId,
  headingLevel,
  labels,
  stacked,
  onClose,
  onCollapse,
}: DetailHeaderProps) {
  const Heading = `h${String(headingLevel)}` as "h2"
  const close = stacked ? undefined : onClose
  const collapse = stacked ? undefined : onCollapse
  return (
    <header data-slot="master-detail-detail-header" className="flex flex-col gap-items border-b p-inset-surface">
      {stacked && onClose && (
        <div className="flex">
          <Button variant="ghost" size="sm" onClick={onClose} aria-keyshortcuts="Escape">
            <ArrowLeftIcon className="rtl:-scale-x-100" />
            {labels.back}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-items">
        <div className="flex min-w-0 grow basis-48 flex-col gap-inline">
          <Heading
            id={titleId}
            tabIndex={-1}
            data-slot="master-detail-title"
            className="text-title-sm tracking-tight wrap-anywhere focus:outline-none"
          >
            {view.title}
          </Heading>
          {view.description !== undefined && <p className="text-body-sm text-muted-foreground">{view.description}</p>}
        </div>
        {(view.actions !== undefined || close || collapse) && (
          <div className="flex shrink-0 flex-wrap items-center gap-inline">
            {view.actions}
            {collapse && (
              <Button variant="ghost" size="icon" aria-label={labels.collapse} aria-expanded onClick={collapse}>
                <PanelRightCloseIcon className="rtl:-scale-x-100" />
              </Button>
            )}
            {close && (
              <Button variant="ghost" size="icon" aria-label={labels.close} onClick={close}>
                <XIcon />
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

function MasterDetailRail({ label, onExpand }: { label: string; onExpand: () => void }) {
  return (
    <div data-slot="master-detail-rail" className="flex flex-col items-center py-inline">
      <Button variant="ghost" size="icon" aria-label={label} aria-expanded={false} onClick={onExpand}>
        <PanelRightOpenIcon className="rtl:-scale-x-100" />
      </Button>
    </div>
  )
}

export {
  MasterDetailContext,
  MasterDetailDetailHeader,
  MasterDetailListPane,
  MasterDetailRail,
  masterDetailLabels,
  useMasterDetail,
}
export type { MasterDetailLabels, MasterDetailState, MasterDetailView }
