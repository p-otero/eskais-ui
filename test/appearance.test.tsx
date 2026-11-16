import { act, render } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"

import { Appearance, createAppearance } from "@/components/ui/appearance"

type Listener = (event: { matches: boolean }) => void
const listeners = new Set<Listener>()
const query = {
  matches: false,
  media: "(prefers-color-scheme: dark)",
  addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
  removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  addListener: (listener: Listener) => listeners.add(listener),
  removeListener: (listener: Listener) => listeners.delete(listener),
}
window.matchMedia = (() => query) as unknown as typeof window.matchMedia

function prefersDark(matches: boolean) {
  query.matches = matches
  act(() => {
    for (const listener of listeners) listener({ matches })
  })
}

const html = document.documentElement
const dark = () => html.classList.contains("dark")

afterEach(() => {
  prefersDark(false)
  html.classList.remove("dark")
  html.removeAttribute("data-theme")
})

test("system follows the browser's color scheme as it changes", () => {
  render(<Appearance appearance={createAppearance()} />)
  expect(dark()).toBe(false)
  expect(html.getAttribute("data-color-scheme")).toBe("system")
  prefersDark(true)
  expect(dark()).toBe(true)
  prefersDark(false)
  expect(dark()).toBe(false)
})

test("an explicit light or dark ignores the browser, and set() switches it", () => {
  prefersDark(true)
  const appearance = createAppearance({ colorScheme: "light" })
  render(<Appearance appearance={appearance} />)
  expect(dark()).toBe(false)
  act(() => void appearance.colorScheme.set("dark"))
  expect(dark()).toBe(true)
  prefersDark(false)
  expect(dark()).toBe(true)
})

test("the theme sets data-theme on <html>, and default leaves it off", () => {
  const appearance = createAppearance({ theme: "compact" })
  render(<Appearance appearance={appearance} />)
  expect(html.getAttribute("data-theme")).toBe("compact")
  act(() => void appearance.theme.set("glass"))
  expect(html.getAttribute("data-theme")).toBe("glass")
  act(() => void appearance.theme.set("default"))
  expect(html.hasAttribute("data-theme")).toBe(false)
})

test("apply() writes the choice synchronously, before anything renders", () => {
  prefersDark(true)
  createAppearance({ theme: "glass" }).apply()
  expect(dark()).toBe(true)
  expect(html.getAttribute("data-theme")).toBe("glass")
})
