import { hasAnsi, parseAnsi, type AnsiSpan, type AnsiStyle } from "@/lib/ansi"

/** How serious a line is. Any other string is kept and shown as is; `error` and `fatal` count as errors. */
type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

type LogLine = {
  /** Its place in the stream, from 1, never reused: lines keep their id when older ones leave the buffer. */
  id: number
  /** Which process or service wrote it, like `frontend`, `backend` or `db`. */
  source?: string
  level?: LogLevel | (string & {})
  /** When it was written, in ms since the epoch. */
  time?: number
  /** The text without escape sequences or control characters: what copy, search and agents read. */
  text: string
  /** Its styled runs, when it had SGR codes. */
  spans?: readonly AnsiSpan[]
}

/** A line to add: its raw text, which may hold ANSI escape codes, or the text with where it came from. */
type LogInput = string | { text: string; source?: string; level?: LogLine["level"]; time?: number | Date }

// Workaround: TypeScript's `Array.isArray` doesn't narrow a readonly array out of a union.
const isInputList = (input: LogInput | readonly LogInput[]): input is readonly LogInput[] => Array.isArray(input)

type LogWriteOptions = { source?: string; level?: LogLine["level"]; time?: number | Date }

type LogStoreSnapshot = {
  /** Changes on every notification, so it works as `useSyncExternalStore`'s snapshot. */
  version: number
  /** Changes when `clear()` empties the buffer. */
  generation: number
  /** The id of the oldest line in the buffer; `lastId + 1` while it's empty. */
  firstId: number
  /** The id of the newest line, 0 before any. */
  lastId: number
  size: number
  /** How many lines have left the buffer to keep it at `maxLines`, since the last `clear()`. */
  dropped: number
}

type LogStoreOptions = {
  /** The most lines kept; older ones leave as new ones arrive. @defaultValue 10000 */
  maxLines?: number
  /** Longer lines are cut to this many characters and end with "…". @defaultValue 10000 */
  maxLineLength?: number
  /**
   * Schedules a notification. By default one per animation frame, or one every few frames while listeners take
   * longer than half a frame. For tests and workers.
   */
  schedule?: (notify: () => void) => void
  /** The clock for lines without a time. Lines carry no time unless this or their input gives one. */
  now?: () => number
}

type LogStore = {
  /** Adds whole lines. Text with newlines becomes several lines. Listeners hear about it once per frame. */
  append: (input: LogInput | readonly LogInput[]) => void
  /**
   * Adds a chunk of a process's output as it arrives: whole lines are added, a partial last line waits for the
   * rest, and colours carry from one line to the next, per source, as in a terminal.
   */
  write: (chunk: string, options?: LogWriteOptions) => void
  /** Adds the partial line `write` holds for a source, like when its process exits. */
  end: (source?: string) => void
  /** Empties the buffer. */
  clear: () => void
  /** The line with this id, while it's in the buffer. */
  get: (id: number) => LogLine | undefined
  /** The lines in the buffer, oldest first, as a new array. */
  lines: () => LogLine[]
  getSnapshot: () => LogStoreSnapshot
  /** Called at most once per frame after lines arrive, and at once after `clear()`. */
  subscribe: (listener: () => void) => () => void
  /** Notifies now, with what arrived since the last notification. */
  flush: () => void
  readonly maxLines: number
}

type Pending = { text: string; style: AnsiStyle }

// Perf: slow listeners skip frames between notifications, so a flood of lines leaves scrolling and typing responsive.
const BUSY_FRAME_MS = 8
const MAX_SKIPPED_FRAMES = 3

function frames() {
  let skip = 0
  return {
    schedule(notify: () => void) {
      if (typeof requestAnimationFrame !== "function") {
        setTimeout(notify, 16 * (skip + 1))
        return
      }
      let left = skip
      const tick = () => {
        if (left-- > 0) requestAnimationFrame(tick)
        else notify()
      }
      requestAnimationFrame(tick)
    },
    took(ms: number) {
      skip = Math.min(MAX_SKIPPED_FRAMES, Math.floor(ms / BUSY_FRAME_MS))
    },
  }
}

const timeOf = (time: number | Date | undefined) => (time instanceof Date ? time.getTime() : time)

/**
 * A bounded buffer of log lines for `LogViewer`, fed from anywhere: a WebSocket, an EventSource, a child process's
 * output. Appending is cheap (no React work): the viewer reads what changed once per frame. Create it once, outside
 * render, and keep it for as long as the stream lives.
 */
function createLogStore(options: LogStoreOptions = {}): LogStore {
  const maxLines = Math.max(1, Math.floor(options.maxLines ?? 10_000))
  const maxLineLength = Math.max(1, Math.floor(options.maxLineLength ?? 10_000))
  const pace = frames()
  const schedule = options.schedule ?? pace.schedule
  const listeners = new Set<() => void>()
  // Perf: dropping old lines moves `head`; cutting the array once `head` passes `maxLines` copies each line at
  // most once more.
  let buffer: LogLine[] = []
  let head = 0
  let nextId = 1
  let generation = 0
  let dropped = 0
  let version = 0
  let scheduled = false
  let snapshot: LogStoreSnapshot = { version, generation, firstId: 1, lastId: 0, size: 0, dropped: 0 }
  const pending = new Map<string, Pending>()
  const carried = new Map<string, AnsiStyle>()

  const firstId = () => (head < buffer.length ? buffer[head]!.id : nextId)

  const notify = () => {
    scheduled = false
    version += 1
    snapshot = {
      version,
      generation,
      firstId: firstId(),
      lastId: nextId - 1,
      size: buffer.length - head,
      dropped,
    }
    const started = performance.now()
    for (const listener of listeners) listener()
    const recordTimeIncludingReactRender = () => pace.took(performance.now() - started)
    queueMicrotask(recordTimeIncludingReactRender)
  }

  const request = () => {
    if (scheduled) return
    scheduled = true
    schedule(() => {
      if (scheduled) notify()
    })
  }

  const push = (raw: string, meta: LogWriteOptions, style?: AnsiStyle) => {
    const cut = raw.length > maxLineLength ? `${raw.slice(0, maxLineLength)}…` : raw
    let text = cut
    let spans: readonly AnsiSpan[] | undefined
    let end = style
    if ((style && Object.keys(style).length > 0) || hasAnsi(cut)) {
      const parsed = parseAnsi(cut, style)
      text = parsed.text
      spans = parsed.spans
      end = parsed.style
    }
    const time = timeOf(meta.time) ?? options.now?.()
    const line: LogLine = { id: nextId, text }
    if (meta.source !== undefined) line.source = meta.source
    if (meta.level !== undefined) line.level = meta.level
    if (time !== undefined) line.time = time
    if (spans) line.spans = spans
    nextId += 1
    buffer.push(line)
    if (buffer.length - head > maxLines) {
      head += 1
      dropped += 1
      if (head >= maxLines) {
        buffer = buffer.slice(head)
        head = 0
      }
    }
    return end
  }

  const appendOne = (input: LogInput) => {
    const meta = typeof input === "string" ? {} : input
    const text = typeof input === "string" ? input : input.text
    if (!text.includes("\n")) {
      push(text, meta)
      return
    }
    for (const part of text.split("\n")) push(part, meta)
  }

  return {
    maxLines,
    append(input) {
      if (isInputList(input)) for (const item of input) appendOne(item)
      else appendOne(input)
      request()
    },
    write(chunk, meta = {}) {
      const key = meta.source ?? ""
      const held = pending.get(key)
      const parts = chunk.split("\n")
      const last = parts.pop() ?? ""
      let style = held?.style ?? carried.get(key) ?? {}
      if (parts.length === 0) {
        pending.set(key, { text: (held?.text ?? "") + last, style })
        return
      }
      parts[0] = (held?.text ?? "") + (parts[0] ?? "")
      for (const part of parts) style = push(part, meta, style) ?? {}
      carried.set(key, style)
      if (last === "") pending.delete(key)
      else pending.set(key, { text: last, style })
      request()
    },
    end(source) {
      const key = source ?? ""
      const held = pending.get(key)
      pending.delete(key)
      carried.delete(key)
      if (!held) return
      push(held.text, { source }, held.style)
      request()
    },
    clear() {
      buffer = []
      head = 0
      dropped = 0
      generation += 1
      pending.clear()
      carried.clear()
      notify()
    },
    get(id) {
      const index = head + id - firstId()
      return index >= head && index < buffer.length ? buffer[index] : undefined
    },
    lines: () => buffer.slice(head),
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    flush() {
      if (scheduled) notify()
    },
  }
}

const errorLevels = new Set(["error", "fatal"])

/** Whether a line's level marks it as an error. */
function isErrorLevel(line: LogLine) {
  return line.level !== undefined && errorLevels.has(line.level.toLowerCase())
}

export { createLogStore, isErrorLevel }
export type { LogInput, LogLevel, LogLine, LogStore, LogStoreOptions, LogStoreSnapshot, LogWriteOptions }
