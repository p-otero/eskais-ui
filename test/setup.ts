import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

declare global {
  var __UI_SDK_STRICT__: boolean | undefined
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

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
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
document.head.append(
  Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" }),
)

afterEach(cleanup)
