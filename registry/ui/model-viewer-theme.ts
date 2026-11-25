import { Color, SRGBColorSpace } from "three"

const listeners = new Set<() => void>()
let stop: (() => void) | undefined

function changed() {
  for (const listener of listeners) listener()
}

// Perf: one observer for every canvas on the page: the theme (`.dark`, `data-theme`, `data-color-scheme`, a palette) is
// switched on <html>, and the system's scheme applies until a script sets one.
function watch(doc: Document) {
  const observer = new MutationObserver(changed)
  observer.observe(doc.documentElement, { attributes: true })
  if (doc.body) observer.observe(doc.body, { attributes: true, attributeFilter: ["class", "data-theme"] })
  const scheme = doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)")
  scheme?.addEventListener("change", changed)
  return () => {
    observer.disconnect()
    scheme?.removeEventListener("change", changed)
  }
}

/** Calls `listener` whenever the page's theme may have changed, to read theme colours again; returns the stop. */
function onThemeChange(listener: () => void) {
  listeners.add(listener)
  if (!stop && typeof document !== "undefined") stop = watch(document)
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    stop?.()
    stop = undefined
  }
}

let probe: CanvasRenderingContext2D | null | undefined

/**
 * A theme token as three.js reads it, from `element`'s computed style: a 2D canvas paints it, so any colour space
 * the token is written in (oklch, color-mix) comes back as sRGB. `fallback` when the token or the canvas is missing.
 */
function tokenColor(element: Element, name: string, fallback: number, into = new Color()) {
  const value = getComputedStyle(element).getPropertyValue(name).trim()
  if (probe === undefined) {
    const canvas = element.ownerDocument.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    probe = canvas.getContext("2d", { willReadFrequently: true })
  }
  if (!value || !probe) return into.set(fallback)
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = "#000"
  probe.fillStyle = value
  probe.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data
  return into.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
}

/** Whether a colour is dark enough that light drawn over it should add up, as glowing sprites do. */
const isDark = (color: Color) => color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.3

export { isDark, onThemeChange, tokenColor }
