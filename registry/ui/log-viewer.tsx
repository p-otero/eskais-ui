"use client"

import { createParts, usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { useMemo, useSyncExternalStore, type ComponentProps, type ReactNode } from "react"
import { ArrowDownIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { logViewerLabels, type LogViewerLabels } from "@/components/ui/log-viewer-labels"
import { formatLine, logViewer, type LogViewerOptions } from "@/components/ui/log-viewer-primitive"
import { LogRows, sourceStyles, type LogSource } from "@/components/ui/log-viewer-rows"
import type { LogStore } from "@/components/ui/log-viewer-store"
import { LogViewerToolbar } from "@/components/ui/log-viewer-toolbar"
import { ScrollArea, ScrollAreaCorner, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { isOneOf, isRecord } from "@/lib/narrow"
import { tones } from "@/lib/tone"
import { cn, cssVars } from "@/lib/utils"

const textOrUndefined = (value: unknown) => (typeof value === "string" ? value : undefined)

/** The configured sources back from the JSON the styles' memo is keyed on, so a new array of the same ones is skipped. */
function parseSources(json: string): LogSource[] {
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isRecord).map((source) => ({
    id: String(source.id),
    label: textOrUndefined(source.label),
    color: textOrUndefined(source.color),
    tone: isOneOf(tones, source.tone) ? source.tone : undefined,
  }))
}

const Parts = createParts(logViewer, { root: "div", log: "div", jump: "button", status: "div" })

type LogViewerProps = Omit<ComponentProps<"div">, "children" | "onCopy"> &
  Omit<LogViewerOptions, "store" | "sources" | "announcements"> & {
    store: LogStore
    /** Names the log, for screen readers and agents. */
    label?: string
    /** The sources the filter offers, in order, with their names and colours; others join as they write. */
    sources?: readonly (string | LogSource)[]
    /** Shows each line's time, when it has one. */
    timestamps?: boolean
    /** Shows the search field. @defaultValue true */
    search?: boolean
    /** Shows the toolbar. Agents keep every action without it. @defaultValue true */
    toolbar?: boolean
    /** Content at the end of the toolbar, like a Clear or Restart button. */
    actions?: ReactNode
    locale?: string
    labels?: Partial<LogViewerLabels>
  }

/**
 * A live log: lines streamed into a `createLogStore()` render as they arrive, only those in view, with ANSI colours
 * mapped to the theme. It follows the end until the reader scrolls up, then offers a button with the count of new
 * lines; End or the button follows again. Lines can be filtered by source and searched, errors are marked and
 * stepped through (F8, Shift+F8), and Copy writes the shown lines as plain text.
 */
function LogViewer({
  store,
  label,
  sources: sourcesProp,
  isError,
  hiddenSources,
  defaultHiddenSources,
  onHiddenSourcesChange,
  query,
  defaultQuery,
  onQueryChange,
  wrap,
  defaultWrap,
  onWrapChange,
  format,
  onCopy,
  announce,
  announceDelay,
  timestamps = false,
  search = true,
  toolbar = true,
  actions,
  locale,
  labels: labelsProp,
  className,
  style,
  ...props
}: LogViewerProps) {
  const labels = { ...logViewerLabels, ...labelsProp }
  const configured = (sourcesProp ?? []).map((source) => (typeof source === "string" ? { id: source } : source))
  const handle = usePrimitive(logViewer, {
    store,
    isError,
    hiddenSources,
    defaultHiddenSources,
    onHiddenSourcesChange,
    query,
    defaultQuery,
    onQueryChange,
    wrap,
    defaultWrap,
    onWrapChange,
    sources: configured.map((source) => source.id),
    format,
    onCopy,
    announce,
    announceDelay,
    announcements: { newErrors: labels.newErrors, newLines: labels.newLines },
  })
  const { api } = handle
  // The source names and colours keep their identity between state changes, so the toolbar and the rows skip the
  // render a new line's count causes.
  const known = useSyncExternalStore(api.subscribe, api.sources, api.sources)
  const configuredKey = JSON.stringify(configured)
  const styles = useMemo(() => sourceStyles(known, parseSources(configuredKey)), [known, configuredKey])
  const widest = Math.max(0, ...[...styles.values()].map((source) => source.label.length))

  return usePart(
    handle,
    "root",
    {},
    {
      ...({ "data-slot": "log-viewer" } as Record<`data-${string}`, string>),
      "aria-label": label ?? labels.log,
      style,
      className: cn(
        "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-surface border bg-muted text-foreground",
        className,
      ),
      ...props,
      children: (root: {
        count: number
        errors: number
        wrap: boolean
        copied: boolean
        sources: string[]
        hiddenSources: string[]
        query: string
        announcement: string
        currentError: number | null
      }) => {
        return (
          <>
            {toolbar && (
              <LogViewerToolbar
                api={api}
                labels={labels}
                sources={root.sources}
                styles={styles}
                hidden={root.hiddenSources}
                query={root.query}
                wrap={root.wrap}
                copied={root.copied}
                errors={root.errors}
                search={search}
                actions={actions}
              />
            )}
            <ScrollArea
              style={cssVars({ "--log-source-width": `${String(widest + 2)}ch` })}
              className="flex min-h-0 flex-1 flex-col font-mono text-caption leading-relaxed"
            >
              <ScrollAreaViewport
                // Strict containment makes the viewport its own layout root: rows coming and going every frame lay out
                // only what is inside it, not the page.
                className="min-h-0 flex-1 overscroll-contain contain-strict"
                render={(viewport) => (
                  <Parts.Log {...viewport} aria-label={label ?? labels.log} data-slot="log-viewer-log" />
                )}
              >
                <LogRows
                  api={api}
                  sources={styles}
                  wrap={root.wrap}
                  timestamps={timestamps}
                  locale={locale}
                  query={root.query}
                  currentError={root.currentError}
                />
              </ScrollAreaViewport>
              {root.count === 0 && (
                <p
                  data-slot="log-viewer-empty"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center p-inset-surface text-body-sm text-muted-foreground"
                >
                  {store.getSnapshot().size === 0 ? labels.empty : labels.noMatches}
                </p>
              )}
              <span
                ref={api.measureRow}
                aria-hidden="true"
                data-slot="log-viewer-measure"
                className="pointer-events-none invisible absolute top-0 flex px-inset-item whitespace-pre"
              >
                0
              </span>
              <ScrollAreaScrollbar data-agent-hidden="" />
              <ScrollAreaScrollbar orientation="horizontal" data-agent-hidden="" />
              <ScrollAreaCorner />
              <div className="pointer-events-none absolute inset-x-0 bottom-group flex justify-center">
                <Parts.Jump
                  data-slot="log-viewer-jump"
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    "pointer-events-auto rounded-full border border-floating-border font-sans shadow-floating transition duration-micro ease-standard starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
                  )}
                >
                  {({ newBelow }) => (
                    <>
                      <ArrowDownIcon />
                      {labels.jumpToEnd}
                      {newBelow > 0 && (
                        <span className="rounded-full bg-background px-inset-chip text-caption tabular-nums">
                          {labels.newBelow(newBelow)}
                        </span>
                      )}
                    </>
                  )}
                </Parts.Jump>
              </div>
            </ScrollArea>
            <Parts.Status className="sr-only">{root.announcement}</Parts.Status>
          </>
        )
      },
    },
    "div",
  )
}

export { formatLine, LogViewer, logViewerLabels }
export type { LogSource, LogViewerLabels, LogViewerProps }
