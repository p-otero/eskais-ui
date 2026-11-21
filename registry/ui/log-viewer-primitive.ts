import { createChange, definePrimitive, dispatch, type ChangeDetails, type ChangeOptions } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"
import { createLogIndex, type LogIndexChange } from "@/components/ui/log-viewer-index"
import { createLogScroller } from "@/components/ui/log-viewer-scroller"
import { isErrorLevel, type LogLine, type LogStore } from "@/components/ui/log-viewer-store"

type LogViewerChangeReason = "toggle-press" | "input-change" | "imperative"

type LogViewerAnnouncements = {
  /** Read after new errors arrive, at most once per `announceDelay`. */
  newErrors: (errors: number) => string
  /** Read after new lines arrive, with `announce="lines"`. */
  newLines: (lines: number, errors: number) => string
}

type LogViewerOptions = {
  store?: LogStore
  /** Which lines are errors: a pattern their text matches, or a test. Lines with an `error` or `fatal` level always are. */
  isError?: RegExp | ((line: LogLine) => boolean)
  hiddenSources?: readonly string[]
  defaultHiddenSources?: readonly string[]
  onHiddenSourcesChange?: (hidden: string[], details: ChangeDetails<LogViewerChangeReason>) => void
  query?: string
  defaultQuery?: string
  onQueryChange?: (query: string, details: ChangeDetails<LogViewerChangeReason>) => void
  wrap?: boolean
  defaultWrap?: boolean
  onWrapChange?: (wrap: boolean, details: ChangeDetails<LogViewerChangeReason>) => void
  /** The sources the filter offers before they write, in order; others join as they appear. */
  sources?: readonly string[]
  /** How a line reads when copied, or read by agents. */
  format?: (line: LogLine) => string
  onCopy?: (text: string, details: ChangeDetails<"copy">) => void
  /** What screen readers hear as lines arrive: new errors (default), a count of new lines, or nothing. */
  announce?: "errors" | "lines" | "off"
  /** The least time between two announcements, in ms. @defaultValue 5000 */
  announceDelay?: number
  announcements?: Partial<LogViewerAnnouncements>
}

const defaultAnnouncements: LogViewerAnnouncements = {
  newErrors: (errors) => (errors === 1 ? "1 new error" : `${String(errors)} new errors`),
  newLines: (lines, errors) =>
    `${String(lines)} new ${lines === 1 ? "line" : "lines"}${errors > 0 ? `, ${String(errors)} ${errors === 1 ? "error" : "errors"}` : ""}`,
}

const COPIED_FOR = 2000

function formatLine(line: LogLine) {
  return line.source === undefined ? line.text : `[${line.source}] ${line.text}`
}

function errorTest(isError: LogViewerOptions["isError"]) {
  if (isError instanceof RegExp) {
    const pattern = new RegExp(isError.source, isError.flags.replace("g", "").replace("y", ""))
    return (line: LogLine) => isErrorLevel(line) || pattern.test(line.text)
  }
  if (typeof isError === "function") return (line: LogLine) => isErrorLevel(line) || isError(line)
  return isErrorLevel
}

function reasonOf(options: unknown): { reason: LogViewerChangeReason; event?: Event } {
  if (typeof options !== "object" || options === null) return { reason: "imperative" }
  const { reason = "imperative", event } = options as ChangeOptions<LogViewerChangeReason>
  return { reason, event: event instanceof Event ? event : undefined }
}

// The agent bridge passes arguments unchecked: one source, a list of them, or nothing for all.
function sourceList(sources: unknown): string[] | undefined {
  if (sources === undefined || sources === null || sources === "") return undefined
  if (typeof sources === "string") return [sources]
  if (Array.isArray(sources) && sources.every((source) => typeof source === "string")) return sources as string[]
  throw new TypeError(`filter takes a source or a list of sources, not ${JSON.stringify(sources)}.`)
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])

type RootState = {
  count: number
  errors: number
  following: boolean
  newBelow: number
  wrap: boolean
  copied: boolean
  sources: string[]
  hiddenSources: string[]
  query: string
  announcement: string
  currentError: number | null
}

const logViewer = definePrimitive({
  name: "log-viewer",
  options: {
    store: "value",
    isError: "value",
    hiddenSources: "value",
    defaultHiddenSources: "value",
    onHiddenSourcesChange: "callback",
    query: "value",
    defaultQuery: "value",
    onQueryChange: "callback",
    wrap: "value",
    defaultWrap: "value",
    onWrapChange: "callback",
    sources: "value",
    format: "value",
    onCopy: "callback",
    announce: "string",
    announceDelay: "number",
    announcements: "value",
  },
  state: (options: LogViewerOptions): RootState => ({
    hiddenSources: [...(options.hiddenSources ?? options.defaultHiddenSources ?? [])],
    query: options.query ?? options.defaultQuery ?? "",
    wrap: options.wrap ?? options.defaultWrap ?? false,
    sources: [...(options.sources ?? [])],
    count: 0,
    errors: 0,
    following: true,
    newBelow: 0,
    currentError: null,
    copied: false,
    announcement: "",
  }),
  sync: (options) => ({
    ...(options.hiddenSources === undefined ? {} : { hiddenSources: [...options.hiddenSources] }),
    ...(options.query === undefined ? {} : { query: options.query }),
    ...(options.wrap === undefined ? {} : { wrap: options.wrap }),
  }),
  controlled: ["hiddenSources", "query", "wrap"],
  api: (context) => {
    const { store: state } = context
    const change = createChange(context)
    let index = createLogIndex(errorTest(context.options().isError))
    let copiedTimer: ReturnType<typeof setTimeout> | undefined
    let announceTimer: ReturnType<typeof setTimeout> | undefined
    let pending = { lines: 0, errors: 0 }

    const setFollowing = (following: boolean) => {
      if (state.get().following === following) return
      state.set(following ? { following, newBelow: 0 } : { following })
    }

    const scroller = createLogScroller({
      count: () => index.count,
      key: (position) => String(index.idAt(position)),
      keep: () => {
        const current = state.get().currentError
        const position = current === null ? -1 : index.indexOf(current)
        return position === -1 ? [] : [position]
      },
      following: () => state.get().following,
      setFollowing,
      onKeyDown: (event) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
        if (event.key === "End") {
          event.preventDefault()
          jumpToEnd()
        } else if (event.key === "F8") {
          event.preventDefault()
          goToError(event.shiftKey ? -1 : 1, event.shiftKey ? "previousError" : "nextError", event)
        } else if (!event.shiftKey && scroller.scrollByKey(event.key)) event.preventDefault()
      },
    })
    const { virtual } = scroller

    const logStore = () => context.options().store
    const knownSources = () => {
      const listed = context.options().sources ?? []
      const seen = index.sources().filter((source) => !listed.includes(source))
      return seen.length === 0 ? [...listed] : [...listed, ...seen]
    }

    const announce = () => {
      announceTimer = undefined
      const { lines, errors } = pending
      pending = { lines: 0, errors: 0 }
      const mode = context.options().announce ?? "errors"
      const texts = { ...defaultAnnouncements, ...context.options().announcements }
      const message =
        mode === "lines" && lines > 0 ? texts.newLines(lines, errors) : errors > 0 ? texts.newErrors(errors) : ""
      if (message) state.set({ announcement: message })
    }

    const queueAnnouncement = (lines: number, errors: number) => {
      const mode = context.options().announce ?? "errors"
      if (mode === "off") return
      pending = { lines: pending.lines + lines, errors: pending.errors + errors }
      if (announceTimer !== undefined || (pending.errors === 0 && mode !== "lines")) return
      announceTimer = setTimeout(announce, context.options().announceDelay ?? 5000)
    }

    const run = (update: () => LogIndexChange) => {
      const errorsBefore = index.errorCount
      const average = index.count > 0 ? virtual.size() / index.count : scroller.rowHeight()
      const { following, newBelow, currentError } = state.get()
      const indexChange = update()
      scroller.refresh(indexChange.rebuilt ? 0 : indexChange.removed, average)
      if (!indexChange.rebuilt) queueAnnouncement(indexChange.added, Math.max(0, index.errorCount - errorsBefore))
      const known = knownSources()
      state.set({
        count: index.count,
        errors: index.errorCount,
        newBelow: following || indexChange.rebuilt ? 0 : newBelow + indexChange.added,
        ...(sameList(known, state.get().sources) ? {} : { sources: known }),
        ...(currentError !== null && index.indexOf(currentError) === -1 ? { currentError: null } : {}),
      })
    }

    const sync = () => {
      const current = logStore()
      if (current) run(() => index.sync(current))
    }

    const refilter = () => {
      const current = logStore()
      if (!current) return
      const { hiddenSources, query } = state.get()
      run(() => index.setFilter(current, { hidden: new Set(hiddenSources), query }))
    }

    let subscribed = logStore()
    let unsubscribe = subscribed?.subscribe(sync)
    refilter()

    let { hiddenSources, query, wrap } = state.get()
    context.onDestroy(
      state.subscribe(() => {
        const next = state.get()
        if (next.wrap !== wrap) {
          wrap = next.wrap
          scroller.resize()
        }
        if (next.hiddenSources === hiddenSources && next.query === query) return
        hiddenSources = next.hiddenSources
        query = next.query
        refilter()
      }),
    )
    let isError = context.options().isError
    context.onOptions((options) => {
      const storeChanged = options.store !== subscribed
      const testChanged = options.isError !== isError
      if (!storeChanged && !testChanged) return
      if (storeChanged) {
        unsubscribe?.()
        subscribed = options.store
        unsubscribe = subscribed?.subscribe(sync)
      }
      if (testChanged) {
        isError = options.isError
        index = createLogIndex(errorTest(isError))
      }
      refilter()
    })
    context.onDestroy(() => {
      unsubscribe?.()
      clearTimeout(copiedTimer)
      clearTimeout(announceTimer)
    })

    function jumpToEnd() {
      state.set({ following: true, newBelow: 0, currentError: null })
      scroller.toEnd()
      return true
    }

    function goToError(direction: 1 | -1, action: string, event?: Event) {
      const call = { reason: event ? "press" : "imperative", event }
      if (index.errorCount === 0) return unavailable(action, "has no errors to go to", call)
      const current = state.get().currentError
      const currentIndex = current === null ? -1 : index.indexOf(current)
      const view = scroller.inView()
      const from = currentIndex !== -1 ? currentIndex : direction === 1 ? view.first - 1 : view.last + 1
      const target = index.error(from, direction)
      if (target === -1) {
        const why = direction === 1 ? "has no error after this one" : "has no error before this one"
        return unavailable(action, why, call)
      }
      setFollowing(false)
      state.set({ currentError: index.idAt(target) ?? null })
      scroller.reveal(target)
      return true
    }

    const shownLines = (read: (line: LogLine) => void) => {
      const current = logStore()
      current?.flush()
      for (let position = 0; position < index.count; position++) {
        const line = current?.get(index.idAt(position)!)
        if (line) read(line)
      }
    }

    const setHiddenSources = (hidden: readonly string[], options?: ChangeOptions<LogViewerChangeReason>) => {
      const call = reasonOf(options)
      const next = [...hidden]
      if (sameList(next, state.get().hiddenSources)) return true
      return settled(change("hiddenSources", next, call), "filter", call)
    }

    const text = () => {
      const format = context.options().format ?? formatLine
      const lines: string[] = []
      shownLines((line) => lines.push(format(line)))
      return lines.join("\n")
    }

    return {
      virtual,
      /** Every source the filter offers, as one array that changes only when a source joins. */
      sources: () => state.get().sources,
      /** Calls `listener` on every state change; read `sources()` to see whether they changed. */
      subscribe: (listener: () => void) => state.subscribe(listener),
      /** The line with this id, while the store keeps it. */
      line: (id: number) => logStore()?.get(id),
      isError: (line: LogLine) => index.isError(line),
      /** Follows the scroller, from the log part's element. */
      connect(el: HTMLElement) {
        const disconnect = scroller.connect(el)
        sync()
        if (state.get().following) scroller.toEnd()
        return disconnect
      },
      bindRows: scroller.bindRows,
      measureRow: scroller.measureRow,
      /** Measures a rendered row while lines wrap, when their heights differ. */
      measure: (position: number, el: HTMLElement | null) => virtual.measure(position, el),
      /** Scrolls to the newest line and follows new ones again. */
      jumpToEnd,
      /** Shows only these sources, by name; nothing, or an empty list, shows every source. */
      filter(sources?: unknown, options?: ChangeOptions<LogViewerChangeReason>) {
        const shown = sourceList(sources)
        const known = state.get().sources
        const unknown = shown?.filter((source) => !known.includes(source)) ?? []
        if (unknown.length > 0) {
          const names = unknown.map((source) => JSON.stringify(source)).join(", ")
          throw new RangeError(`No source ${names}. Sources: ${known.join(", ") || "none yet"}.`)
        }
        const hidden =
          shown === undefined || shown.length === 0 ? [] : known.filter((source) => !shown.includes(source))
        return setHiddenSources(hidden, options)
      },
      /** Leaves these sources out. */
      setHiddenSources,
      /** Shows only the lines that contain this text, in any case; an empty one shows every line. */
      search(needle?: unknown, options?: ChangeOptions<LogViewerChangeReason>) {
        const call = reasonOf(options)
        const next = needle === undefined || needle === null ? "" : String(needle)
        if (next === state.get().query) return true
        return settled(change("query", next, call), "search", call)
      },
      setWrap(next: unknown, options?: ChangeOptions<LogViewerChangeReason>) {
        const call = reasonOf(options)
        const value = next === true || next === "true"
        if (value === state.get().wrap) return true
        return settled(change("wrap", value, call), "setWrap", call)
      },
      nextError: (event?: Event) => goToError(1, "nextError", event),
      previousError: (event?: Event) => goToError(-1, "previousError", event),
      /**
       * Writes the selected text to the clipboard, or every shown line (what the filter and search leave) as
       * plain text, one per line. Where the page has no clipboard access, a press gets false.
       */
      copy(event?: Event) {
        const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
        if (!clipboard) return unavailable("copy", "isn't available: the page has no clipboard access", { event })
        const copied = scroller.selectedText() ?? text()
        return clipboard.writeText(copied).then(
          () => {
            clearTimeout(copiedTimer)
            state.set({ copied: true })
            copiedTimer = setTimeout(() => state.set({ copied: false }), COPIED_FOR)
            dispatch(context, "onCopy", copied, { reason: "copy", event })
            return true
          },
          () => unavailable("copy", "was blocked by the browser", { event }),
        )
      },
      /** Every shown line, as `format` writes it, one per line. */
      text,
      /** The shown lines as agents read them: `value` is the line's id, `label` its text. */
      items() {
        const format = context.options().format ?? formatLine
        const items: { value: string; label: string }[] = []
        shownLines((line) => items.push({ value: String(line.id), label: format(line) }))
        return items
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, RootState>({
      role: "group",
      state: (state) => ({ ...state }),
      attrs: (state) => ({
        "data-following": state.following ? "" : undefined,
        "data-wrap": state.wrap ? "" : undefined,
        "data-copied": state.copied ? "" : undefined,
      }),
    }),
    // The log scrolls, so it takes focus for keyboard scrolling. Its rows come and go as it scrolls, which a live
    // region would read out: arrivals are announced through the status part instead, throttled.
    log: slot({
      role: "log",
      attrs: () => ({ tabindex: "0", "aria-live": "off" }),
      bind: (el, { api }) => api.connect(el),
    }),
    jump: slot<{}, { newBelow: number }>({
      role: "button",
      focus: "native",
      present: (state) => !state.following,
      state: (state) => ({ newBelow: state.newBelow }),
      attrs: (state) => ({ type: "button", "data-count": String(state.newBelow) }),
      press: ({ api, el }) => {
        const hadFocus = el !== undefined && el.ownerDocument.activeElement === el
        api.jumpToEnd()
        // The button leaves once following resumes, so focus moves to the log rather than falling to the page.
        if (hadFocus) {
          const log = el.closest('[data-slot="log-viewer"]')?.querySelector<HTMLElement>('[role="log"]')
          log?.focus({ preventScroll: true })
        }
      },
    }),
    status: slot({
      role: "status",
      attrs: () => ({ "aria-live": "polite", "aria-atomic": "true" }),
    }),
  }),
  agent: {
    actions: ["filter", "search", "jumpToEnd", "nextError", "previousError", "copy", "setWrap"],
    items: (api) => api.items(),
  },
})

export { defaultAnnouncements as logViewerAnnouncements, formatLine, logViewer }
export type { LogViewerAnnouncements, LogViewerChangeReason, LogViewerOptions }
