"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { useId, useState, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { CheckboxRow } from "@/components/ui/checkbox-row"
import {
  confirmationKey,
  deviceApprovalItems,
  deviceApprovalMarkers,
  type DeviceApprovalItemsChangeReason,
  type DeviceApprovalItemsState,
  type DeviceApprovalMarkersState,
} from "@/components/ui/device-approval-items-primitive"

/** Something the person ticks to include, like a key to upload. */
type DeviceConsentItem = {
  id: string
  /** Names its checkbox; agents select it by this or by `id`, in any case. */
  label: string
  description?: ReactNode
  /** At the end of the row, like a SecretFingerprint. */
  detail?: ReactNode
  /** Keeps it from being selected; the reason shows under the label and describes the checkbox. */
  disabled?: { reason: string }
  marker?: DeviceConsentMarker
}

/**
 * For an item that replaces something that already exists: `label` shows as a warning badge, like "Replace", and
 * `confirm` labels a checkbox, like "Replace the existing key", that the person ticks once it's selected. A list gives
 * one checkbox per entry, each to be ticked; wrap a label made of several nodes in a fragment.
 */
type DeviceConsentMarker = { label: ReactNode; confirm: ReactNode | readonly ReactNode[] }

/** A selected marked item that still waits: `unticked` holds the indexes in `marker.confirm` not ticked yet. */
type DeviceConsentUnconfirmed = { id: string; label: string; unticked: number[] }

/** The consent items' visible text. None has a default: pass it in the page's language. */
type DeviceConsentText = {
  /** The heading over the items. */
  items?: ReactNode
  /** Why Approve waits while nothing is selected; shown beside the actions and read by an agent. */
  nothingSelected?: string
  /** Why Approve waits for marked items without every confirmation ticked, or a function of their labels. */
  unconfirmed?: string | ((labels: string[], unconfirmed: DeviceConsentUnconfirmed[]) => string)
}

/** Names for screen readers and agents; English by default. */
type DeviceConsentLabels = {
  /** Names the items' group when `text.items` gives no heading. */
  items: string
  /** Names the group of marker confirmations. */
  markers: string
  /** What a person approves when an agent ticks a marker's confirmation. */
  confirmMarkers: string
}

const deviceConsentLabels: DeviceConsentLabels = {
  items: "Items",
  markers: "Confirmations",
  confirmMarkers: "Confirms replacing something that already exists",
}

type ConsentSelection = {
  items?: readonly DeviceConsentItem[]
  selected?: readonly string[]
  defaultSelected?: readonly string[]
  onSelectedChange?: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => void
}

const noIds: readonly string[] = []

const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id))

const confirmationsOf = (item: DeviceConsentItem): readonly ReactNode[] => {
  const confirm = item.marker?.confirm
  if (confirm === undefined) return []
  return Array.isArray(confirm) ? confirm : [confirm]
}

const keysOf = (item: DeviceConsentItem) => confirmationsOf(item).map((_, index) => confirmationKey(item.id, index))

const agentText = (node: ReactNode) =>
  typeof node === "string" ? node : typeof node === "number" ? String(node) : null

/** The selected ids, and the ticked confirmations that belong to them: an item that leaves the selection loses them. */
function useConsentItems({ items, selected, defaultSelected, onSelectedChange }: ConsentSelection) {
  const [ownSelected, setOwnSelected] = useState(defaultSelected ?? noIds)
  const selectedIds = (selected ?? ownSelected).filter((id) => items?.some((item) => item.id === id) ?? false)
  const [confirmation, setConfirmation] = useState({ selectedIds, ticked: noIds })
  let ticked = confirmation.ticked
  if (!sameIds(confirmation.selectedIds, selectedIds)) {
    const kept = (items ?? []).filter((item) => selectedIds.includes(item.id)).flatMap(keysOf)
    ticked = ticked.filter((key) => kept.includes(key))
    setConfirmation({ selectedIds, ticked })
  }
  const confirmedIds = (items ?? [])
    .filter((item) => item.marker && selectedIds.includes(item.id) && keysOf(item).every((key) => ticked.includes(key)))
    .map((item) => item.id)
  return {
    selectedIds,
    ticked,
    confirmedIds,
    select: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => {
      onSelectedChange?.(ids, details)
      if (!details.canceled && selected === undefined) setOwnSelected(ids)
    },
    tick: (keys: string[]) => setConfirmation({ selectedIds, ticked: keys }),
  }
}

type Waiting = { item: DeviceConsentItem; unticked: number[] }

function missingConfirmations({ item, unticked }: Waiting) {
  const confirmations = confirmationsOf(item)
  if (confirmations.length === 1) return null
  const names = unticked.map((index) =>
    JSON.stringify(agentText(confirmations[index]) ?? `confirmation ${String(index)}`),
  )
  const more = unticked.length === 1 ? "1 more confirmation" : `${String(unticked.length)} more confirmations`
  return `${item.label} needs ${more} ticked: ${names.join(", ")}`
}

function unconfirmedReason(waiting: readonly Waiting[]) {
  const single = waiting.filter((entry) => missingConfirmations(entry) === null).map((entry) => entry.item.label)
  const several = waiting.flatMap((entry) => missingConfirmations(entry) ?? [])
  const singleReason = single.length === 0 ? [] : [`${single.join(", ")} needs its confirmation ticked`]
  return [...singleReason, ...several].join("; ")
}

/** Why the items keep Approve off: `reason` for an agent, `shown` when the page gave the words. */
function consentBlocked(
  items: readonly DeviceConsentItem[] | undefined,
  selectedIds: readonly string[],
  ticked: readonly string[],
  text: DeviceConsentText,
): { reason: string; shown?: string } | null {
  if (items === undefined) return null
  if (selectedIds.length === 0)
    return { reason: text.nothingSelected ?? "nothing is selected", shown: text.nothingSelected }
  const waiting = items.flatMap((item): Waiting[] => {
    if (!selectedIds.includes(item.id)) return []
    const unticked = keysOf(item).flatMap((key, index) => (ticked.includes(key) ? [] : [index]))
    return unticked.length === 0 ? [] : [{ item, unticked }]
  })
  if (waiting.length === 0) return null
  const unconfirmed = waiting.map(({ item, unticked }) => ({ id: item.id, label: item.label, unticked }))
  const shown =
    typeof text.unconfirmed === "function"
      ? text.unconfirmed(
          unconfirmed.map((entry) => entry.label),
          unconfirmed,
        )
      : text.unconfirmed
  return { reason: shown ?? unconfirmedReason(waiting), shown }
}

type ConsentItemsProps = {
  items: readonly DeviceConsentItem[]
  selectedIds: readonly string[]
  ticked: readonly string[]
  onSelectedIdsChange: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => void
  onTickedChange: (keys: string[]) => void
  /** Why nothing can change now, like a decision already sent. */
  locked: string | null
  heading?: ReactNode
  labels: DeviceConsentLabels
}

const itemsAttributes: Record<`data-${string}`, string> = { "data-slot": "device-approval-items" }

const markersAttributes = (agentConfirm: string): Record<`data-${string}`, string> => ({
  "data-slot": "device-approval-markers",
  "data-agent-confirm": agentConfirm,
})

function MarkerConfirmations({
  items,
  selectedIds,
  ticked,
  onTickedChange,
  locked,
  labels,
}: Omit<ConsentItemsProps, "onSelectedIdsChange" | "heading">) {
  const marked = items.filter((item) => confirmationsOf(item).length > 0)
  const handle = usePrimitive(deviceApprovalMarkers, {
    items: items.map((item) => ({ value: item.id, label: item.label })),
    marked: marked.map((item) => ({ id: item.id, confirmations: confirmationsOf(item).map(agentText) })),
    selectedIds,
    locked,
    ticked,
    onTickedChange: (keys) => onTickedChange(keys),
  })
  return usePart(
    handle,
    "root",
    {},
    {
      ...markersAttributes(labels.confirmMarkers),
      "aria-label": labels.markers,
      className: "contents",
      children: (state: DeviceApprovalMarkersState) => {
        const pending = marked.filter((item) => selectedIds.includes(item.id))
        if (pending.length === 0) return null
        return (
          <div className="flex flex-col gap-items border-s-2 border-warning-border ps-items">
            {pending.flatMap((item) =>
              confirmationsOf(item).map((confirmation, index) => (
                <CheckboxRow
                  key={confirmationKey(item.id, index)}
                  data-agent-hidden=""
                  label={confirmation}
                  description={item.label}
                  checked={state.ticked.includes(confirmationKey(item.id, index))}
                  disabled={locked !== null}
                  onCheckedChange={(checked, details) =>
                    handle.api.confirmMarker(item.id, checked === true, index, {
                      reason: "press",
                      event: details.event,
                    })
                  }
                />
              )),
            )}
          </div>
        )
      },
    },
  )
}

function ConsentItems(props: ConsentItemsProps) {
  const { items, selectedIds, onSelectedIdsChange, locked, heading, labels } = props
  const headingId = useId()
  const handle = usePrimitive(deviceApprovalItems, {
    items: items.map((item) => ({ value: item.id, label: item.label })),
    unselectable: items.flatMap((item) => (item.disabled ? [{ id: item.id, reason: item.disabled.reason }] : [])),
    locked,
    selectedIds,
    onSelectedIdsChange,
  })
  const hasHeading = heading !== undefined && heading !== null && heading !== false
  const list = usePart(
    handle,
    "root",
    {},
    {
      ...itemsAttributes,
      "aria-labelledby": hasHeading ? headingId : undefined,
      "aria-label": hasHeading ? undefined : labels.items,
      className: "flex min-w-0 flex-col gap-items",
      children: (state: DeviceApprovalItemsState) => (
        <>
          {hasHeading ? (
            <h3 id={headingId} className="text-title-sm">
              {heading}
            </h3>
          ) : null}
          <ul className="flex flex-col gap-items">
            {items.map((item) => (
              <li key={item.id} data-slot="device-approval-item">
                <CheckboxRow
                  data-agent-hidden=""
                  label={item.label}
                  description={item.description}
                  trailing={
                    item.detail === undefined && item.marker === undefined ? undefined : (
                      <>
                        {item.detail}
                        {item.marker ? <Badge tone="warning">{item.marker.label}</Badge> : null}
                      </>
                    )
                  }
                  disabled={item.disabled ?? locked !== null}
                  checked={state.selectedIds.includes(item.id)}
                  onCheckedChange={(checked, details) =>
                    handle.api.select(item.id, checked === true, { reason: "press", event: details.event })
                  }
                />
              </li>
            ))}
          </ul>
        </>
      ),
    },
  )
  return (
    <div className="flex min-w-0 flex-col gap-items">
      {list}
      <MarkerConfirmations {...props} />
    </div>
  )
}

export { ConsentItems, consentBlocked, deviceConsentLabels, useConsentItems }
export type { DeviceConsentItem, DeviceConsentLabels, DeviceConsentMarker, DeviceConsentText, DeviceConsentUnconfirmed }
