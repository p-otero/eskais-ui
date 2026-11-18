"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { useId, useState, type CSSProperties, type ReactNode } from "react"

import {
  MasterDetailContext,
  MasterDetailDetailHeader,
  MasterDetailListPane,
  MasterDetailRail,
  masterDetailLabels,
  useMasterDetail,
  type MasterDetailLabels,
  type MasterDetailState,
  type MasterDetailView,
} from "@/components/ui/master-detail-parts"
import {
  masterDetail,
  type MasterDetailEntry,
  type MasterDetailSelectReason,
} from "@/components/ui/master-detail-primitive"
import {
  createResizableController,
  Resizable,
  ResizableHandle,
  ResizablePanel,
  type ResizableSize,
} from "@/components/ui/resizable"
import { ShortcutScope } from "@/components/ui/shortcuts"
import {
  useDetailFocus,
  useNarrowerThan,
  useSelectedId,
  useStoredFlag,
  useSyncAfterCommit,
} from "@/components/ui/use-master-detail"
import { useShortcut } from "@/components/ui/use-shortcut"
import type { UrlParamAdapter } from "@/lib/url-param"
import { cn } from "@/lib/utils"

type MasterDetailProps = Omit<PartProps<"div">, "children" | "aria-label" | "style"> & {
  /** Names the block: agents open and close items through it by this name. */
  label: string
  /** The list, whose rows read the selection with `useMasterDetail()`. Or use `renderList`. */
  list?: ReactNode
  /** Renders the list with the selection: usually a `List` whose rows spread `state.itemProps(id)`. */
  renderList?: (state: MasterDetailState) => ReactNode
  /** The open item's view, or null when the id is unknown (then `emptyDetail` shows). */
  renderDetail: (id: string) => MasterDetailView | null
  /** Shown beside the list while nothing is open, on wide containers. */
  emptyDetail?: ReactNode
  /** Above the list, like a title and a count. */
  header?: ReactNode
  /** Under the header, like a search field or filters. */
  toolbar?: ReactNode
  selectedId?: string | null
  defaultSelectedId?: string | null
  onSelectedIdChange?: (id: string | null, details: ChangeDetails<MasterDetailSelectReason>) => void
  /** The items agents may open, `{ id, label }`. Without them `open` takes any id and lists none. */
  items?: readonly MasterDetailEntry[]
  /** Keeps the selected id in the URL when uncontrolled: `createUrlParam("device")` from `@/lib/url-param`. */
  url?: UrlParamAdapter
  /** While an item is open on a wide container, moving focus to another row (j/k, arrows) opens it. */
  followFocus?: boolean
  /** Adds a button that collapses the detail to a rail with an expand button. */
  collapsible?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** A handle between the panes resizes them, by drag or arrow keys. */
  resizable?: boolean
  /** The list's starting share of the width when resizable, like `40` (percent) or `"22rem"`. */
  defaultListSize?: ResizableSize
  /** Remembers the collapsed state and the panes' sizes in localStorage under keys that start with this. */
  storageKey?: string
  /** Shows a Close button in the detail's header on wide containers. Default true. */
  closable?: boolean
  /** The level of the open item's title. Default 2. */
  headingLevel?: 2 | 3 | 4
  /** The focusable element of a row, to return focus to. By default the row with `data-item-id` or `data-row-id`. */
  getRowElement?: (id: string) => HTMLElement | null | undefined
  /** The `ShortcutScope` that Escape belongs to. */
  scope?: string
  labels?: Partial<MasterDetailLabels>
  /** `--master-detail-height` (100% by default) and `--master-detail-list-width` set the block's size. */
  style?: CSSProperties
}

// The container width below which the panes stack; the `@max-2xl/master-detail` variants use the same 42rem.
const stackBelowRem = 42
const railSize = "3.25rem"

const stackedClassNames = {
  list: "@max-2xl/master-detail:w-full @max-2xl/master-detail:!flex-auto @max-2xl/master-detail:border-e-0 @max-2xl/master-detail:data-covered:hidden",
  detail: "@max-2xl/master-detail:w-full @max-2xl/master-detail:!flex-auto @max-2xl/master-detail:data-idle:hidden",
}

function rootAttributes(label: string, narrow: boolean, style: CSSProperties | undefined) {
  return {
    "aria-label": label,
    "data-slot": "master-detail",
    "data-stacked": narrow ? "" : undefined,
    style: {
      "--master-detail-height": "100%",
      "--master-detail-list-width": "clamp(16rem, 38%, 26rem)",
      ...style,
    } as CSSProperties,
  }
}

function rowIdOf(target: EventTarget) {
  if (!(target instanceof Element)) return undefined
  const row = target.closest<HTMLElement>("[data-item-id], [data-row-id]")
  return row?.dataset.itemId ?? row?.dataset.rowId
}

/**
 * A list with a detail pane: side by side on wide containers, stacked below 42rem (the list, or the open item with
 * a Back button). Opening moves focus to the detail's heading; closing returns it to the row.
 */
function MasterDetail({
  label,
  list,
  renderList,
  renderDetail,
  emptyDetail,
  header,
  toolbar,
  selectedId: selectedIdProp,
  defaultSelectedId,
  onSelectedIdChange,
  items,
  url,
  followFocus = false,
  collapsible = false,
  defaultCollapsed = false,
  onCollapsedChange,
  resizable = false,
  defaultListSize = 38,
  storageKey,
  closable = true,
  headingLevel = 2,
  getRowElement,
  scope = "master-detail",
  labels: overrides,
  className,
  style,
  ...props
}: MasterDetailProps) {
  const labels = { ...masterDetailLabels, ...overrides }
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const [listPane, setListPane] = useState<HTMLElement | null>(null)
  const [detailPane, setDetailPane] = useState<HTMLElement | null>(null)
  const titleId = useId()
  const generatedId = useId()
  const detailPanel = `${storageKey ?? generatedId}-detail`
  const [resize] = useState(createResizableController)

  const narrow = useNarrowerThan(root, stackBelowRem)
  const [selectedId, apply] = useSelectedId(selectedIdProp, defaultSelectedId, url)
  const [storedCollapsed, storeCollapsed] = useStoredFlag(
    storageKey === undefined ? undefined : `${storageKey}:collapsed`,
    defaultCollapsed,
  )
  const collapsed = collapsible && storedCollapsed && !narrow
  const setCollapsed = (next: boolean) => {
    if (next === storedCollapsed) return
    storeCollapsed(next)
    onCollapsedChange?.(next)
  }
  const focus = useDetailFocus({ selectedId, stacked: narrow, list: listPane, detail: detailPane, getRowElement })

  const handle = usePrimitive(masterDetail, {
    selectedId,
    entries: items,
    onSelectedIdChange: (id, details) => {
      onSelectedIdChange?.(id, details)
      if (!details.canceled) apply(id)
    },
  })

  const open = (id: string, reason: MasterDetailSelectReason = "item-press") => {
    if (reason === "item-press") {
      if (collapsed) setCollapsed(false)
      if (id === selectedId) {
        focus.heading()
        return
      }
      if (!followFocus || narrow) focus.request("detail")
    }
    if (!handle.api.open(id, { reason })) focus.cancel()
  }
  const close = (reason: MasterDetailSelectReason) => {
    focus.request("row")
    if (!handle.api.close({ reason })) focus.cancel()
  }

  useShortcut("escape", () => close("escape-key"), {
    scope,
    enabled: narrow && selectedId !== null,
    allowInInput: true,
    description: labels.back,
  })

  useSyncAfterCommit(resizable && collapsible ? storedCollapsed : undefined, (value) => {
    if (value === true) resize.collapse(detailPanel)
    else if (value === false) resize.expand(detailPanel)
  })

  const state: MasterDetailState = {
    selectedId,
    open: (id) => open(id),
    close: () => close("imperative"),
    itemProps: (id) => ({ id, selected: id === selectedId, onSelect: () => open(id) }),
  }

  const follow = (target: EventTarget) => {
    if (!followFocus || selectedId === null || narrow) return
    const id = rowIdOf(target)
    if (id === undefined || id === selectedId) return
    if (items !== undefined && !items.some((item) => item.id === id)) return
    open(id, "focus-in")
  }

  const view = selectedId === null ? null : renderDetail(selectedId)
  const listSection = (
    <MasterDetailListPane
      label={labels.list}
      header={header}
      toolbar={toolbar}
      paneRef={setListPane}
      onFocusRow={follow}
    >
      {renderList ? renderList(state) : list}
    </MasterDetailListPane>
  )

  let detailContent: ReactNode = (
    <div data-slot="master-detail-empty" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-inset-surface">
      {emptyDetail}
    </div>
  )
  if (collapsed) {
    detailContent = <MasterDetailRail label={labels.expand} onExpand={() => setCollapsed(false)} />
  } else if (view) {
    detailContent = (
      <>
        <MasterDetailDetailHeader
          view={view}
          titleId={titleId}
          headingLevel={headingLevel}
          labels={labels}
          stacked={narrow}
          onClose={narrow || closable ? () => close("close-press") : undefined}
          onCollapse={collapsible ? () => setCollapsed(true) : undefined}
        />
        <div
          data-slot="master-detail-body"
          className="flex min-h-0 flex-1 flex-col gap-group overflow-y-auto p-inset-surface"
        >
          {view.content}
        </div>
      </>
    )
  }
  const named = view !== null && !collapsed
  const detailSection = (
    <section
      ref={setDetailPane}
      aria-labelledby={named ? titleId : undefined}
      aria-label={named ? undefined : labels.detail}
      data-slot="master-detail-detail"
      className="flex size-full min-h-0 min-w-0 flex-col"
    >
      {detailContent}
    </section>
  )

  const covered = selectedId === null ? undefined : ""
  const idle = view === null ? "" : undefined
  const flag = collapsed ? "" : undefined
  const body = resizable ? (
    <Resizable
      controller={resize}
      autoSaveId={storageKey === undefined ? undefined : `${storageKey}:layout`}
      onLayoutChange={(_layout, details) => {
        if (details.reason !== "imperative" && collapsible) setCollapsed(resize.isCollapsed(detailPanel))
      }}
    >
      <ResizablePanel
        id={`${storageKey ?? generatedId}-list`}
        defaultSize={defaultListSize}
        minSize="16rem"
        data-covered={covered}
        className={cn("flex overflow-hidden", stackedClassNames.list)}
      >
        {listSection}
      </ResizablePanel>
      <ResizableHandle aria-label={labels.resize} className="@max-2xl/master-detail:hidden" />
      <ResizablePanel
        id={detailPanel}
        minSize="20rem"
        collapsible={collapsible}
        collapsedSize={railSize}
        data-idle={idle}
        data-collapsed={flag}
        className={cn("flex overflow-hidden", stackedClassNames.detail)}
      >
        {detailSection}
      </ResizablePanel>
    </Resizable>
  ) : (
    <>
      <div
        data-covered={covered}
        className={cn(
          "flex min-h-0 min-w-0 border-e",
          collapsed ? "flex-1" : "w-(--master-detail-list-width) shrink-0",
          stackedClassNames.list,
        )}
      >
        {listSection}
      </div>
      <div
        data-idle={idle}
        data-collapsed={flag}
        className={cn(
          "flex min-h-0 min-w-0",
          collapsed ? "w-(--sidebar-rail-width) shrink-0" : "flex-1",
          stackedClassNames.detail,
        )}
      >
        {detailSection}
      </div>
    </>
  )

  return usePart(
    handle,
    "root",
    {},
    {
      ...props,
      ...rootAttributes(label, narrow, style),
      ref: setRoot,
      className: cn(
        "@container/master-detail flex h-(--master-detail-height) min-h-0 w-full min-w-0 overflow-hidden bg-background",
        className,
      ),
      children: (
        <MasterDetailContext value={state}>
          <ShortcutScope name={scope} className="flex min-h-0 min-w-0 flex-1">
            {body}
          </ShortcutScope>
        </MasterDetailContext>
      ),
    },
    "div",
  )
}

export { MasterDetail, masterDetailLabels, useMasterDetail }
export type {
  MasterDetailEntry,
  MasterDetailLabels,
  MasterDetailProps,
  MasterDetailSelectReason,
  MasterDetailState,
  MasterDetailView,
}
