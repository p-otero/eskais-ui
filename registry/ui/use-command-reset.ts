"use client"

import type { createCommandController } from "@ui-sdk/react/command"
import { useEffect } from "react"

type CommandController = ReturnType<typeof createCommandController>

const firstCommand = '[data-slot="command-item"][data-value]:not([data-disabled]):not([aria-disabled="true"])'

/**
 * Highlights the first command each time the dialog around a Command opens. UI SDK settles the highlight on a new
 * search or page, so a palette kept mounted and reopened on the same empty search would keep the last one.
 */
function useHighlightFirstOnOpen(
  open: boolean,
  enabled: boolean,
  controller: CommandController,
  root: HTMLElement | null,
) {
  useEffect(() => {
    if (!open || !enabled || controller.getQuery() !== "") return
    const value = root?.querySelector<HTMLElement>(firstCommand)?.dataset.value
    if (value !== undefined && value !== controller.getValue()) controller.setValue(value)
  }, [open, enabled, controller, root])
}

export { useHighlightFirstOnOpen }
