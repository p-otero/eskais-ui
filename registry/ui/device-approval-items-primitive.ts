import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

import { settled, unavailable } from "@/lib/action-refusal"

type DeviceApprovalItemEntry = { value: string; label: string }

type DeviceApprovalItemsChangeReason = "press" | "imperative"

type ItemCall = { reason?: DeviceApprovalItemsChangeReason; event?: Event }

/** An item that can't be selected, with why. */
type DeviceApprovalUnselectable = { id: string; reason: string }

type DeviceApprovalItemsOptions = {
  /** Every item, by id and label, as agents read them. */
  items?: readonly DeviceApprovalItemEntry[]
  unselectable?: readonly DeviceApprovalUnselectable[]
  /** Why nothing can change now, like a decision already sent; `null` while the person can choose. */
  locked?: string | null
  selectedIds?: readonly string[]
  onSelectedIdsChange?: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => void
}

type DeviceApprovalItemsState = {
  selectedIds: readonly string[]
  /** The labels of the selected items, for agents. */
  selected: readonly string[]
}

type DeviceApprovalMarkersOptions = {
  items?: readonly DeviceApprovalItemEntry[]
  /** The ids of the items whose selection needs its own confirmation. */
  marked?: readonly string[]
  selectedIds?: readonly string[]
  locked?: string | null
  confirmedIds?: readonly string[]
  onConfirmedIdsChange?: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => void
}

type DeviceApprovalMarkersState = {
  confirmedIds: readonly string[]
  /** The labels of the confirmed items, for agents. */
  confirmed: readonly string[]
}

const labelsOf = (items: readonly DeviceApprovalItemEntry[] | undefined, ids: readonly string[]) =>
  (items ?? []).filter((item) => ids.includes(item.value)).map((item) => item.label)

function findItem(items: readonly DeviceApprovalItemEntry[] | undefined, idOrLabel: unknown) {
  if (typeof idOrLabel !== "string") return undefined
  const label = idOrLabel.toLocaleLowerCase()
  return (
    items?.find((item) => item.value === idOrLabel) ?? items?.find((item) => item.label.toLocaleLowerCase() === label)
  )
}

const toggled = (ids: readonly string[], id: string, checked: boolean) =>
  checked ? [...new Set([...ids, id])] : ids.filter((other) => other !== id)

function awaitingRender(shown: () => readonly string[]) {
  let pending: { shown: readonly string[]; next: readonly string[] } | null = null
  return {
    latest: () => {
      const current = shown()
      return pending !== null && pending.shown === current ? pending.next : current
    },
    asked: (next: readonly string[]) => {
      pending = { shown: shown(), next }
    },
  }
}

const deviceApprovalItems = definePrimitive({
  name: "device-approval-items",
  options: {
    items: "value",
    unselectable: "value",
    locked: "value",
    selectedIds: "list",
    onSelectedIdsChange: "callback",
  },
  state: (options: DeviceApprovalItemsOptions): DeviceApprovalItemsState => {
    const selectedIds = options.selectedIds ?? []
    return { selectedIds, selected: labelsOf(options.items, selectedIds) }
  },
  sync: (options) => {
    const selectedIds = options.selectedIds ?? []
    return { selectedIds, selected: labelsOf(options.items, selectedIds) }
  },
  controlled: ["selectedIds", "selected"],
  api: (context) => {
    const change = createChange(context)
    const selection = awaitingRender(() => context.store.get().selectedIds)
    return {
      /** Selects (`checked`, the default) or deselects an item by its id or its label, in any case. */
      select(idOrLabel: unknown, checked: unknown = true, call: ItemCall = {}) {
        if (typeof checked !== "boolean")
          return unavailable("select", "takes true to select and false to deselect", call)
        const { items, unselectable, locked } = context.options()
        const item = findItem(items, idOrLabel)
        if (!item) return unavailable("select", `has no item named ${JSON.stringify(idOrLabel)}`, call)
        if (locked) return unavailable("select", `isn't available: ${locked}`, call)
        const blocked = unselectable?.find((entry) => entry.id === item.value)
        if (blocked)
          return unavailable("select", `isn't available: ${item.label} can't be selected: ${blocked.reason}`, call)
        const current = selection.latest()
        if (current.includes(item.value) === checked) return true
        const details = { reason: call.reason ?? "imperative", event: call.event }
        const next = toggled(current, item.value, checked)
        const changed = change("selectedIds", next, details)
        if (changed !== false) selection.asked(next)
        return settled(changed, "select", details)
      },
      agentItems() {
        return context.options().items ?? []
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, DeviceApprovalItemsState>({
      state: (state) => ({ ...state }),
      attrs: () => ({ role: "group" }),
    }),
  }),
  agent: { actions: ["select"], items: (api) => api.agentItems() },
})

const deviceApprovalMarkers = definePrimitive({
  name: "device-approval-markers",
  options: {
    items: "value",
    marked: "value",
    selectedIds: "value",
    locked: "value",
    confirmedIds: "list",
    onConfirmedIdsChange: "callback",
  },
  state: (options: DeviceApprovalMarkersOptions): DeviceApprovalMarkersState => {
    const confirmedIds = options.confirmedIds ?? []
    return { confirmedIds, confirmed: labelsOf(options.items, confirmedIds) }
  },
  sync: (options) => {
    const confirmedIds = options.confirmedIds ?? []
    return { confirmedIds, confirmed: labelsOf(options.items, confirmedIds) }
  },
  controlled: ["confirmedIds", "confirmed"],
  api: (context) => {
    const change = createChange(context)
    const confirmation = awaitingRender(() => context.store.get().confirmedIds)
    return {
      /**
       * Ticks (`checked`, the default) or clears the confirmation of a selected, marked item, by its id or label. The
       * group carries `data-agent-confirm`, so an agent's step waits for a person.
       */
      confirmMarker(idOrLabel: unknown, checked: unknown = true, call: ItemCall = {}) {
        if (typeof checked !== "boolean") {
          return unavailable("confirmMarker", "takes true to confirm and false to clear the confirmation", call)
        }
        const { items, marked, selectedIds, locked } = context.options()
        const item = findItem(items, idOrLabel)
        if (!item) return unavailable("confirmMarker", `has no item named ${JSON.stringify(idOrLabel)}`, call)
        if (locked) return unavailable("confirmMarker", `isn't available: ${locked}`, call)
        if (!marked?.includes(item.value)) {
          return unavailable("confirmMarker", `isn't available: ${item.label} has nothing to confirm`, call)
        }
        if (!selectedIds?.includes(item.value)) {
          return unavailable("confirmMarker", `isn't available: ${item.label} isn't selected`, call)
        }
        const current = confirmation.latest()
        if (current.includes(item.value) === checked) return true
        const details = { reason: call.reason ?? "imperative", event: call.event }
        const next = toggled(current, item.value, checked)
        const changed = change("confirmedIds", next, details)
        if (changed !== false) confirmation.asked(next)
        return settled(changed, "confirmMarker", details)
      },
      agentItems() {
        const { items, marked } = context.options()
        return (items ?? []).filter((item) => marked?.includes(item.value))
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, DeviceApprovalMarkersState>({
      state: (state) => ({ ...state }),
      attrs: () => ({ role: "group" }),
    }),
  }),
  agent: { actions: ["confirmMarker"], items: (api) => api.agentItems() },
})

export { deviceApprovalItems, deviceApprovalMarkers }
export type {
  DeviceApprovalItemEntry,
  DeviceApprovalItemsChangeReason,
  DeviceApprovalItemsOptions,
  DeviceApprovalItemsState,
  DeviceApprovalMarkersOptions,
  DeviceApprovalMarkersState,
  DeviceApprovalUnselectable,
}
