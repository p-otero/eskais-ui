import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { SettingsPage, SettingsSection } from "@/components/ui/settings-page"
import { createUrlParam } from "@/lib/url-param"
import { hashRouter } from "@/lib/url-router"

const scrolled: string[] = []

beforeEach(() => {
  scrolled.length = 0
  history.replaceState(null, "", "/")
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolled.push(this.id)
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const url = () => createUrlParam("section", { router: hashRouter() })

const heading = (name: string) => screen.getByRole("heading", { name })

function mousePress(link: HTMLElement, { focusAnyway = false } = {}) {
  act(() => {
    link.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }),
    )
    const allowed = fireEvent.mouseDown(link, { button: 0 })
    if (allowed || focusAnyway) link.focus()
    link.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }),
    )
    fireEvent.mouseUp(link, { button: 0 })
    fireEvent.click(link, { button: 0, detail: 1 })
  })
}

function Routed() {
  return (
    <SettingsPage url={url()}>
      <SettingsSection id="account" title="Account">
        <p>Name</p>
      </SettingsSection>
      <SettingsSection id="security" title="Security">
        <p>Sessions</p>
      </SettingsSection>
    </SettingsPage>
  )
}

test.each([false, true])(
  "a mouse press on a hashRouter section link leaves focus on the heading (browser focuses the link anyway: %s)",
  (focusAnyway) => {
    history.replaceState(null, "", "/#/settings")
    render(<Routed />)
    const link = within(screen.getByRole("navigation", { name: "Settings sections" })).getByRole("link", {
      name: "Security",
    })
    expect(link.getAttribute("href")).toBe("#/settings?section=security")
    mousePress(link, { focusAnyway })
    expect(location.hash).toBe("#/settings?section=security")
    expect(scrolled).toEqual(["security"])
    expect(document.activeElement).toBe(heading("Security"))
    expect(link.getAttribute("aria-current")).toBe("location")
  },
)

test("Enter on a hashRouter section link focuses the heading too, and a modified click keeps the link's own focus", () => {
  history.replaceState(null, "", "/#/settings")
  render(<Routed />)
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  const security = within(nav).getByRole("link", { name: "Security" })
  act(() => security.focus())
  act(() => {
    fireEvent.keyDown(security, { key: "Enter" })
    fireEvent.click(security, { detail: 0 })
  })
  expect(document.activeElement).toBe(heading("Security"))

  const account = within(nav).getByRole("link", { name: "Account" })
  act(() => account.focus())
  const allowed = fireEvent.mouseDown(account, { button: 0, ctrlKey: true })
  expect(allowed).toBe(true)
  fireEvent.click(account, { button: 0, ctrlKey: true })
  expect(document.activeElement).toBe(account)
})
