import { act, render } from "@testing-library/react"
import { createLocalStorage } from "@ui-sdk/core"
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
  html.removeAttribute("data-palette")
  html.removeAttribute("data-color-scheme")
  html.removeAttribute("data-density")
  html.removeAttribute("data-radius")
  localStorage.clear()
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

test("the palette sets data-palette on <html>, and default leaves it off", () => {
  const appearance = createAppearance({ palette: "blue" })
  render(<Appearance appearance={appearance} />)
  expect(html.getAttribute("data-palette")).toBe("blue")
  act(() => void appearance.palette.set("orange"))
  expect(html.getAttribute("data-palette")).toBe("orange")
  act(() => void appearance.palette.set("default"))
  expect(html.hasAttribute("data-palette")).toBe(false)
})

test("apply() writes the choice synchronously, before anything renders", () => {
  prefersDark(true)
  createAppearance({ theme: "glass" }).apply()
  expect(dark()).toBe(true)
  expect(html.getAttribute("data-theme")).toBe("glass")
})

test("apply() marks an explicit light choice, which opts out of the CSS dark fallback", () => {
  prefersDark(true)
  const appearance = createAppearance({ colorScheme: "light" })
  appearance.apply()
  expect(dark()).toBe(false)
  expect(html.getAttribute("data-color-scheme")).toBe("light")
  act(() => void appearance.colorScheme.set("system"))
  appearance.apply()
  expect(dark()).toBe(true)
  expect(html.getAttribute("data-color-scheme")).toBe("system")
})

test("density and radius are two attributes on <html>, each set on its own, and default leaves them off", () => {
  const appearance = createAppearance({ density: "compact", radius: "sm" })
  render(<Appearance appearance={appearance} />)
  expect(html.getAttribute("data-density")).toBe("compact")
  expect(html.getAttribute("data-radius")).toBe("sm")
  act(() => void appearance.radius.set("full"))
  expect(html.getAttribute("data-density")).toBe("compact")
  expect(html.getAttribute("data-radius")).toBe("full")
  act(() => void appearance.density.set("default"))
  expect(html.hasAttribute("data-density")).toBe(false)
  expect(html.getAttribute("data-radius")).toBe("full")
  act(() => void appearance.radius.set("default"))
  expect(html.hasAttribute("data-radius")).toBe(false)
})

test("density and radius are kept between visits, and a value that isn't a step is ignored", () => {
  const storage = { density: createLocalStorage("test-density"), radius: createLocalStorage("test-radius") }
  const first = createAppearance({ storage })
  act(() => void first.density.set("compact"))
  act(() => void first.radius.set("none"))
  createAppearance({ storage }).apply()
  expect(html.getAttribute("data-density")).toBe("compact")
  expect(html.getAttribute("data-radius")).toBe("none")
  localStorage.setItem("test-radius", "huge")
  html.removeAttribute("data-radius")
  createAppearance({ storage }).apply()
  expect(html.hasAttribute("data-radius")).toBe(false)
})
