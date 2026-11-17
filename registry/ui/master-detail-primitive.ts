import { createChange, definePrimitive, type ChangeDetails, type ChangeOptions } from "@ui-sdk/core"

/**
 * Why the selection changed: `item-press` a row was opened, `focus-in` focus moved to another row while the detail
 * followed it, `close-press` Close or Back, `escape-key` Escape, `restore` the URL changed (Back, a deep link).
 */
type MasterDetailSelectReason = "item-press" | "focus-in" | "close-press" | "escape-key" | "restore" | "imperative"

type MasterDetailEntry = { id: string; label: string }

type MasterDetailOptions = {
  selectedId?: string | null
  defaultSelectedId?: string | null
  onSelectedIdChange?: (id: string | null, details: ChangeDetails<MasterDetailSelectReason>) => void
  /** The items `open` takes, for agents. Without them, `open` takes any id. */
  entries?: readonly MasterDetailEntry[]
}

function reasonOf(options: unknown): { reason: MasterDetailSelectReason; event?: Event } {
  if (typeof options !== "object" || options === null) return { reason: "imperative" }
  const { reason = "imperative", event } = options as ChangeOptions<MasterDetailSelectReason>
  return { reason, event: event instanceof Event ? event : undefined }
}

/** The selection of a list with a detail pane: `open(id)` shows an item's detail, `close()` goes back to the list. */
const masterDetail = definePrimitive({
  name: "master-detail",
  options: { selectedId: "value", defaultSelectedId: "value", onSelectedIdChange: "callback", entries: "value" },
  state: (options: MasterDetailOptions) => ({
    selectedId: options.selectedId !== undefined ? options.selectedId : (options.defaultSelectedId ?? null),
  }),
  sync: (options) => (options.selectedId === undefined ? {} : { selectedId: options.selectedId }),
  controlled: ["selectedId"],
  api: (context) => {
    const change = createChange(context)
    const entries = () => context.options().entries
    return {
      // The agent bridge passes arguments unchecked.
      open(id: unknown, options?: ChangeOptions<MasterDetailSelectReason>) {
        const known = entries()
        if (typeof id !== "string" || (known !== undefined && !known.some((entry) => entry.id === id))) {
          const ids = known?.map((entry) => entry.id).join(", ")
          throw new RangeError(`No item "${String(id)}".${ids ? ` Items: ${ids}.` : ""}`)
        }
        if (context.store.get().selectedId === id) return false
        return change("selectedId", id, reasonOf(options))
      },
      close(options?: ChangeOptions<MasterDetailSelectReason>) {
        if (context.store.get().selectedId === null) return false
        return change("selectedId", null, reasonOf(options))
      },
      items: () => (entries() ?? []).map((entry) => ({ value: entry.id, label: entry.label })),
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-has-selection": state.selectedId === null ? undefined : "" }),
    }),
  }),
  agent: { actions: ["open", "close"], items: (api) => api.items() },
})

export { masterDetail }
export type { MasterDetailEntry, MasterDetailOptions, MasterDetailSelectReason }
