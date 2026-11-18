import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { SettingsDangerZone, SettingsPage, SettingsSection } from "@/components/ui/settings-page"
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

function Settings({ loaded, adapter }: { loaded: boolean; adapter: ReturnType<typeof url> }) {
  return (
    <>
      <a href="#main">Skip to content</a>
      <SettingsPage url={adapter}>
        <SettingsSection id="account" title="Account">
          <p>Name</p>
        </SettingsSection>
        {loaded && (
          <SettingsDangerZone id="danger-zone" title="Danger zone">
            <p>Delete</p>
          </SettingsDangerZone>
        )}
      </SettingsPage>
    </>
  )
}

const heading = (name: string) => screen.getByRole("heading", { name })

async function mountLate() {
  history.replaceState(null, "", "/#/settings?section=danger-zone")
  const adapter = url()
  const view = render(<Settings loaded={false} adapter={adapter} />)
  expect(scrolled).toEqual([])
  const load = () => view.rerender(<Settings loaded adapter={adapter} />)
  return { ...view, adapter, load }
}

test("a section the URL names that mounts later is scrolled to and its heading focused, once", async () => {
  const { load, rerender, adapter } = await mountLate()
  await act(() => Promise.resolve())
  load()
  expect(scrolled).toEqual(["danger-zone"])
  expect(document.activeElement).toBe(heading("Danger zone"))
  expect(location.hash).toBe("#/settings?section=danger-zone")
  const nav = screen.getByRole("navigation", { name: "Settings sections" })
  expect(within(nav).getByRole("link", { name: "Danger zone" }).getAttribute("aria-current")).toBe("location")

  rerender(<Settings loaded={false} adapter={adapter} />)
  rerender(<Settings loaded adapter={adapter} />)
  expect(scrolled).toEqual(["danger-zone"])
})

test.each([
  ["a pointer press", () => fireEvent.pointerDown(document.body)],
  ["a key press", () => fireEvent.keyDown(document.body, { key: "j" })],
  ["a scroll", () => fireEvent.scroll(window)],
  ["a wheel", () => fireEvent.wheel(document.body)],
  ["focus moving", () => heading("Account").focus()],
])("after %s since the navigation, a late section neither scrolls nor takes focus", async (_name, interact) => {
  const { load } = await mountLate()
  act(interact)
  const focused = document.activeElement
  load()
  expect(scrolled).toEqual([])
  expect(document.activeElement).toBe(focused)
})

test("a later URL change to a mounted section still scrolls, after a late one was abandoned", async () => {
  const { load } = await mountLate()
  act(() => fireEvent.pointerDown(document.body))
  load()
  act(() => {
    location.hash = "#/settings?section=account"
    dispatchEvent(new HashChangeEvent("hashchange"))
  })
  expect(scrolled).toEqual(["account"])
  expect(document.activeElement).toBe(heading("Account"))
})

test("under StrictMode, a late section is still scrolled to", async () => {
  history.replaceState(null, "", "/#/settings?section=danger-zone")
  const adapter = url()
  const { rerender } = render(
    <StrictMode>
      <Settings loaded={false} adapter={adapter} />
    </StrictMode>,
  )
  await act(() => Promise.resolve())
  rerender(
    <StrictMode>
      <Settings loaded adapter={adapter} />
    </StrictMode>,
  )
  expect(scrolled).toEqual(["danger-zone"])
  expect(document.activeElement).toBe(heading("Danger zone"))
})
