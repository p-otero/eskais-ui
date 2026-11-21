"use client"

import type { CommandData, CommandDataItem, CommandValueChangeReason } from "@ui-sdk/react/command"
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { useVirtualRows, type Virtualize } from "@/components/ui/virtual-rows"
import { assumeType } from "@/lib/narrow"

/** `"auto"` renders only the commands in view past this many. */
const COMMAND_VIRTUALIZE_THRESHOLD = 50

/**
 * One line of a flattened command list: a command with its index among the visible ones and its group's key, the
 * start of a group (its label, if it has one), or a separator.
 */
type CommandRow<Item extends CommandDataItem = CommandDataItem> =
  | { type: "item"; key: string; item: Item; index: number; group: string | undefined }
  | { type: "group"; key: string; label: string | undefined; first: boolean }
  | { type: "separator"; key: string }

type Highlight = { index: number; reason: CommandValueChangeReason | undefined }

/** Where the highlight is, written by `Command`'s `onValueChange` and followed by the rows that render. */
function createCommandHighlight() {
  let current: Highlight = { index: -1, reason: undefined }
  const listeners = new Set<(highlight: Highlight) => void>()
  return {
    current: () => current,
    set(index: number, reason: CommandValueChangeReason | undefined) {
      current = { index, reason }
      for (const listener of listeners) listener(current)
    },
    subscribe(listener: (highlight: Highlight) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

type CommandHighlight = ReturnType<typeof createCommandHighlight>

function rowsOf<Item extends CommandDataItem>(items: CommandData) {
  const rows: CommandRow<Item>[] = []
  let index = 0
  const add = (entry: CommandDataItem | string, group?: string) => {
    // UI SDK types command data by its base item; the entries are the app's Items, as its `renderItem` and
    // `estimateItem` say, and a string entry stands for the item `{ value, label }`.
    const item = assumeType<Item>(typeof entry === "string" ? { value: entry, label: entry } : entry)
    rows.push({ type: "item", key: `item:${item.value}`, item, index, group })
    index += 1
  }
  for (const [position, entry] of items.entries()) {
    if (typeof entry === "object" && "type" in entry && entry.type === "separator") {
      rows.push({ type: "separator", key: `separator:${String(position)}` })
    } else if (typeof entry === "object" && "type" in entry && entry.type === "group") {
      const key = `group:${String(position)}`
      rows.push({ type: "group", key, label: entry.label, first: rows.length === 0 })
      for (const item of entry.items) add(item, key)
    } else {
      add(entry)
    }
  }
  return { rows, commands: index }
}

const commandList = (anchor: HTMLElement) => anchor.closest<HTMLElement>('[data-slot="command-list"]')

// Before a row is measured: a command is `h-control-sm`, a group's label a line of `text-xs` with `py-inline`.
const estimates = { item: 32, group: 28, separator: 13 }

/**
 * The rows of a command list, and the ones to render: past `COMMAND_VIRTUALIZE_THRESHOLD` commands, those in view and
 * the highlighted one. Moving the highlight with the keyboard or typing scrolls its row into view; the pointer
 * doesn't, since the row is already under it.
 */
function useCommandRows<Item extends CommandDataItem>(
  items: CommandData,
  highlight: CommandHighlight | null,
  virtualize: Virtualize,
  estimateItem?: (item: Item) => number | undefined,
) {
  const { rows, commands } = useMemo(() => rowsOf<Item>(items), [items])
  const enabled = virtualize === "auto" ? commands > COMMAND_VIRTUALIZE_THRESHOLD : virtualize
  const rowOf = useMemo(() => rows.flatMap((row, at) => (row.type === "item" ? [at] : [])), [rows])
  const getKey = useCallback((at: number) => rows[at]?.key ?? String(at), [rows])
  const estimateSize = useCallback(
    (at: number) => {
      const row = rows[at]
      return (row?.type === "item" ? estimateItem?.(row.item) : undefined) ?? estimates[row?.type ?? "item"]
    },
    [rows, estimateItem],
  )
  const { anchor, ...virtual } = useVirtualRows({
    count: rows.length,
    virtualize: enabled,
    estimateSize,
    getKey,
    overscan: 6,
    scrollElement: commandList,
  })

  const { pin, scrollToIndex } = virtual
  const latest = useRef({ rowOf, pin, scrollToIndex })
  const follow = useCallback(({ index, reason }: Highlight) => {
    const current = latest.current
    const row = index < 0 ? undefined : current.rowOf[index]
    current.pin(row)
    if (row !== undefined && reason !== "item-hover") current.scrollToIndex(row)
  }, [])
  useLayoutEffect(() => {
    latest.current = { rowOf, pin, scrollToIndex }
    if (highlight) follow(highlight.current())
  }, [rowOf, pin, scrollToIndex, highlight, follow])
  useLayoutEffect(() => highlight?.subscribe(follow), [highlight, follow])

  // UI SDK 0.1.0-beta.5 reads `items` in an effect of `Command`, after the effects of the commands inside it: a data
  // command that mounts in the same commit registers as a composed one, and the arrow keys never highlight it. The
  // rows mount in the next commit instead, still before paint.
  const [ready, setReady] = useState(false)
  // oxlint-disable-next-line react/set-state-in-effect -- one render after mount, the workaround above for UI SDK 0.1.0-beta.5
  useLayoutEffect(() => setReady(true), [])

  return { rows, anchor, virtual, ready }
}

export { COMMAND_VIRTUALIZE_THRESHOLD, createCommandHighlight, useCommandRows }
type CommandRowProps<Item extends CommandDataItem> = {
  row: CommandRow<Item>
  at: number
  measure: ((node: HTMLElement | null) => (() => void) | undefined) | undefined
  render: ((item: Item) => ReactNode) | undefined
}

export type { CommandHighlight, CommandRow, CommandRowProps }
