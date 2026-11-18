import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { createAppearance } from "@/components/ui/appearance"

import { ThemeEditor } from "../apps/showcase/src/theme-editor"
import { createThemeEditorStore, type ThemeEditorStore } from "../apps/showcase/src/theme-editor-store"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)))
const palettes = ["neutral", "blue"] as const
const html = document.documentElement
const linkBrand = () => html.style.getPropertyValue("--link-brand")

window.matchMedia ??= ((media: string) => ({
  matches: false,
  media,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia

const key = "theme-editor-test"

function renderEditor(store: ThemeEditorStore = createThemeEditorStore({ storageKey: key })) {
  const appearance = createAppearance({ palette: "neutral", palettes })
  return { store, appearance, ...render(<ThemeEditor appearance={appearance} palettes={palettes} store={store} />) }
}

async function typeColour(name: string, colour: string) {
  const user = userEvent.setup()
  const field = screen.getByRole("textbox", { name })
  await user.clear(field)
  await user.type(field, `${colour}{Enter}`)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  html.removeAttribute("style")
  html.removeAttribute("data-palette")
})

test("the link colour has an area, a hue slider and a field, like the brand", async () => {
  renderEditor()
  await settle()
  expect(screen.getByRole("slider", { name: "Link chroma and lightness" })).toBeTruthy()
  expect(screen.getByRole("slider", { name: "Link hue" })).toBeTruthy()
  expect(screen.getByRole("slider", { name: "Brand hue" })).toBeTruthy()
  expect(document.querySelectorAll("[data-slot=color-picker-area]")).toHaveLength(2)
})

test("typing a link colour sets --link-brand live and puts it in the CSS", async () => {
  const user = userEvent.setup()
  renderEditor()
  await settle()
  const field = screen.getByRole("textbox", { name: "Link colour in OKLCH" })
  await user.clear(field)
  await user.type(field, "oklch(0.5 0.2 30){Enter}")
  expect(linkBrand()).toBe("oklch(0.5 0.2 30)")
  expect(document.querySelector("[data-slot=theme-editor]")?.textContent).toContain("--link-brand: oklch(0.5 0.2 30)")
})

test("the link hue slider steps --link-brand from the keyboard", async () => {
  const user = userEvent.setup()
  renderEditor()
  await settle()
  const field = screen.getByRole("textbox", { name: "Link colour in OKLCH" })
  await user.clear(field)
  await user.type(field, "oklch(0.6 0.08 200){Enter}")
  expect(linkBrand()).toBe("oklch(0.6 0.08 200)")
  screen.getByRole("slider", { name: "Link hue" }).focus()
  await user.keyboard("{ArrowRight}")
  expect(Number(/ ([\d.]+)\)$/.exec(linkBrand())?.[1])).toBeGreaterThan(200)
})

test("an agent sets the link colour by its label", async () => {
  renderEditor()
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const result = await act(() =>
    agent.act({ steps: [{ ref: "Link colour", action: "setValue", args: ["oklch(0.5 0.1 140)"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(linkBrand()).toBe("oklch(0.5 0.1 140)")
})

test("the choices outlive the editor: they stay on <html> after it unmounts and come back from storage", async () => {
  const { unmount } = renderEditor()
  await settle()
  await typeColour("Brand colour in OKLCH", "oklch(0.5 0.1 140)")
  unmount()
  expect(html.style.getPropertyValue("--brand")).toBe("oklch(0.5 0.1 140)")
  expect(JSON.parse(localStorage.getItem(key) ?? "{}")).toEqual({ brand: "oklch(0.5 0.1 140)" })

  html.removeAttribute("style")
  const next = createThemeEditorStore({ storageKey: key })
  next.apply()
  expect(html.style.getPropertyValue("--brand")).toBe("oklch(0.5 0.1 140)")
  renderEditor(next)
  await settle()
  expect(screen.getByText("Custom")).toBeTruthy()
})

test("Reset returns to the defaults and clears storage", async () => {
  const user = userEvent.setup()
  const { appearance } = renderEditor()
  await settle()
  act(() => void appearance.palette.set("blue"))
  await typeColour("Link colour in OKLCH", "oklch(0.5 0.1 140)")
  await user.click(screen.getByRole("button", { name: "Reset" }))
  expect(linkBrand()).toBe("")
  expect(localStorage.getItem(key)).toBeNull()
  expect(appearance.palette.get().value).toBe("neutral")
})

test("storage that throws or holds junk leaves the editor working", async () => {
  localStorage.setItem(key, "{not json")
  expect(createThemeEditorStore({ storageKey: key }).get()).toEqual({})
  localStorage.setItem(key, JSON.stringify({ brand: 12, linkBrand: "url(evil)", tint: "x", radius: 0.5 }))
  expect(createThemeEditorStore({ storageKey: key }).get()).toEqual({ radius: 0.5 })
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  const store = createThemeEditorStore({ storageKey: key })
  renderEditor(store)
  await settle()
  await typeColour("Link colour in OKLCH", "oklch(0.5 0.1 140)")
  expect(linkBrand()).toBe("oklch(0.5 0.1 140)")
})
