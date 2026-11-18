"use client"

import { createTreeCollection, treeDataNodes } from "@ui-sdk/core/tree"
import {
  Tree as TreePrimitive,
  TreeGroup as TreeGroupPrimitive,
  TreeItem as TreeItemPrimitive,
  TreeItemCheckbox as TreeItemCheckboxPrimitive,
  TreeItemIndicator as TreeItemIndicatorPrimitive,
  TreeItemLabel as TreeItemLabelPrimitive,
  toggleTreeChecked,
  treeFromPaths,
  type TreeCheckStrategy,
  type TreeItemData,
  type TreeItemState,
  type TreeMode,
  type TreeProps as TreePrimitiveProps,
} from "@ui-sdk/react/tree"
import { useMemo, type ComponentProps, type ComponentType, type SVGProps } from "react"
import {
  CheckIcon,
  ChevronRightIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  MinusIcon,
  RotateCwIcon,
} from "lucide-react"

import { useFastLink, type FastLinkOptions } from "@/components/ui/use-fast-link"
import { cnState } from "@/lib/utils"

type TreeIcon = ComponentType<SVGProps<SVGSVGElement>>

/** Picks a row's icon from its data and state; return `null` for none. */
type TreeIconResolver = (item: TreeItemData, state: TreeItemState) => TreeIcon | null

const extensionIcons: Record<string, TreeIcon> = {
  ts: FileCodeIcon,
  tsx: FileCodeIcon,
  js: FileCodeIcon,
  jsx: FileCodeIcon,
  mjs: FileCodeIcon,
  css: FileCodeIcon,
  html: FileCodeIcon,
  py: FileCodeIcon,
  rs: FileCodeIcon,
  go: FileCodeIcon,
  json: FileJsonIcon,
  md: FileTextIcon,
  mdx: FileTextIcon,
  txt: FileTextIcon,
  pdf: FileTextIcon,
  png: FileImageIcon,
  jpg: FileImageIcon,
  jpeg: FileImageIcon,
  gif: FileImageIcon,
  svg: FileImageIcon,
  webp: FileImageIcon,
  csv: FileSpreadsheetIcon,
  xlsx: FileSpreadsheetIcon,
  zip: FileArchiveIcon,
  gz: FileArchiveIcon,
  mp4: FileVideoIcon,
  webm: FileVideoIcon,
  mp3: FileAudioIcon,
  wav: FileAudioIcon,
}

/** The default icons: an open or closed folder for a branch, and a file icon by extension for a leaf. */
const treeFileIcon: TreeIconResolver = (item, state) => {
  if (state.branch) return state.expanded ? FolderOpenIcon : FolderIcon
  const extension = item.label.includes(".") ? item.label.slice(item.label.lastIndexOf(".") + 1).toLowerCase() : ""
  return extensionIcons[extension] ?? FileIcon
}

type TreeProps<Mode extends TreeMode = "single"> = TreePrimitiveProps<Mode> & {
  /**
   * With `items` or `paths` and no children, the icon of each row the tree renders: `treeFileIcon` (folders and
   * files) by default, a function of the item and its state, or `false` for none.
   */
  icon?: TreeIconResolver | false
  /** Routes a link row (an item with `href`) on the client instead of `location.assign`; links follow on press. */
  onFollow?: FastLinkOptions["onFollow"]
}

// Every row indents by its level: one indicator plus the gap after it per level, so a child's text starts under
// its parent's icon and the guide line of its group runs through the parent's indicator.
const treeClassName =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- one level of indent is the size-4 indicator and its gap
  "flex flex-col text-body outline-none [--tree-indent:calc(1rem+var(--gap-inline))] data-disabled:opacity-50"

function Tree<Mode extends TreeMode = "single">({
  className,
  icon = treeFileIcon,
  onFollow,
  children,
  ...props
}: TreeProps<Mode>) {
  const { items, paths, checkable } = props
  const data = useMemo(() => items ?? (paths === undefined ? undefined : treeFromPaths(paths)), [items, paths])
  const ref = useFastLink<HTMLDivElement>({ onFollow })
  return (
    <TreePrimitive ref={ref} className={cnState(treeClassName, className)} {...props}>
      {children ??
        (data === undefined ? undefined : <TreeNodes items={data} icon={icon} checkable={checkable ?? false} />)}
    </TreePrimitive>
  )
}

function TreeItem({ className, ...props }: ComponentProps<typeof TreeItemPrimitive>) {
  return <TreeItemPrimitive className={cnState("group/tree-item outline-none", className)} {...props} />
}

function TreeItemLabel({ className, ...props }: ComponentProps<typeof TreeItemLabelPrimitive>) {
  return (
    <TreeItemLabelPrimitive
      className={cnState(
        [
          "flex min-h-control-sm cursor-default items-center gap-inline rounded-control py-inset-item pe-(--item-padding-x) text-body text-foreground select-none",
          "ps-[calc(var(--item-padding-x)+(var(--tree-level,1)-1)*var(--tree-indent))] pointer-coarse:min-h-(--control-height-touch)",
          "hover:bg-accent/60 data-selected:bg-accent data-selected:text-accent-foreground data-current:font-medium data-disabled:cursor-not-allowed data-disabled:opacity-50 data-pending:opacity-70",
          "group-focus-visible/tree-item:ring-2 group-focus-visible/tree-item:ring-ring group-focus-visible/tree-item:ring-inset",
          "[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&_a]:outline-none",
        ].join(" "),
        className,
      )}
      {...props}
    />
  )
}

function TreeItemIndicator({ className, children, ...props }: ComponentProps<typeof TreeItemIndicatorPrimitive>) {
  return (
    <TreeItemIndicatorPrimitive
      className={cnState(
        "inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-transform duration-micro ease-standard data-expanded:rotate-90 rtl:-scale-x-100 rtl:data-expanded:rotate-90 [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children ??
        ((state) =>
          state.loading ? (
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
          ) : state.failed ? (
            <RotateCwIcon />
          ) : (
            <ChevronRightIcon />
          ))}
    </TreeItemIndicatorPrimitive>
  )
}

function TreeItemCheckbox({ className, children, ...props }: ComponentProps<typeof TreeItemCheckboxPrimitive>) {
  return (
    <TreeItemCheckboxPrimitive
      className={cnState(
        "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-choice border border-input-strong bg-background/(--glass-opacity) text-primary-foreground shadow-xs data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {children ??
        ((state) =>
          state.checked === "indeterminate" ? (
            <MinusIcon strokeWidth={3} />
          ) : state.checked ? (
            <CheckIcon strokeWidth={3} />
          ) : null)}
    </TreeItemCheckboxPrimitive>
  )
}

function TreeGroup({ className, ...props }: ComponentProps<typeof TreeGroupPrimitive>) {
  return (
    <TreeGroupPrimitive
      className={cnState(
        [
          "relative flex flex-col overflow-hidden",
          "h-(--tree-group-height) transition-[height] duration-panel ease-standard data-ending-style:h-0 data-starting-style:h-0",
          "before:pointer-events-none before:absolute before:inset-y-0 before:w-px before:bg-border",
          "before:start-[calc(var(--item-padding-x)+(var(--tree-level,1)-1)*var(--tree-indent)+0.5rem-0.5px)]",
        ].join(" "),
        className,
      )}
      {...props}
    />
  )
}

type TreeNodesProps = {
  items: readonly TreeItemData[]
  icon?: TreeIconResolver | false
  checkable?: boolean
}

/** Renders data items as styled rows: indicator, checkbox (with `checkable`), icon and label. */
function TreeNodes({ items, icon = treeFileIcon, checkable = false }: TreeNodesProps) {
  return items.map((item) => (
    <TreeItem key={item.value} value={item.value} disabled={item.disabled}>
      <TreeItemLabel
        render={
          item.href === undefined
            ? undefined
            : (part) => (
                <a {...part} href={item.href}>
                  {part.children}
                </a>
              )
        }
      >
        {(state) => {
          const Icon = icon === false ? null : icon(item, state)
          return (
            <>
              {state.branch ? <TreeItemIndicator /> : <span aria-hidden className="size-4 shrink-0" />}
              {checkable ? <TreeItemCheckbox /> : null}
              {Icon === null ? null : <Icon aria-hidden />}
              <span className="min-w-0 truncate">{item.label}</span>
            </>
          )
        }}
      </TreeItemLabel>
      {item.children === undefined ? null : (
        <TreeGroup>
          <TreeNodes items={item.children} icon={icon} checkable={checkable} />
        </TreeGroup>
      )}
    </TreeItem>
  ))
}

/**
 * The checked value after pressing one item's checkbox, from the items as data: for a checked value you keep
 * yourself, like an agent tool or a "select this folder" button outside the tree.
 */
function toggleTreeItem(
  items: readonly TreeItemData[],
  checked: readonly string[],
  value: string,
  strategy: TreeCheckStrategy = "leaf",
) {
  const disabled = new Set(
    treeDataNodes(items)
      .filter((node) => node.item.disabled)
      .map((node) => node.key),
  )
  return toggleTreeChecked(createTreeCollection(treeDataNodes(items)), checked, value, {
    strategy,
    checkable: (key) => !disabled.has(key),
  })
}

export {
  Tree,
  TreeGroup,
  TreeItem,
  TreeItemCheckbox,
  TreeItemIndicator,
  TreeItemLabel,
  TreeNodes,
  toggleTreeItem,
  treeFileIcon,
}
export {
  createTreeController,
  toggleTreeChecked,
  treeCheckedStates,
  treeFromPaths,
  visibleTreeRows,
} from "@ui-sdk/react/tree"
export type { TreeIcon, TreeIconResolver, TreeNodesProps, TreeProps }
export type {
  TreeCheckStrategy,
  TreeCheckedState,
  TreeController,
  TreeItemData,
  TreeItemState,
  TreeMode,
  TreeRow,
  TreeValue,
} from "@ui-sdk/react/tree"
