import { useEffect, type RefObject } from "react"

/** Scrolls the match for `selector` inside `containerRef` into view whenever the selector changes. */
function useScrollIntoView(containerRef: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    containerRef.current?.querySelector(selector)?.scrollIntoView({ block: "nearest" })
  }, [containerRef, selector])
}

export { useScrollIntoView }
