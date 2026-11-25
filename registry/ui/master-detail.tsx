"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { useId, useState, type CSSProperties, type ReactNode } from "react"

import {
  MasterDetailContext,
  MasterDetailDetailHeader,
  MasterDetailIdle,
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
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
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
  /** Shown beside the list while nothing is open, on wide containers (and stacked ones with `idleDetail="visible"`). */
  emptyDetail?: ReactNode
  /** A title for `emptyDetail`, in a bar above it that also holds its collapse button; it names the pane. */
  emptyDetailTitle?: ReactNode
  /**
   * What a stacked container (under 42rem) shows while nothing is open: `hidden` (default) only the list; `visible`
   * keeps `emptyDetail` under the list, like a live monitor, with a button that collapses it to its bar. With
   * `collapsible`, the idle detail also gets that button beside the list, where it collapses to the rail.
   */
  idleDetail?: "hidden" | "visible"
  /**
   * `fill` (default) fills the parent's height, for a bounded box like an app shell's main column. `auto` sizes it to
   * its content between `--master-detail-min-height` (16rem) and `--master-detail-max-height` (40rem), the panes
   * scrolling inside, for a block in a scrolling page.
   */
  height?: "fill" | "auto"
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
  /**
   * `--master-detail-height` (100% by default) and `--master-detail-list-width` set the block's size; with
   * `height="auto"`, `--master-detail-min-height` and `--master-detail-max-height` bound it. `--master-detail-idle-height`
   * (50%) caps a stacked idle detail.
   */
  style?: CSSProperties
}

const stackBelowRem = 42
const railSize = "3.25rem"

const stackedClassNames = {
  list: "@max-2xl/master-detail:w-full @max-2xl/master-detail:!flex-auto @max-2xl/master-detail:border-e-0 @max-2xl/master-detail:data-covered:hidden",
  detail: "@max-2xl/master-detail:w-full @max-2xl/master-detail:!flex-auto @max-2xl/master-detail:data-idle:hidden",
  idleDetail:
    "@max-2xl/master-detail:w-full @max-2xl/master-detail:!flex-auto @max-2xl/master-detail:data-idle:!flex-none @max-2xl/master-detail:data-idle:max-h-(--master-detail-idle-height) @max-2xl/master-detail:data-idle:border-t @max-2xl/master-detail:data-idle:data-collapsed:max-h-none",
}

const heightClassNames = {
  fill: "h-(--master-detail-height)",
  auto: "h-auto min-h-(--master-detail-min-height) max-h-(--master-detail-max-height)",
}

function rootAttributes(label: string, narrow: boolean, height: "fill" | "auto", style: CSSProperties | undefined) {
  return {
    "aria-label": label,
    "data-slot": "master-detail",
    "data-stacked": narrow ? "" : undefined,
    "data-height": height,
    style: {
      "--master-detail-height": "100%",
      "--master-detail-min-height": "16rem",
      "--master-detail-max-height": "40rem",
      "--master-detail-idle-height": "50%",
      "--master-detail-list-width": "clamp(16rem, 38%, 26rem)",
      ...style,
    } as CSSProperties,
  }
}

function rowIdOf(target: EventTarget) {
  if (!(target instanceof Element) || target.closest("[data-slot=list-item-actions]")) return undefined
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
  emptyDetailTitle,
  idleDetail = "hidden",
  height = "fill",
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
  const idleTitleId = useId()
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
  const idleVisible = idleDetail === "visible"
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
    }
    if (!handle.api.open(id, { reason })) return
    if (reason === "item-press" && (!followFocus || narrow)) focus.request("detail")
  }
  const close = (reason: MasterDetailSelectReason) => {
    if (handle.api.close({ reason })) focus.request("row")
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

  const idleCollapsed = idleVisible && narrow && storedCollapsed && view === null
  const idleToggle = idleVisible && (narrow || collapsible)
  let detailContent: ReactNode = (
    <MasterDetailIdle
      title={emptyDetailTitle}
      titleId={idleTitleId}
      labels={labels}
      stacked={narrow}
      collapsed={idleCollapsed}
      onToggle={idleToggle ? () => setCollapsed(!storedCollapsed) : undefined}
    >
      {emptyDetail}
    </MasterDetailIdle>
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
        <ScrollArea className="flex min-h-0 flex-1 flex-col">
          <ScrollAreaViewport
            className="flex h-auto min-h-0 flex-1 flex-col gap-group p-inset-surface"
            render={(part) => <div {...part} data-slot="master-detail-body" />}
          >
            {view.content}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar data-agent-hidden="" />
        </ScrollArea>
      </>
    )
  }
  const named = view !== null && !collapsed
  let labelledBy: string | undefined
  if (named) labelledBy = titleId
  else if (view === null && !collapsed && emptyDetailTitle !== undefined) labelledBy = idleTitleId
  const detailSection = (
    <section
      ref={setDetailPane}
      aria-labelledby={labelledBy}
      aria-label={labelledBy === undefined ? labels.detail : undefined}
      data-slot="master-detail-detail"
      className="flex size-full min-h-0 min-w-0 flex-col"
    >
      {detailContent}
    </section>
  )

  const covered = selectedId === null ? undefined : ""
  const idle = view === null ? "" : undefined
  const flag = collapsed || idleCollapsed ? "" : undefined
  const detailStacking = idleVisible ? stackedClassNames.idleDetail : stackedClassNames.detail
  // Workaround: UI SDK's group lays its panes out in a row with an inline style, so the stacked column needs `!`.
  const stackColumn = idleVisible ? "@max-2xl/master-detail:!flex-col" : undefined
  const body = resizable ? (
    <Resizable
      controller={resize}
      className={stackColumn}
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
        className={cn("flex overflow-hidden", detailStacking)}
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
          detailStacking,
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
      ...rootAttributes(label, narrow, height, style),
      ref: setRoot,
      className: cn(
        "@container/master-detail flex w-full min-w-0 overflow-hidden bg-background",
        height === "auto" ? heightClassNames.auto : cn(heightClassNames.fill, "min-h-0"),
        className,
      ),
      children: (
        <MasterDetailContext value={state}>
          <ShortcutScope name={scope} className={cn("flex min-h-0 min-w-0 flex-1", !resizable && stackColumn)}>
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
