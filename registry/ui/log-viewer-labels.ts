import { logViewerAnnouncements, type LogViewerAnnouncements } from "@/components/ui/log-viewer-primitive"

type LogViewerLabels = LogViewerAnnouncements & {
  /** The log's name when the viewer has no `label`. */
  log: string
  /** The source filter's name. */
  sources: string
  search: string
  clearSearch: string
  copy: string
  /** The copy button's name for two seconds after copying. */
  copied: string
  wrap: string
  nextError: string
  previousError: string
  /** Read beside the error count, for screen readers. */
  errors: (count: number) => string
  /** The button that resumes following, while the reader is scrolled up. */
  jumpToEnd: string
  /** Its count of lines that arrived below: "12 new". */
  newBelow: (count: number) => string
  /** Shown while the log has no lines. */
  empty: string
  /** Shown while the filter or search leaves no lines. */
  noMatches: string
}

const logViewerLabels: LogViewerLabels = {
  ...logViewerAnnouncements,
  log: "Log",
  sources: "Sources",
  search: "Search the log",
  clearSearch: "Clear search",
  copy: "Copy log",
  copied: "Copied",
  wrap: "Wrap lines",
  nextError: "Next error",
  previousError: "Previous error",
  errors: (count) => (count === 1 ? "1 error" : `${String(count)} errors`),
  jumpToEnd: "Jump to end",
  newBelow: (count) => `${String(count)} new`,
  empty: "No lines yet",
  noMatches: "No lines match",
}

export { logViewerLabels }
export type { LogViewerLabels }
