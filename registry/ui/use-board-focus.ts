"use client"

import { useCallback, useLayoutEffect, useRef } from "react"

type Intent = "panel" | "card" | null

function selectButton(root: HTMLElement, id: string) {
  return root.querySelector<HTMLElement>(`[data-task-select][data-task-id="${CSS.escape(id)}"]`)
}

/**
 * Moves focus into the detail panel when a person opens it, and back to the task's
 * card or row when it closes. An agent's selection leaves focus where it is, unless
 * closing the panel dropped it on the body.
 */
function useBoardFocus(selectedId: string | null) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const intent = useRef<Intent>(null)
  const previous = useRef<string | null>(selectedId)

  useLayoutEffect(() => {
    const wanted = intent.current
    const closed = previous.current
    intent.current = null
    previous.current = selectedId
    const root = bodyRef.current
    if (!root) return
    if (selectedId !== null) {
      if (wanted === "panel") root.querySelector<HTMLElement>('[data-slot="task-detail-title"]')?.focus()
      return
    }
    const lost = document.activeElement === null || document.activeElement === document.body
    if (closed !== null && (wanted === "card" || lost)) selectButton(root, closed)?.focus()
  }, [selectedId])

  const focusPanelNext = useCallback(() => {
    intent.current = "panel"
  }, [])
  const focusCardNext = useCallback(() => {
    intent.current = "card"
  }, [])

  return { bodyRef, focusPanelNext, focusCardNext }
}

export { useBoardFocus }
