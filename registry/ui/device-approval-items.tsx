"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { useId, useState, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { CheckboxRow } from "@/components/ui/checkbox-row"
import {
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
  /**
   * For an item that replaces something that already exists: `label` shows as a warning badge, like "Replace", and
   * `confirm` labels a second checkbox, like "Replace the existing key", that the person ticks once it's selected.
   */
  marker?: { label: ReactNode; confirm: ReactNode }
}

/** The consent items' visible text. None has a default: pass it in the page's language. */
type DeviceConsentText = {
  /** The heading over the items. */
  items?: ReactNode
  /** Why Approve waits while nothing is selected; shown beside the actions and read by an agent. */
  nothingSelected?: string
  /** Why Approve waits for marked items without their confirmation ticked, or a function of their labels. */
  unconfirmed?: string | ((labels: string[]) => string)
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

/** The selected ids, and the confirmations that belong to them: an item that leaves the selection loses its tick. */
function useConsentItems({ items, selected, defaultSelected, onSelectedChange }: ConsentSelection) {
  const [ownSelected, setOwnSelected] = useState(defaultSelected ?? noIds)
  const selectedIds = (selected ?? ownSelected).filter((id) => items?.some((item) => item.id === id) ?? false)
  const [confirmation, setConfirmation] = useState({ selectedIds, confirmedIds: noIds })
  let confirmedIds = confirmation.confirmedIds
  if (!sameIds(confirmation.selectedIds, selectedIds)) {
    confirmedIds = confirmedIds.filter((id) => selectedIds.includes(id))
    setConfirmation({ selectedIds, confirmedIds })
  }
  return {
    selectedIds,
    confirmedIds,
    select: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => {
      onSelectedChange?.(ids, details)
      if (!details.canceled && selected === undefined) setOwnSelected(ids)
    },
    confirm: (ids: string[]) => setConfirmation({ selectedIds, confirmedIds: ids }),
  }
}

/** Why the items keep Approve off: `reason` for an agent, `shown` when the page gave the words. */
function consentBlocked(
  items: readonly DeviceConsentItem[] | undefined,
  selectedIds: readonly string[],
  confirmedIds: readonly string[],
  text: DeviceConsentText,
): { reason: string; shown?: string } | null {
  if (items === undefined) return null
  if (selectedIds.length === 0)
    return { reason: text.nothingSelected ?? "nothing is selected", shown: text.nothingSelected }
  const unconfirmed = items
    .filter((item) => item.marker && selectedIds.includes(item.id) && !confirmedIds.includes(item.id))
    .map((item) => item.label)
  if (unconfirmed.length === 0) return null
  const shown = typeof text.unconfirmed === "function" ? text.unconfirmed(unconfirmed) : text.unconfirmed
  return { reason: shown ?? `${unconfirmed.join(", ")} needs its confirmation ticked`, shown }
}

type ConsentItemsProps = {
  items: readonly DeviceConsentItem[]
  selectedIds: readonly string[]
  confirmedIds: readonly string[]
  onSelectedIdsChange: (ids: string[], details: ChangeDetails<DeviceApprovalItemsChangeReason>) => void
  onConfirmedIdsChange: (ids: string[]) => void
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
  confirmedIds,
  onConfirmedIdsChange,
  locked,
  labels,
}: Omit<ConsentItemsProps, "onSelectedIdsChange" | "heading">) {
  const marked = items.filter((item) => item.marker !== undefined)
  const handle = usePrimitive(deviceApprovalMarkers, {
    items: items.map((item) => ({ value: item.id, label: item.label })),
    marked: marked.map((item) => item.id),
    selectedIds,
    locked,
    confirmedIds,
    onConfirmedIdsChange: (ids) => onConfirmedIdsChange(ids),
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
            {pending.map((item) => (
              <CheckboxRow
                key={item.id}
                data-agent-hidden=""
                label={item.marker?.confirm}
                description={item.label}
                checked={state.confirmedIds.includes(item.id)}
                disabled={locked !== null}
                onCheckedChange={(checked, details) =>
                  handle.api.confirmMarker(item.id, checked === true, { reason: "press", event: details.event })
                }
              />
            ))}
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
export type { DeviceConsentItem, DeviceConsentLabels, DeviceConsentText }
