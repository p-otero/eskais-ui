import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

import { resetAnnouncer } from "@/lib/test-utils"

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.__UI_SDK_STRICT__ = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Workaround: jsdom gaps UI SDK needs filled (the ui-sdk skill's testing.md#jsdom).
HTMLElement.prototype.showPopover = function showPopover() {}
HTMLElement.prototype.hidePopover = function hidePopover() {}
Element.prototype.getAnimations = () => []
Element.prototype.scrollIntoView = function scrollIntoView() {}
Element.prototype.checkVisibility = () => true
Element.prototype.getClientRects = () => [] as unknown as DOMRectList
document.elementFromPoint = () => null
document.elementsFromPoint = () => []
// Workaround: jsdom's canvas getContext logs "not implemented"; return null quietly so feature detection falls back.
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
