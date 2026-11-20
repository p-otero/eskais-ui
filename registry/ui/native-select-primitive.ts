import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import { settled } from "@/lib/action-refusal"

type NativeSelectChangeReason = "input-change" | "imperative"

type NativeSelectItem = { value: string; label: string }

type NativeSelectOptions = {
  /** Every choice, flat, for agents: the empty value is the placeholder or the clearable choice. */
  items?: NativeSelectItem[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null, details: ChangeDetails<NativeSelectChangeReason>) => void
}

// UI SDK ships no part for a native <select>, and agents see only UI SDK parts, so this one reports its value and
// choices to them and takes `setValue` like a Select does.
const nativeSelect = definePrimitive({
  name: "native-select",
  options: { items: "value", value: "value", defaultValue: "value", onValueChange: "callback" },
  controlled: ["value"],
  state: (options: NativeSelectOptions) => ({
    value: options.value ?? options.defaultValue ?? null,
    items: options.items ?? [],
  }),
  sync: (options) => ({ items: options.items ?? [], ...(options.value === undefined ? {} : { value: options.value }) }),
  api: (context) => {
    const change = createChange(context)
    return {
      // The agent bridge passes arguments unchecked; an unknown value is refused with the real ones by `closed`.
      setValue(value: unknown, event?: Event) {
        const next = value === "" || value === null || value === undefined ? null : String(value)
        const call = { reason: event ? "input-change" : "imperative", event } as const
        return settled(change("value", next, call), "setValue", call)
      },
    }
  },
  slots: (slot) => ({
    root: slot({
      on: {
        change: (event, { api, el, store }) => {
          api.setValue((event.target as HTMLSelectElement).value, event)
          // A refused or still-controlled change leaves the element showing the old value until state says otherwise.
          queueMicrotask(() => {
            const select = el as HTMLSelectElement
            const value = store.get().value ?? ""
            if (select.value !== value) select.value = value
          })
        },
      },
      bind: (el, part) => {
        const select = el as HTMLSelectElement
        const show = () => {
          const value = part.store.get().value ?? ""
          if (select.value !== value) select.value = value
        }
        show()
        return part.store.subscribe(show)
      },
    }),
  }),
  agent: { actions: ["setValue"], closed: true },
})

export { nativeSelect }
export type { NativeSelectChangeReason, NativeSelectItem, NativeSelectOptions }
