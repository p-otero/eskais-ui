import { definePrimitive } from "@ui-sdk/core"

import { unavailable } from "@/lib/action-refusal"

type ServerFiltersField = { value: string; label: string }

type ServerFiltersOptions = {
  /** The schema's fields, by key and label: what `filter` takes as its first argument. */
  fields?: readonly ServerFiltersField[]
  /** Sets one field from loose input; throws a `RangeError` that says what the field takes. */
  apply?: (field: unknown, value: unknown) => void
  clear?: () => void
}

// The agent bridge passes arguments unchecked; `apply` validates the field and the value against the schema.
const serverFilters = definePrimitive({
  name: "server-filters",
  options: { fields: "list", apply: "value", clear: "value" },
  state: (options: ServerFiltersOptions) => ({ count: options.fields?.length ?? 0 }),
  sync: (options) => ({ count: options.fields?.length ?? 0 }),
  api: (context) => ({
    filter(field: unknown, value?: unknown) {
      const apply = context.options().apply
      if (!apply) return unavailable("filter", "isn't offered: there is no apply")
      apply(field, value)
      return true
    },
    clearFilters() {
      const clear = context.options().clear
      if (!clear) return unavailable("clearFilters", "isn't offered: there is no clear")
      clear()
      return true
    },
    fields: () => context.options().fields ?? [],
  }),
  slots: (slot) => ({
    root: slot({ role: "group", attrs: (state) => ({ "data-count": String(state.count) }) }),
  }),
  agent: { actions: ["filter", "clearFilters"], items: (api) => api.fields() },
})

export { serverFilters }
export type { ServerFiltersField, ServerFiltersOptions }
