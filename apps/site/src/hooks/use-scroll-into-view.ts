import { useEffect, type RefObject } from "react"

function useScrollIntoView(containerRef: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    containerRef.current?.querySelector(selector)?.scrollIntoView({ block: "nearest" })
  }, [containerRef, selector])
}

export { useScrollIntoView }
