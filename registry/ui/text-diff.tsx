"use client"

import { useMemo, type ReactNode } from "react"

import { diffLabels } from "@/components/ui/diff-labels"
import { DiffView, type DiffViewProps } from "@/components/ui/diff-view"
import { toViewFiles } from "@/components/ui/diff-view-model"
import { useTextDiff, type TextDiffInput } from "@/components/ui/use-text-diff"
import { toFileDiff } from "@/lib/diff-lines"
import { cn } from "@/lib/utils"

type TextDiffProps = Omit<DiffViewProps, "files" | "headers"> &
  TextDiffInput & {
    oldText: string
    newText: string
    /** A file name or extension (`"app.tsx"`, `"css"`) that picks the syntax colours. */
    language?: string
    /** Shown while a large diff is computed in a worker, before the first result. */
    loading?: ReactNode
  }

/**
 * Compares two strings line by line: unified or split, line numbers, unchanged regions folded behind "Expand N
 * lines", changed words highlighted, syntax colours, word wrap and find in page across folded and off-screen
 * lines. Large inputs diff in a Web Worker.
 */
function TextDiff({
  oldText,
  newText,
  language = "",
  algorithm,
  context,
  ignoreWhitespace,
  maxLines,
  maxChars,
  maxCost,
  worker,
  workerThreshold,
  loading,
  labels = diffLabels,
  className,
  ...props
}: TextDiffProps) {
  const { diff, pending } = useTextDiff(oldText, newText, {
    algorithm,
    context,
    ignoreWhitespace,
    maxLines,
    maxChars,
    maxCost,
    worker,
    workerThreshold,
  })
  const files = useMemo(() => {
    if (!diff) return []
    const name = language.includes(".") ? language : language ? `file.${language}` : ""
    const [view] = toViewFiles([toFileDiff(diff, oldText, newText, { oldPath: name })])
    return diff.hunks.length > 0 || diff.status !== "ok" ? [{ ...view!, path: "" }] : []
  }, [diff, language, oldText, newText])
  if (!diff) {
    return (
      <div
        data-slot="text-diff-loading"
        aria-busy="true"
        className={cn("p-inset-surface text-muted-foreground", className)}
      >
        {loading ?? labels.loading}
      </div>
    )
  }
  return (
    <DiffView
      {...props}
      files={files}
      labels={labels}
      aria-busy={pending || undefined}
      className={cn("aria-busy:opacity-80", className)}
    />
  )
}

export { TextDiff }
export type { TextDiffProps }
