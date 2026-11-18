"use client"

import { useEffect, useMemo, useState } from "react"

import { diffsInWorker, diffTextAsync, type AsyncDiffOptions } from "@/lib/diff-async"
import { diffText } from "@/lib/diff-lines"
import type { TextDiff } from "@/lib/diff-types"

type TextDiffInput = Omit<AsyncDiffOptions, "signal">

type Result = { oldText: string; newText: string; key: string; diff: TextDiff }

/**
 * Diffs two texts: during render below the worker threshold, so a small diff never flashes a loading state, and
 * in a Web Worker above it, keeping the last result on screen (`pending`) until the new one arrives. Options are
 * read field by field, so callers can pass them inline.
 */
function useTextDiff(oldText: string, newText: string, options: TextDiffInput = {}) {
  const { algorithm, context, ignoreWhitespace, maxLines, maxChars, maxCost, worker, workerThreshold } = options
  const key = [algorithm, context, ignoreWhitespace, maxLines, maxChars, maxCost].join("|")
  const inWorker = diffsInWorker(oldText, newText, { worker, workerThreshold })
  const now = useMemo(
    () =>
      inWorker
        ? null
        : diffText(oldText, newText, { algorithm, context, ignoreWhitespace, maxLines, maxChars, maxCost }),
    [inWorker, oldText, newText, algorithm, context, ignoreWhitespace, maxLines, maxChars, maxCost],
  )
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!inWorker) return
    const controller = new AbortController()
    const signal = controller.signal
    diffTextAsync(oldText, newText, {
      algorithm,
      context,
      ignoreWhitespace,
      maxLines,
      maxChars,
      maxCost,
      worker,
      workerThreshold,
      signal,
    }).then(
      (diff) => setResult({ oldText, newText, key, diff }),
      () => {},
    )
    return () => controller.abort()
  }, [
    inWorker,
    oldText,
    newText,
    key,
    algorithm,
    context,
    ignoreWhitespace,
    maxLines,
    maxChars,
    maxCost,
    worker,
    workerThreshold,
  ])

  if (now) return { diff: now, pending: false }
  const current = result && result.oldText === oldText && result.newText === newText && result.key === key
  return { diff: result?.diff ?? null, pending: !current }
}

export { useTextDiff }
export type { TextDiffInput }
