"use client"

import {
  Tree,
  TreeGroup,
  TreeItem,
  TreeItemIndicator,
  TreeItemLabel,
  treeFromPaths,
  type TreeItemData,
} from "@ui-sdk/react/tree"
import { ChevronRightIcon, FileDiffIcon, FileMinusIcon, FilePlusIcon, FileSymlinkIcon, FolderIcon } from "lucide-react"
import { useMemo } from "react"

import type { DiffLabels } from "@/components/ui/diff-labels"
import { FileChange } from "@/components/ui/diff-stat"
import type { DiffViewFile } from "@/components/ui/diff-view-model"
import type { FileStatus } from "@/lib/diff-types"
import { cn } from "@/lib/utils"

const statusIcon: Record<FileStatus, typeof FileDiffIcon> = {
  added: FilePlusIcon,
  deleted: FileMinusIcon,
  modified: FileDiffIcon,
  renamed: FileSymlinkIcon,
  copied: FileSymlinkIcon,
}

const statusColour: Record<FileStatus, string> = {
  added: "text-diff-added-foreground",
  deleted: "text-diff-removed-foreground",
  modified: "text-muted-foreground",
  renamed: "text-muted-foreground",
  copied: "text-muted-foreground",
}

function Items({
  items,
  files,
  labels,
}: {
  items: TreeItemData[]
  files: ReadonlyMap<string, DiffViewFile>
  labels: DiffLabels
}) {
  return items.map((item) => {
    const file = files.get(item.value)
    const Icon = file ? statusIcon[file.diff.status] : FolderIcon
    return (
      <TreeItem key={item.value} value={item.value} className="outline-none">
        <TreeItemLabel
          className={cn(
            // oxlint-disable-next-line shadcn/no-arbitrary-values -- indents each level by a group gap, from the tree's --tree-level
            "flex cursor-pointer items-center gap-inline rounded-control py-inset-item pe-inline ps-[calc(var(--tree-level)*var(--gap-group)-var(--gap-inline))] text-body-sm",
            "hover:bg-accent hover:text-accent-foreground in-focus-visible:outline-2 in-focus-visible:outline-ring data-selected:bg-accent data-selected:text-accent-foreground",
          )}
        >
          {item.children ? (
            <TreeItemIndicator className="inline-flex data-expanded:rotate-90 rtl:rotate-180 rtl:data-expanded:rotate-90">
              <ChevronRightIcon aria-hidden="true" className="size-3.5" />
            </TreeItemIndicator>
          ) : null}
          <span className={cn("inline-flex shrink-0", file ? statusColour[file.diff.status] : "text-muted-foreground")}>
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {file ? (
            <>
              <span className="sr-only">{labels.status[file.diff.status]}</span>
              <FileChange diff={file.diff} labels={labels} bar={false} />
            </>
          ) : null}
        </TreeItemLabel>
        {item.children ? (
          <TreeGroup>
            <Items items={item.children} files={files} labels={labels} />
          </TreeGroup>
        ) : null}
      </TreeItem>
    )
  })
}

function folders(items: readonly TreeItemData[], out: string[] = []) {
  for (const item of items) {
    if (item.children) {
      out.push(item.value)
      folders(item.children, out)
    }
  }
  return out
}

type GitDiffTreeProps = {
  files: readonly DiffViewFile[]
  /** The file shown, highlighted in the tree. */
  value?: string | null
  onOpen: (path: string) => void
  labels: DiffLabels
  className?: string
}

/** The changed files as a folder tree (UI SDK Tree): status icon, path and counts; choosing one opens it. */
function GitDiffTree({ files, value, onOpen, labels, className }: GitDiffTreeProps) {
  const byPath = useMemo(() => new Map(files.map((file) => [file.path, file])), [files])
  const items = useMemo(() => treeFromPaths(files.map((file) => file.path)), [files])
  const open = useMemo(() => folders(items), [items])
  return (
    <Tree
      aria-label={labels.files}
      items={items}
      defaultExpanded={open}
      value={value ?? null}
      onValueChange={(next) => {
        if (typeof next === "string" && byPath.has(next)) onOpen(next)
      }}
      className={cn("flex flex-col overflow-auto", className)}
    >
      <Items items={items} files={byPath} labels={labels} />
    </Tree>
  )
}

export { GitDiffTree }
export type { GitDiffTreeProps }
