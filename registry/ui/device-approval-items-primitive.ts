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

/** A marked item and its confirmations as agents name them: the text when it's a string, `null` otherwise. */
type DeviceApprovalMarkedItem = { id: string; confirmations: readonly (string | null)[] }

type DeviceApprovalMarkersOptions = {
  items?: readonly DeviceApprovalItemEntry[]
  /** The items whose selection needs its own confirmations, each ticked. */
  marked?: readonly DeviceApprovalMarkedItem[]
  selectedIds?: readonly string[]
  locked?: string | null
  /** The ticked confirmations, as `confirmationKey(id, index)`. */
  ticked?: readonly string[]
  onTickedChange?: (keys: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => void
}

type DeviceApprovalMarkersState = {
  ticked: readonly string[]
  /** The ids of the marked items with every confirmation ticked. */
  confirmedIds: readonly string[]
  /** Their labels, for agents. */
  confirmed: readonly string[]
  /** What the selected marked items still wait for, like "OpenAI key: Replace the existing key", for agents. */
  missing: readonly string[]
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

const confirmationKey = (id: string, index: number) => `${String(index)}:${id}`

const confirmationName = (text: string | null, index: number) => text ?? `confirmation ${String(index)}`

const everyTicked = (ticked: readonly string[], item: DeviceApprovalMarkedItem) =>
  item.confirmations.every((_, index) => ticked.includes(confirmationKey(item.id, index)))

function markersState(options: DeviceApprovalMarkersOptions, ticked: readonly string[]): DeviceApprovalMarkersState {
  const marked = options.marked ?? []
  const confirmedIds = marked.filter((item) => everyTicked(ticked, item)).map((item) => item.id)
  const missing = marked
    .filter((item) => options.selectedIds?.includes(item.id))
    .flatMap((item) => {
      const label = findItem(options.items, item.id)?.label ?? item.id
      return item.confirmations.flatMap((text, index) =>
        ticked.includes(confirmationKey(item.id, index)) ? [] : [`${label}: ${confirmationName(text, index)}`],
      )
    })
  return { ticked, confirmedIds, confirmed: labelsOf(options.items, confirmedIds), missing }
}

function confirmationIndex(
  marked: DeviceApprovalMarkedItem,
  label: string,
  confirmation: unknown,
): { index: number } | { why: string } {
  const count = marked.confirmations.length
  const range = `from 0 to ${String(count - 1)}`
  if (confirmation === undefined) {
    if (count === 1) return { index: 0 }
    return { why: `needs which confirmation of ${label}: it has ${String(count)}, by index ${range} or by its text` }
  }
  if (typeof confirmation === "number") {
    if (Number.isInteger(confirmation) && confirmation >= 0 && confirmation < count) return { index: confirmation }
    return { why: `has no confirmation ${String(confirmation)} for ${label}: its indexes run ${range}` }
  }
  if (typeof confirmation === "string") {
    const text = confirmation.toLocaleLowerCase()
    const index = marked.confirmations.findIndex((other) => other?.toLocaleLowerCase() === text)
    if (index >= 0) return { index }
    return { why: `has no confirmation ${JSON.stringify(confirmation)} for ${label}` }
  }
  return { why: "takes the confirmation's index or its text" }
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
    ticked: "list",
    onTickedChange: "callback",
  },
  state: (options: DeviceApprovalMarkersOptions): DeviceApprovalMarkersState =>
    markersState(options, options.ticked ?? []),
  sync: (options) => (options.ticked === undefined ? {} : markersState(options, options.ticked)),
  controlled: ["confirmedIds", "confirmed", "missing"],
  api: (context) => {
    const change = createChange(context)
    const ticking = awaitingRender(() => context.store.get().ticked)
    return {
      /**
       * Ticks (`checked`, the default) or clears one confirmation of a selected, marked item, by the item's id or
       * label. `confirmation` is its index in `marker.confirm` or its text, in any case; it can be left out when the
       * item has only one. The group carries `data-agent-confirm`, so an agent's step waits for a person.
       */
      confirmMarker(idOrLabel: unknown, checked: unknown = true, confirmation?: unknown, call: ItemCall = {}) {
        if (typeof checked !== "boolean") {
          return unavailable("confirmMarker", "takes true to confirm and false to clear the confirmation", call)
        }
        const { items, marked, selectedIds, locked } = context.options()
        const item = findItem(items, idOrLabel)
        if (!item) return unavailable("confirmMarker", `has no item named ${JSON.stringify(idOrLabel)}`, call)
        if (locked) return unavailable("confirmMarker", `isn't available: ${locked}`, call)
        const entry = marked?.find((candidate) => candidate.id === item.value)
        if (!entry) return unavailable("confirmMarker", `isn't available: ${item.label} has nothing to confirm`, call)
        if (!selectedIds?.includes(item.value)) {
          return unavailable("confirmMarker", `isn't available: ${item.label} isn't selected`, call)
        }
        const target = confirmationIndex(entry, item.label, confirmation)
        if ("why" in target) return unavailable("confirmMarker", target.why, call)
        const key = confirmationKey(item.value, target.index)
        const current = ticking.latest()
        if (current.includes(key) === checked) return true
        const details = { reason: call.reason ?? "imperative", event: call.event }
        const next = toggled(current, key, checked)
        const changed = change("ticked", next, details)
        if (changed !== false) {
          ticking.asked(next)
          if (context.options().ticked === undefined) context.store.set(markersState(context.options(), next))
        }
        return settled(changed, "confirmMarker", details)
      },
      agentItems() {
        const { items, marked } = context.options()
        return (items ?? []).filter((item) => marked?.some((entry) => entry.id === item.value))
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

export { confirmationKey, deviceApprovalItems, deviceApprovalMarkers }
export type {
  DeviceApprovalItemEntry,
  DeviceApprovalItemsChangeReason,
  DeviceApprovalItemsOptions,
  DeviceApprovalItemsState,
  DeviceApprovalMarkedItem,
  DeviceApprovalMarkersOptions,
  DeviceApprovalMarkersState,
  DeviceApprovalUnselectable,
}
