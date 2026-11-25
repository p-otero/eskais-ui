import { useEffect } from "react"

/** Writes the glass opacity to `<html>` while the glass theme is on, and removes it after. */
function useGlassOpacity(glass: boolean, opacity: number) {
  useEffect(() => {
    const root = document.documentElement
    if (!glass) return
    root.style.setProperty("--glass-opacity", `${opacity}%`)
    // Perf: a fully opaque surface hides what's behind it, so skip the blur, the expensive part.
    if (opacity === 100) root.style.setProperty("--glass-blur", "0px")
    else root.style.removeProperty("--glass-blur")
    return () => {
      root.style.removeProperty("--glass-opacity")
      root.style.removeProperty("--glass-blur")
    }
  }, [glass, opacity])
}

export { useGlassOpacity }
