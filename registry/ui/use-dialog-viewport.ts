"use client"

import { useEffect, type RefObject } from "react"

const keyboardless = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
])

function opensKeyboard(target: EventTarget | null) {
  let element = target instanceof Element ? target : null
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable || element instanceof HTMLTextAreaElement || element instanceof HTMLIFrameElement) {
    return true
  }
  return element instanceof HTMLInputElement && !keyboardless.has(element.type)
}

const viewportProperties = ["--dialog-viewport-top", "--dialog-viewport-bottom", "--dialog-viewport-height"]

// Writes the visual viewport on the content, so CSS places it against its containing block (`calc(100% - bottom)`),
// not against `innerHeight`, which iOS 26 Safari can leave stale, and the visible part can end above the layout one
// with no keyboard (toolbars), so UI SDK's `data-keyboard` (beta.12) misfires there: `data-dialog-keyboard` also needs
// a focused field. Pinch-zoomed, the properties go away and the content stays put.
function useVisualViewportBox(contentRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined
    let pageScale = 1
    // Read on every update: a content rendered through `render` can attach its ref after this effect runs.
    let written: HTMLElement | null = null
    const clear = () => {
      for (const name of viewportProperties) written?.style.removeProperty(name)
      written?.removeAttribute("data-dialog-keyboard")
    }
    const update = (event?: Event) => {
      const content = contentRef.current
      if (content !== written) clear()
      written = content
      if (!content) return undefined
      if (Math.abs(viewport.height - window.innerHeight) <= 1) pageScale = viewport.scale
      if (viewport.scale > pageScale + 0.01) return clear()
      const bottom = viewport.offsetTop + viewport.height
      content.style.setProperty("--dialog-viewport-top", `${String(Math.round(viewport.offsetTop))}px`)
      content.style.setProperty("--dialog-viewport-bottom", `${String(Math.round(bottom))}px`)
      content.style.setProperty("--dialog-viewport-height", `${String(Math.round(viewport.height))}px`)
      const typing =
        opensKeyboard(document.activeElement) ||
        (event instanceof FocusEvent && event.type === "focusout" && opensKeyboard(event.relatedTarget))
      content.toggleAttribute("data-dialog-keyboard", typing && window.innerHeight - bottom > 1)
      return undefined
    }
    update()
    const frame = requestAnimationFrame(() => update())
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    window.addEventListener("resize", update)
    document.addEventListener("focusin", update)
    document.addEventListener("focusout", update)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      document.removeEventListener("focusin", update)
      document.removeEventListener("focusout", update)
      clear()
    }
  }, [contentRef])
}

export { useVisualViewportBox }
