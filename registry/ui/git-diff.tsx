"use client"

import { Columns2Icon, RowsIcon, WrapTextIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { diffLabels } from "@/components/ui/diff-labels"
import { DiffStat } from "@/components/ui/diff-stat"
import { DiffView, type DiffViewProps } from "@/components/ui/diff-view"
import { toViewFiles, type DiffLayout } from "@/components/ui/diff-view-model"
import { createDiffViewController } from "@/components/ui/diff-view-primitive"
import { GitDiffTree } from "@/components/ui/git-diff-tree"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Toggle } from "@/components/ui/toggle"
import { parsePatch } from "@/lib/diff-patch"
import type { FileDiff } from "@/lib/diff-types"
import { cn } from "@/lib/utils"

type GitDiffProps = Omit<DiffViewProps, "files" | "headers"> & {
  /** A unified diff as git prints it (`git diff`, `git show`, a `.patch`), with any number of files. */
  patch?: string
  /** File diffs you parsed or computed; give `oldText`/`newText` to make unchanged regions expandable. */
  files?: readonly FileDiff[]
  /** The changed-files tree beside the diff. @defaultValue true */
  fileTree?: boolean
  /** The layout and wrap controls and the totals above the diff. @defaultValue true */
  toolbar?: boolean
  /** `fill` (default) fills the height GitDiff is given, beside its file tree; `auto` grows to the diff. */
  height?: DiffViewProps["height"]
}

function useControlled<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [own, setOwn] = useState(initial)
  const current = value ?? own
  const set = (next: T) => {
    if (value === undefined) setOwn(next)
    onChange?.(next)
  }
  return [current, set] as const
}

/**
 * A patch or a list of file diffs, rendered for review: a header per file (rename, status, counts, collapse,
 * viewed), a tree of changed files to jump between them, unified or split layout and word wrap, all files and
 * lines in one virtualized scroller, j/k between hunks and n/p between files, line selection for comments, and
 * agent actions (openFile, nextHunk, previousHunk, markViewed, getHunk).
 */
function GitDiff({
  patch,
  files: given,
  fileTree = true,
  toolbar = true,
  labels = diffLabels,
  layout: layoutProp,
  defaultLayout = "unified",
  onLayoutChange,
  wrap: wrapProp,
  defaultWrap = false,
  onWrapChange,
  controller: controllerProp,
  height = "fill",
  className,
  ...props
}: GitDiffProps) {
  const diffs = useMemo(() => given ?? (patch ? parsePatch(patch) : []), [given, patch])
  const files = useMemo(() => toViewFiles(diffs), [diffs])
  const [own] = useState(createDiffViewController)
  const controller = controllerProp ?? own
  const [layout, setLayout] = useControlled<DiffLayout>(layoutProp, defaultLayout)
  const [wrap, setWrap] = useControlled(wrapProp, defaultWrap)
  const [current, setCurrent] = useState<string | null>(null)
  const totals = useMemo(
    () =>
      diffs.reduce(
        (sum, file) => ({ additions: sum.additions + file.additions, deletions: sum.deletions + file.deletions }),
        { additions: 0, deletions: 0 },
      ),
    [diffs],
  )
  return (
    <div data-slot="git-diff" className={cn("flex min-h-0 flex-col gap-items", className)}>
      {toolbar ? (
        <div data-slot="git-diff-toolbar" className="flex flex-wrap items-center gap-items">
          <DiffStat additions={totals.additions} deletions={totals.deletions} labels={labels} />
          <div className="ms-auto flex items-center gap-items">
            <SegmentedControl<DiffLayout>
              aria-label={labels.layout}
              value={layout}
              onValueChange={(next) => {
                if (next) controller.setLayout(next)
              }}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="unified">
                <RowsIcon aria-hidden="true" />
                {labels.unified}
              </SegmentedControlItem>
              <SegmentedControlItem value="split">
                <Columns2Icon aria-hidden="true" />
                {labels.split}
              </SegmentedControlItem>
            </SegmentedControl>
            <Toggle variant="outline" pressed={wrap} onPressedChange={(next) => controller.setWrap(next)}>
              <WrapTextIcon aria-hidden="true" />
              {labels.wrap}
            </Toggle>
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 gap-group">
        {fileTree && files.length > 1 ? (
          <GitDiffTree
            files={files}
            value={current}
            labels={labels}
            onOpen={(path) => {
              setCurrent(path)
              controller.openFile(path)
            }}
            className="w-64 shrink-0 narrow:hidden"
          />
        ) : null}
        <DiffView
          {...props}
          height={height}
          headers
          files={files}
          labels={labels}
          controller={controller}
          layout={layout}
          onLayoutChange={(next, details) => {
            onLayoutChange?.(next, details)
            if (!details.canceled) setLayout(next)
          }}
          wrap={wrap}
          onWrapChange={(next, details) => {
            onWrapChange?.(next, details)
            if (!details.canceled) setWrap(next)
          }}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  )
}

export { GitDiff }
export type { GitDiffProps }
