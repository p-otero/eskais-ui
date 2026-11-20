import type { LogLine, LogStore } from "@/components/ui/log-viewer-store"

/** Which lines show: sources left out, and text every shown line contains (any case). */
type LogFilter = { hidden: ReadonlySet<string>; query: string }

/** What a sync changed: lines that now show at the end, and shown lines that left the buffer from the start. */
type LogIndexChange = { added: number; removed: number; rebuilt: boolean }

/** Ascending ids read from `start`, so dropping the oldest moves a number instead of copying the array. */
function createIdList() {
  let ids: number[] = []
  let start = 0
  const lowerBound = (id: number) => {
    let low = start
    let high = ids.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if ((ids[mid] as number) < id) low = mid + 1
      else high = mid
    }
    return low
  }
  return {
    get length() {
      return ids.length - start
    },
    at: (index: number) => (index < 0 || start + index >= ids.length ? undefined : ids[start + index]),
    push: (id: number) => void ids.push(id),
    /** Drops the ids below `id`; returns how many. */
    dropBelow(id: number) {
      const from = start
      while (start < ids.length && (ids[start] as number) < id) start++
      if (start > 1024 && start * 2 > ids.length) {
        ids = ids.slice(start)
        start = 0
      }
      return start - from
    },
    /** The position of `id`, or of the first id above it. */
    lowerBound: (id: number) => lowerBound(id) - start,
    indexOf(id: number) {
      const index = lowerBound(id)
      return ids[index] === id ? index - start : -1
    },
    clear() {
      ids = []
      start = 0
    },
  }
}

/**
 * The lines a `LogViewer` shows, as ids into its store, kept up to date as lines arrive and leave: each sync
 * reads only the new lines, and only a filter change reads the whole buffer again.
 */
function createLogIndex(isError: (line: LogLine) => boolean) {
  const shown = createIdList()
  const errors = createIdList()
  const sources: string[] = []
  const known = new Set<string>()
  let synced = 0
  let generation = -1
  let filter: LogFilter = { hidden: new Set(), query: "" }
  let needle = ""

  const matches = (line: LogLine) =>
    (line.source === undefined || !filter.hidden.has(line.source)) &&
    (needle === "" || line.text.toLowerCase().includes(needle))

  const take = (line: LogLine) => {
    if (line.source !== undefined && !known.has(line.source)) {
      known.add(line.source)
      sources.push(line.source)
    }
    if (!matches(line)) return false
    shown.push(line.id)
    if (isError(line)) errors.push(line.id)
    return true
  }

  function rebuild(store: LogStore): LogIndexChange {
    shown.clear()
    errors.clear()
    const snapshot = store.getSnapshot()
    let added = 0
    for (let id = snapshot.firstId; id <= snapshot.lastId; id++) {
      const line = store.get(id)
      if (line && take(line)) added++
    }
    synced = snapshot.lastId
    generation = snapshot.generation
    return { added, removed: 0, rebuilt: true }
  }

  return {
    get count() {
      return shown.length
    },
    get errorCount() {
      return errors.length
    },
    /** Every source seen, in the order they first wrote. */
    sources: () => sources,
    idAt: (index: number) => shown.at(index),
    indexOf: (id: number) => shown.indexOf(id),
    filter: () => filter,
    setFilter(store: LogStore, next: LogFilter) {
      filter = next
      needle = next.query.trim().toLowerCase()
      return rebuild(store)
    },
    /** Reads what arrived and left since the last sync. */
    sync(store: LogStore): LogIndexChange {
      const snapshot = store.getSnapshot()
      if (snapshot.generation !== generation) return rebuild(store)
      const removed = shown.dropBelow(snapshot.firstId)
      errors.dropBelow(snapshot.firstId)
      let added = 0
      for (let id = Math.max(synced + 1, snapshot.firstId); id <= snapshot.lastId; id++) {
        const line = store.get(id)
        if (line && take(line)) added++
      }
      synced = snapshot.lastId
      return { added, removed, rebuilt: false }
    },
    /** The shown error after (`1`) or before (`-1`) the shown line at `index`, as an index, or -1. */
    error(index: number, direction: 1 | -1) {
      const id = shown.at(index)
      if (errors.length === 0) return -1
      const from = id === undefined ? (direction === 1 ? 0 : errors.length) : errors.lowerBound(id)
      const target =
        direction === 1 ? errors.at(id !== undefined && errors.at(from) === id ? from + 1 : from) : errors.at(from - 1)
      return target === undefined ? -1 : shown.indexOf(target)
    },
    isError,
  }
}

type LogIndex = ReturnType<typeof createLogIndex>

export { createLogIndex }
export type { LogFilter, LogIndex, LogIndexChange }
