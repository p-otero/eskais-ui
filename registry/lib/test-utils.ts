import { getConfig, queryAllByRole, queryAllByText } from "@testing-library/dom"
import type { ByRoleOptions, Matcher, SelectorMatcherOptions } from "@testing-library/dom"
import { assumeType } from "@/lib/narrow"

const announcerSelector = "[data-ui-sdk-announcer]"

/** Pass as `ignore` to a Testing Library text query so it skips UI SDK's live regions: `getByText("Saved", { ignore: ignoreAnnouncer })`. */
const ignoreAnnouncer = `script, style, ${announcerSelector}`

/** Whether a node is one of UI SDK's live regions, or inside one. */
function isAnnouncer(node: Node | null | undefined): boolean {
  const element = node instanceof Element ? node : node?.parentElement
  return Boolean(element?.closest(announcerSelector))
}

function container(within?: ParentNode): HTMLElement {
  // Workaround: Testing Library's queries type their container as an HTMLElement but search any node with children, a document
  // or a fragment included.
  return assumeType<HTMLElement>(within ?? document.body)
}

/** Every `role="alert"` element, without UI SDK's assertive live region. */
function queryAlerts(within?: ParentNode, options?: ByRoleOptions): HTMLElement[] {
  return queryAllByRole(container(within), "alert", options).filter((node) => !isAnnouncer(node))
}

/** Every `role="status"` element, without UI SDK's polite live region. */
function queryStatuses(within?: ParentNode, options?: ByRoleOptions): HTMLElement[] {
  return queryAllByRole(container(within), "status", options).filter((node) => !isAnnouncer(node))
}

/** The toasts showing, newest first. A toast animating out is left out. */
function queryToasts(within?: ParentNode): HTMLElement[] {
  return [...container(within).querySelectorAll<HTMLElement>('[data-slot="toast"]')].filter(
    (node) => !node.hasAttribute("data-ending-style"),
  )
}

function toastsWithText(text: Matcher, within?: ParentNode, options?: SelectorMatcherOptions) {
  const showing = new Set(queryToasts(within))
  const matches = queryAllByText(container(within), text, { ...options, ignore: options?.ignore ?? ignoreAnnouncer })
    .map((node) => node.closest<HTMLElement>('[data-slot="toast"]'))
    .filter((node): node is HTMLElement => node !== null && showing.has(node))
  return [...new Set(matches)]
}

/** The toast showing an element whose text matches, or null. Throws when several toasts match. */
function queryToast(text: Matcher, within?: ParentNode, options?: SelectorMatcherOptions): HTMLElement | null {
  const found = toastsWithText(text, within, options)
  if (found.length > 1)
    throw getConfig().getElementError(`Found ${found.length} toasts with ${String(text)}`, container(within))
  return found[0] ?? null
}

/** The toast showing an element whose text matches. Throws when none or several do. */
function getToast(text: Matcher, within?: ParentNode, options?: SelectorMatcherOptions): HTMLElement {
  const found = queryToast(text, within, options)
  if (!found) throw getConfig().getElementError(`Found no toast with ${String(text)}`, container(within))
  return found
}

/** What UI SDK's live regions hold now: the last polite and the last assertive announcement. */
function readAnnouncements(doc: Document = document): { polite: string; assertive: string } {
  const text = (priority: string) =>
    doc.querySelector(`[data-ui-sdk-announcer="${priority}"]`)?.textContent?.trim() ?? ""
  return { polite: text(""), assertive: text("assertive") }
}

/**
 * Removes UI SDK's live regions, so one test's announcements don't leak into the next. UI SDK makes new ones on the
 * next announcement; call it in `afterEach`, after Testing Library's `cleanup`.
 */
function resetAnnouncer(doc: Document = document): void {
  for (const node of doc.querySelectorAll(announcerSelector)) node.remove()
}

export {
  getToast,
  ignoreAnnouncer,
  isAnnouncer,
  queryAlerts,
  queryStatuses,
  queryToast,
  queryToasts,
  readAnnouncements,
  resetAnnouncer,
}
