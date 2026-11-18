import type { createAgent } from "@ui-sdk/react/agent"
import { createHistory, describeEntry, type HistoryEntry } from "@ui-sdk/react/history"
import { observe } from "@ui-sdk/react/observe"

// UI SDK marks its history helpers experimental, so nothing of theirs leaks into this module's types: an app depends
// on ActivityLog and ActivityEntry only, and a change upstream stays inside this file.

type Agent = ReturnType<typeof createAgent>

/** Who made a change: an agent, a person (keyboard, pointer, touch), or the app's own code. */
type ActivityActor = "agent" | "person" | "app"

type ActivityEntry = {
  id: string
  actor: ActivityActor
  /** UI SDK's source, like `"agent"`, `"keyboard"` or `"programmatic"`; `"record"` for one the app recorded. */
  source: string
  /** The control's accessible name, or the label the app recorded. */
  label: string
  /** A sentence for the list, like "Agent set Status to Done". */
  description: string
  /** When it was recorded, in ms since the epoch. */
  at: number
  /** Text on the control's row, like the title of the task whose status changed. */
  row?: string
  value?: unknown
  previous?: unknown
  /** Undone on its own by `undoActor`, and skipped when seeking. */
  reverted: boolean
  /** A password, card or one-time-code value: it reads `"[redacted]"` and is never put back. */
  redacted: boolean
}

/** A change the app records itself, like a task the agent moved, with how to take it back and do it again. */
type ActivityRecord = {
  label: string
  description: string
  actor?: ActivityActor
  value?: unknown
  previous?: unknown
  undo: () => unknown
  redo: () => unknown
}

/** A change a seek or an undo couldn't put back: refused, gone from the page, redacted, or a record that threw. */
type ActivityNotRestored = { id?: string; label: string; value?: unknown }

type ActivityLogSnapshot = { entries: readonly ActivityEntry[]; position: number; busy: boolean }

type ActivityLogOptions = {
  /** Records only controls inside this element, like one panel. Defaults to the whole page. */
  within?: Element | (() => Element | null | undefined)
  /** State keys worth an entry. @defaultValue ["value", "checked", "pressed"] */
  keys?: string[]
  /** Writes each control change's sentence, in the page's language; UI SDK's English one by default. */
  describe?: (change: { actor: ActivityActor; label: string; value: unknown; previous: unknown }) => string
  /** The clock, for tests. */
  now?: () => number
}

type ActivityLog = {
  /** The entries and the position, as one object that changes only when they do. */
  getSnapshot: () => ActivityLogSnapshot
  subscribe: (listener: () => void) => () => void
  /** Records a change of the app's own, after its controls' ones. */
  record: (change: ActivityRecord) => string
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => Promise<ActivityNotRestored[]>
  redo: () => Promise<ActivityNotRestored[]>
  /** Puts the page back to how it was after `position` entries, or forward again. */
  seek: (position: number) => Promise<ActivityNotRestored[]>
  /** Takes back every applied change one actor made, like the agent's, and keeps the rest. */
  undoActor: (actor: ActivityActor) => Promise<ActivityNotRestored[]>
  /** Forgets every entry and keeps the page as it is. */
  clear: () => void
  /** Stops recording. */
  destroy: () => void
}

type Item =
  | { kind: "control"; id: string; at: number }
  | { kind: "record"; id: string; at: number; change: ActivityRecord; reverted: boolean }

// Restoring runs one step at a time, in order: each step starts from the page the previous one left.
function inOrder<T>(list: readonly T[], run: (item: T) => Promise<ActivityNotRestored[]>) {
  return list.reduce<Promise<ActivityNotRestored[]>>(
    async (done, item) => [...(await done), ...(await run(item))],
    Promise.resolve([]),
  )
}

const personSources = ["keyboard", "mouse", "touch", "pen", "virtual"]

/** The actor behind a UI SDK source, like a change callback's `details.source`. */
function actorOf(source: string | undefined): ActivityActor {
  if (source === "agent") return "agent"
  if (source === "programmatic" || source === undefined) return "app"
  return "person"
}

function sourcesOf(actor: ActivityActor) {
  if (actor === "agent") return ["agent"]
  if (actor === "app") return ["programmatic"]
  return personSources
}

/**
 * Records changes to the page's UI SDK controls, from people and agents, and the app's own `record`s, and steps
 * back and forward through them. Create it once, in the browser, before the controls you want recorded render,
 * with the app's agent bridge: restoring goes through it, so its permissions and change callbacks still apply.
 */
function createActivityLog(agent: Agent, options: ActivityLogOptions = {}): ActivityLog {
  const now = options.now ?? Date.now
  const rows = new Map<string, string | undefined>()
  // Registered before the history, so a change's row is known when the history reports it.
  const stopObserving = observe(
    (change) => {
      rows.set(change.ref, change.row)
    },
    { within: options.within },
  )
  const history = createHistory(agent, { within: options.within, keys: options.keys })
  const listeners = new Set<() => void>()
  let items: Item[] = []
  let position = 0
  let busy = 0
  let snapshot: ActivityLogSnapshot = { entries: [], position: 0, busy: false }
  let counter = 0

  const describe = (entry: HistoryEntry) =>
    options.describe?.({
      actor: actorOf(entry.source),
      label: entry.label,
      value: entry.value,
      previous: entry.previous,
    }) ?? describeEntry(entry)

  const toEntry = (item: Item, byId: Map<string, HistoryEntry>): ActivityEntry | undefined => {
    if (item.kind === "record") {
      const { change } = item
      return {
        id: item.id,
        actor: change.actor ?? "person",
        source: "record",
        label: change.label,
        description: change.description,
        at: item.at,
        value: change.value,
        previous: change.previous,
        reverted: item.reverted,
        redacted: false,
      }
    }
    const entry = byId.get(item.id)
    if (!entry) return undefined
    return {
      id: entry.id,
      actor: actorOf(entry.source),
      source: entry.source,
      label: entry.label,
      description: describe(entry),
      at: item.at,
      row: rows.get(entry.ref),
      value: entry.value,
      previous: entry.previous,
      reverted: entry.reverted === true,
      redacted: entry.redacted === true,
    }
  }

  const emit = () => {
    const byId = new Map(history.entries().map((entry) => [entry.id, entry]))
    const entries = items.flatMap((item) => toEntry(item, byId) ?? [])
    snapshot = { entries, position, busy: busy > 0 }
    for (const listener of listeners) listener()
  }

  // A new change after stepping back drops the steps that were ahead, like undo in an editor.
  const append = (item: Item) => {
    items = [...items.slice(0, position), item]
    position = items.length
  }

  const stopHistory = history.subscribe(() => {
    const entries = history.entries()
    const ids = new Set(entries.map((entry) => entry.id))
    const known = new Set(items.map((item) => item.id))
    // The history forgets entries on clear() and drops the ones ahead of its position when a new change comes.
    const keep = (item: Item) => item.kind === "record" || ids.has(item.id)
    position = items.slice(0, position).filter(keep).length
    items = items.filter(keep)
    for (const entry of entries) if (!known.has(entry.id)) append({ kind: "control", id: entry.id, at: now() })
    emit()
  })

  const historyCount = (upTo: number) => items.slice(0, upTo).filter((item) => item.kind === "control").length

  const notRestored = (failed: { ref: string; key: string; value: unknown }[]) =>
    failed.map((step) => ({
      label: history.entries().find((entry) => entry.ref === step.ref && entry.key === step.key)?.label ?? step.ref,
      value: step.value,
    }))

  const runRecord = async (item: Extract<Item, { kind: "record" }>, direction: "undo" | "redo") => {
    try {
      await item.change[direction]()
      return []
    } catch {
      return [{ id: item.id, label: item.change.label, value: item.change.previous }]
    }
  }

  let turn: Promise<unknown> = Promise.resolve()
  const inTurn = <T>(run: () => Promise<T>) => {
    const next = turn.then(async () => {
      busy += 1
      emit()
      try {
        return await run()
      } finally {
        busy -= 1
        emit()
      }
    })
    turn = next.catch(() => {})
    return next
  }

  // Walks from the position to the target one item at a time. Control changes between records go back together in
  // one history seek; each record runs its own undo or redo, skipping those undoActor already took back.
  const seekTo = async (requested: number) => {
    const target = Math.max(0, Math.min(items.length, Math.round(requested)))
    const backward = target < position
    const order = backward
      ? items.slice(target, position).map((_, offset) => position - 1 - offset)
      : items.slice(position, target).map((_, offset) => position + offset)
    const failed = await inOrder(order, async (index) => {
      const item = items[index]
      if (item?.kind !== "record" || item.reverted) return []
      const controls = notRestored(await history.seek(historyCount(backward ? index + 1 : index)))
      return [...controls, ...(await runRecord(item, backward ? "undo" : "redo"))]
    })
    failed.push(...notRestored(await history.seek(historyCount(target))))
    position = target
    return failed
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    record(change) {
      counter += 1
      const id = `r${String(counter)}`
      append({ kind: "record", id, at: now(), change, reverted: false })
      emit()
      return id
    },
    canUndo: () => position > 0,
    canRedo: () => position < items.length,
    undo: () => inTurn(() => seekTo(position - 1)),
    redo: () => inTurn(() => seekTo(position + 1)),
    seek: (target) => inTurn(() => seekTo(target)),
    undoActor: (actor) =>
      inTurn(async () => {
        const controls = await inOrder(sourcesOf(actor), async (source) =>
          notRestored(await history.undoSource(source)),
        )
        const records = items
          .slice(0, position)
          .filter((item): item is Extract<Item, { kind: "record" }> => item.kind === "record")
          .filter((item) => !item.reverted && (item.change.actor ?? "person") === actor)
        const undone = await inOrder(records.toReversed(), async (item) => {
          const missed = await runRecord(item, "undo")
          if (missed.length === 0) item.reverted = true
          return missed
        })
        return [...controls, ...undone]
      }),
    clear() {
      history.clear()
      items = []
      position = 0
      emit()
    },
    destroy() {
      stopHistory()
      history.destroy()
      stopObserving()
      listeners.clear()
    },
  }
}

export { actorOf, createActivityLog }
export type {
  ActivityActor,
  ActivityEntry,
  ActivityLog,
  ActivityLogOptions,
  ActivityLogSnapshot,
  ActivityNotRestored,
  ActivityRecord,
}
