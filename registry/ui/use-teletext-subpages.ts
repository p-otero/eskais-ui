import { useEffect, useEffectEvent, type RefObject } from "react"

/**
 * Turns to the next subpage every `intervalMs` while the page has more than one, and holds still while the page has
 * focus or the pointer, so it can be read, and while it's off screen or the tab is hidden.
 */
function useTeletextSubpages(
  page: RefObject<HTMLElement | null>,
  { count, intervalMs, onTurn }: { count: number; intervalMs: number; onTurn: () => void },
) {
  const turn = useEffectEvent(onTurn)

  useEffect(() => {
    const element = page.current
    if (!element || count < 2 || intervalMs <= 0) return
    let onScreen = true
    let timer: ReturnType<typeof setInterval> | undefined
    const held = () => element.matches(":focus-within, :hover")
    const schedule = () => {
      clearInterval(timer)
      timer = undefined
      if (!onScreen || document.visibilityState === "hidden") return
      timer = setInterval(() => {
        if (!held()) turn()
      }, intervalMs)
    }
    const visibility =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true
            schedule()
          })
        : undefined
    visibility?.observe(element)
    // oxlint-disable-next-line p-otero/prefer-sync-external-store -- the listener reschedules a timer; no value is copied into state
    document.addEventListener("visibilitychange", schedule)
    schedule()
    return () => {
      clearInterval(timer)
      visibility?.disconnect()
      document.removeEventListener("visibilitychange", schedule)
    }
  }, [page, count, intervalMs])
}

export { useTeletextSubpages }
