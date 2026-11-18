import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

import { resetAnnouncer } from "@/lib/test-utils"

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

// UI SDK 0.1.0-beta.10's own pagination primitive fails its dev role check as it is defined (the `link` slot
// declares the link role without `focus`), which strict mode turns into a throw at import. Load it leniently once.
globalThis.__UI_SDK_STRICT__ = false
await import("@ui-sdk/core/pagination")
globalThis.__UI_SDK_STRICT__ = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom gaps that UI SDK needs filled (see the ui-sdk skill, testing.md#jsdom).
HTMLElement.prototype.showPopover = function showPopover() {}
HTMLElement.prototype.hidePopover = function hidePopover() {}
Element.prototype.getAnimations = () => []
Element.prototype.scrollIntoView = function scrollIntoView() {}
Element.prototype.checkVisibility = () => true
Element.prototype.getClientRects = () => [] as unknown as DOMRectList
document.elementFromPoint = () => null
document.elementsFromPoint = () => []
// jsdom has no canvas: its getContext logs "not implemented" and returns null. Return null quietly, so callers that
// feature-detect a 2D context (the theme editor's colour conversion) take their fallback without the noise.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
document.head.append(
  Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" }),
)

afterEach(() => {
  cleanup()
  resetAnnouncer()
})
