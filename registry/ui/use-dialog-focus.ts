"use client"

import { useLayoutEffect, useRef, type RefObject } from "react"

type FocusMemory = { opener: HTMLElement | null; movedBeforeOpen: boolean }

function focusedElement() {
  const active = document.activeElement
  return active instanceof HTMLElement && active !== document.body ? active : null
}

function openModals() {
  const modals = [...document.querySelectorAll('[aria-modal="true"]')]
  try {
    modals.push(...document.querySelectorAll("dialog:modal"))
  } catch {
    // Engines without :modal (jsdom) still see modals by aria-modal.
  }
  return modals.filter((modal) => !modal.hasAttribute("data-ending-style"))
}

// A closing dialog gives focus back only from inside itself, or from <body> when no other modal is open. Another
// modal opened meanwhile (one of ours or another library's, which may move focus in a frame later) keeps it.
function mayReturnFocus(own: Element | null, active: Element | null = focusedElement()) {
  if (active) return own?.contains(active) ?? false
  return !openModals().some((modal) => modal !== own && !own?.contains(modal))
}

/** Records the focused element once, on mount. */
function useRecordOpener(memoryRef: RefObject<FocusMemory>) {
  const recorded = useRef(false)
  useLayoutEffect(() => {
    if (recorded.current) return
    recorded.current = true
    memoryRef.current = { opener: focusedElement(), movedBeforeOpen: false }
  }, [memoryRef])
}

/** Notes, once, whether focus moved away from the recorded opener between the two markers' layout effects. */
function useRecordFocusMove(memoryRef: RefObject<FocusMemory>) {
  const checked = useRef(false)
  useLayoutEffect(() => {
    if (checked.current) return
    checked.current = true
    memoryRef.current = { ...memoryRef.current, movedBeforeOpen: focusedElement() !== memoryRef.current.opener }
  }, [memoryRef])
}

export { focusedElement, mayReturnFocus, useRecordFocusMove, useRecordOpener }
export type { FocusMemory }
