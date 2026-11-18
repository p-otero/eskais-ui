import { definePrimitive } from "@ui-sdk/core"

import type { ActivityLog } from "@/components/ui/activity-log-store"

type ActivityLogOptions = {
  log?: Pick<ActivityLog, "getSnapshot" | "subscribe" | "undo" | "redo" | "seek">
}

function stateOf(log: ActivityLogOptions["log"]) {
  const snapshot = log?.getSnapshot()
  return {
    /** How many entries are applied: the position agents read. */
    value: snapshot?.position ?? 0,
    count: snapshot?.entries.length ?? 0,
    busy: snapshot?.busy ?? false,
  }
}

// The agent bridge passes arguments unchecked, and names an entry by its label or its position as a string.
function positionOf(target: unknown, count: number) {
  const position = typeof target === "string" && target.trim() !== "" ? Number(target) : target
  if (typeof position !== "number" || !Number.isInteger(position) || position < 0 || position > count) {
    throw new RangeError(`No position ${JSON.stringify(target)}: seek takes a whole number from 0 to ${String(count)}.`)
  }
  return position
}

const activityLog = definePrimitive({
  name: "activity-log",
  options: { log: "value" },
  state: (options: ActivityLogOptions) => stateOf(options.log),
  api: (context) => {
    const log = () => context.options().log
    let unsubscribe = log()?.subscribe(() => context.store.set(stateOf(log())))
    let current = log()
    context.onOptions((options) => {
      if (options.log === current) return
      unsubscribe?.()
      current = options.log
      unsubscribe = current?.subscribe(() => context.store.set(stateOf(current)))
      context.store.set(stateOf(current))
    })
    context.onDestroy(() => unsubscribe?.())
    return {
      /** Takes back the newest applied entry. Resolves with the changes it couldn't put back. */
      undo: async () => (await log()?.undo()) ?? [],
      /** Applies the next entry again. */
      redo: async () => (await log()?.redo()) ?? [],
      /** Puts the page back to how it was after `position` entries (0 is the start), or forward again. */
      seek: async (position: unknown) => {
        const target = positionOf(position, context.store.get().count)
        return (await log()?.seek(target)) ?? []
      },
      /** The entries as items, oldest first: their value is the position that seeking to them restores. */
      items: () =>
        (log()?.getSnapshot().entries ?? []).map((entry, index) => ({
          value: String(index + 1),
          label: entry.description,
        })),
    }
  },
  slots: (slot) => ({
    root: slot<{}, { position: number; count: number; canUndo: boolean; canRedo: boolean; busy: boolean }>({
      role: "group",
      state: (state) => ({
        position: state.value,
        count: state.count,
        canUndo: state.value > 0,
        canRedo: state.value < state.count,
        busy: state.busy,
      }),
      attrs: (state) => ({ "aria-busy": state.busy ? "true" : undefined, "data-busy": state.busy ? "" : undefined }),
    }),
    entry: slot<{ value: string }, { state: "applied" | "current" | "undone" }>({
      role: "button",
      focus: "native",
      props: { value: "string" },
      state: (state, part) => ({ state: entryState(Number(part.key), state.value) }),
      attrs: (state, part) => ({
        type: "button",
        "aria-current": Number(part.key) === state.value ? "step" : undefined,
        "data-state": entryState(Number(part.key), state.value),
      }),
      press: ({ api, key }) => void api.seek(key),
    }),
  }),
  agent: { actions: ["undo", "redo", "seek"], items: (api) => api.items() },
})

function entryState(position: number, current: number) {
  if (position === current) return "current"
  return position > current ? "undone" : "applied"
}

export { activityLog }
export type { ActivityLogOptions as ActivityLogPrimitiveOptions }
