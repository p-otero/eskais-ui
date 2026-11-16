"use client"

import { createFastLink, type FastLinkIntent } from "@fast-link/core"
import { useEffect, useEffectEvent, useState, type RefCallback } from "react"

type FastLinkOptions = {
  /** `false` leaves every press native. */
  enabled?: boolean
  /** Navigates instead of `location.assign`, for a client-side router. Receives the authored `href`. */
  onFollow?: (href: string, details: { url: URL; anchor: HTMLAnchorElement; event: PointerEvent }) => void
}

const optOut = "[data-no-fast-link]"

// Core reads `data-no-fast-link` only between the pressed element and its anchor. Checking the press here, in a
// capture listener added before core's on the same root, lets an ancestor (a region, `<body>`) opt out too.
function attachFastLink(root: HTMLElement, options: () => FastLinkOptions) {
  let press: PointerEvent | undefined
  const navigate = (intent: FastLinkIntent) => {
    const { onFollow } = options()
    if (onFollow && press) onFollow(intent.href, { url: intent.url, anchor: intent.anchor, event: press })
    else intent.anchor.ownerDocument.defaultView?.location.assign(intent.url.href)
  }
  const onPointerDown = (event: PointerEvent) => {
    press = event
    const target = event.target instanceof Element ? event.target : null
    controller.update({ enabled: options().enabled !== false && !target?.closest(optOut), navigate })
  }
  root.addEventListener("pointerdown", onPointerDown, { capture: true })
  const controller = createFastLink(root, { enabled: options().enabled !== false, navigate })
  return () => {
    root.removeEventListener("pointerdown", onPointerDown, { capture: true })
    controller.destroy()
  }
}

/**
 * A ref that follows same-origin links on a primary mouse press instead of on release, on the element itself (an
 * anchor) or on the anchors inside it. Keyboard, touch, pen and modified or non-primary presses stay native.
 */
function useFastLink<T extends HTMLElement>(options: FastLinkOptions = {}): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null)
  const readOptions = useEffectEvent(() => options)
  useEffect(() => (element ? attachFastLink(element, () => readOptions()) : undefined), [element])
  return setElement
}

export { useFastLink }
export type { FastLinkOptions }
