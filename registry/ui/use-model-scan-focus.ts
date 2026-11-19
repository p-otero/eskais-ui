import { useEffect, useLayoutEffect, useRef } from "react"

const enabledControl =
  "button:not(:disabled,[aria-disabled=true]), select:not(:disabled), a[href], input:not(:disabled,[type=hidden])"

const isGone = (element: HTMLElement) => !element.isConnected || element.matches(":disabled, [aria-disabled=true]")

/**
 * Keeps focus in ModelScan's status row across stages. The row's controls change with the stage (a start button
 * goes when the run begins, Cancel when it ends, Retry after an error), so when the control that had focus there is
 * removed or disabled, focus moves to the row's first enabled control instead of falling to the page.
 */
function useModelScanFocus(stage: string) {
  const row = useRef<HTMLDivElement>(null)
  const focused = useRef<HTMLElement | null>(null)
  const shownStage = useRef(stage)

  useEffect(() => {
    const element = row.current
    if (!element) return
    const onFocusIn = (event: FocusEvent) => {
      focused.current = event.target instanceof HTMLElement ? event.target : null
    }
    // Focus that leaves for another element is the person's choice; a removed control leaves with nowhere to go.
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && !element.contains(event.relatedTarget)) focused.current = null
    }
    element.addEventListener("focusin", onFocusIn)
    element.addEventListener("focusout", onFocusOut)
    return () => {
      element.removeEventListener("focusin", onFocusIn)
      element.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  // After every render, but it acts only once the stage has changed.
  useLayoutEffect(() => {
    if (shownStage.current === stage) return
    shownStage.current = stage
    const element = row.current
    const last = focused.current
    if (!element || !last || !isGone(last)) return
    const active = element.ownerDocument.activeElement
    if (active && active !== last && active !== element.ownerDocument.body) return
    const next = element.querySelector<HTMLElement>(enabledControl)
    focused.current = next
    next?.focus()
  })

  return row
}

export { useModelScanFocus }
