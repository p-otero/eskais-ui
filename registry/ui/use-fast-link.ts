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
const hashPrefixAttribute = "data-fast-link-hash-prefix"
const defaultHashPrefix = "#/"
const nestedControls = "button, input, label, select, summary, textarea, [role~='button' i]"

// @fast-link/core 0.0.2 leaves every `#…` href native, hash routes (`#/inbox`) included, so these presses are
// resolved here with core's eligibility rules. The anchors that own a controller, and the presses already taken,
// are shared by every root, so a Link inside a FastLinkRegion follows once, by its own settings.
const anchorRoots = new WeakMap<Element, number>()
const handledPresses = new WeakSet<Event>()

/**
 * Whether `href` is a hash route rather than an in-page anchor: it starts with the prefix that the closest
 * `data-fast-link-hash-prefix` gives (`"#/"` without one; an empty value means none).
 */
function isHashRoute(anchor: Element, href: string) {
  if (!href.startsWith("#")) return false
  const prefix = anchor.closest(`[${hashPrefixAttribute}]`)?.getAttribute(hashPrefixAttribute) ?? defaultHashPrefix
  return prefix !== "" && href.startsWith(prefix)
}

function hashRouteIntent(event: PointerEvent, root: HTMLElement): FastLinkIntent | null {
  if (event.defaultPrevented || event.button !== 0 || event.pointerType !== "mouse") return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || handledPresses.has(event)) return null
  const target = event.target instanceof Element ? event.target : null
  const anchor = target?.closest("a")
  if (!target || !anchor || !root.contains(anchor) || (anchor !== root && anchorRoots.has(anchor))) return null
  const role = anchor.getAttribute("role")
  const linkTarget = anchor.getAttribute("target")
  if ((role && !/^\s*(?:link)?\s*$/i.test(role)) || (linkTarget && linkTarget !== "_self")) return null
  const control = target.closest(nestedControls)
  if (anchor.hasAttribute("download") || (control && anchor.contains(control))) return null
  const href = anchor.getAttribute("href")
  const view = anchor.ownerDocument.defaultView
  if (!href || !view || !isHashRoute(anchor, href)) return null
  // A `<base>` elsewhere makes `#/x` another document's URL, which the browser loads natively.
  const url = new URL(href, anchor.ownerDocument.baseURI)
  if (url.href.slice(0, url.href.length - url.hash.length) !== view.location.href.split("#")[0]) return null
  handledPresses.add(event)
  return { anchor, href, url }
}

// Core reads `data-no-fast-link` only between the pressed element and its anchor. Checking the press here, in a
// capture listener added before core's on the same root, lets an ancestor (a region, `<body>`) opt out too.
function attachFastLink(root: HTMLElement, options: () => FastLinkOptions) {
  let press: PointerEvent | undefined
  let pendingHashRoute: HTMLAnchorElement | undefined
  const follow = (intent: FastLinkIntent, hashRoute: boolean) => {
    const { onFollow } = options()
    const view = intent.anchor.ownerDocument.defaultView
    if (onFollow && press) onFollow(intent.href, { url: intent.url, anchor: intent.anchor, event: press })
    else if (hashRoute && view) view.location.hash = intent.url.hash
    else view?.location.assign(intent.url.href)
  }
  const navigate = (intent: FastLinkIntent) => follow(intent, false)
  const onPointerDown = (event: PointerEvent) => {
    press = event
    pendingHashRoute = undefined
    const target = event.target instanceof Element ? event.target : null
    const enabled = options().enabled !== false && !target?.closest(optOut)
    controller.update({ enabled, navigate })
    const hashRoute = enabled ? hashRouteIntent(event, root) : null
    if (!hashRoute) return
    pendingHashRoute = hashRoute.anchor
    follow(hashRoute, true)
  }
  // The click that ends the press would follow the link again (a router's onFollow, the link part's own click).
  const onClick = (event: MouseEvent) => {
    const anchor = pendingHashRoute
    if (!anchor || event.detail === 0 || !(event.target instanceof Node) || !anchor.contains(event.target)) return
    pendingHashRoute = undefined
    event.preventDefault()
  }
  if (root instanceof HTMLAnchorElement) anchorRoots.set(root, (anchorRoots.get(root) ?? 0) + 1)
  root.addEventListener("pointerdown", onPointerDown, { capture: true })
  root.addEventListener("click", onClick, { capture: true })
  const controller = createFastLink(root, { enabled: options().enabled !== false, navigate })
  return () => {
    root.removeEventListener("pointerdown", onPointerDown, { capture: true })
    root.removeEventListener("click", onClick, { capture: true })
    const owners = (anchorRoots.get(root) ?? 1) - 1
    if (owners > 0) anchorRoots.set(root, owners)
    else anchorRoots.delete(root)
    controller.destroy()
  }
}

/**
 * A ref that follows same-origin links on a primary mouse press instead of on release, on the element itself (an
 * anchor) or on the anchors inside it. Keyboard, touch, pen and modified or non-primary presses stay native. A hash
 * route (`#/inbox`) follows too, through `onFollow` or `location.hash`; an in-page anchor (`#section`) stays native.
 */
function useFastLink<T extends HTMLElement>(options: FastLinkOptions = {}): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null)
  const readOptions = useEffectEvent(() => options)
  useEffect(() => (element ? attachFastLink(element, () => readOptions()) : undefined), [element])
  return setElement
}

export { hashPrefixAttribute, isHashRoute, useFastLink }
export type { FastLinkOptions }
