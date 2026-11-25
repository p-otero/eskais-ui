import { useEffect, useEffectEvent, useRef } from "react"

/** Moves focus inside a frame after mounting and closes when focus leaves, as a modal from another library does. */
function useThirdPartyModal(onClose: (reason: string) => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useEffectEvent(onClose)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const frame = requestAnimationFrame(() => element.querySelector("input")?.focus())
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) close("focus left")
    }
    document.addEventListener("focusin", onFocusIn)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("focusin", onFocusIn)
    }
  }, [])
  return ref
}

export { useThirdPartyModal }
