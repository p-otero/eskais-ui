import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { Appearance, createAppearance } from "@/components/ui/appearance"

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
const editorText = () => document.querySelector("[data-slot=theme-editor]")?.textContent ?? ""

function renderEditor(store: ThemeEditorStore = createThemeEditorStore({ storageKey: key })) {
  const appearance = createAppearance({ palette: "neutral", palettes })
  return {
    store,
    appearance,
    ...render(
      <Appearance appearance={appearance}>
        <ThemeEditor appearance={appearance} palettes={palettes} store={store} />
      </Appearance>,
    ),
  }
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
  html.removeAttribute("data-density")
  html.removeAttribute("data-radius")
  html.removeAttribute("data-theme")
  document.getElementById("theme-editor-glass")?.remove()
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
  localStorage.setItem(key, JSON.stringify({ brand: 12, linkBrand: "url(evil)", tint: 0.01, radius: 0.5 }))
  expect(createThemeEditorStore({ storageKey: key }).get()).toEqual({ tint: 0.01 })
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

test("density and corner radius are separate choices on <html>, in the CSS, and Reset clears both", async () => {
  const user = userEvent.setup()
  renderEditor()
  await settle()
  expect(editorText()).toContain("--radius:")
  await user.click(screen.getByRole("radio", { name: "Compact" }))
  expect(html.getAttribute("data-density")).toBe("compact")
  expect(html.hasAttribute("data-radius")).toBe(false)
  await user.click(screen.getByRole("radio", { name: "Small" }))
  expect(html.getAttribute("data-radius")).toBe("sm")
  expect(html.getAttribute("data-density")).toBe("compact")
  expect(editorText()).toContain('On <html>: data-density="compact" data-radius="sm"')
  expect(editorText()).not.toContain("--radius:")
  await user.click(screen.getByRole("button", { name: "Reset" }))
  expect(html.hasAttribute("data-density")).toBe(false)
  expect(html.hasAttribute("data-radius")).toBe(false)
})

test("an agent sets the density and the radius by their labels", async () => {
  renderEditor()
  await settle()
  const labels = agent.snapshot().map((entry) => entry.label)
  expect(labels).toEqual(expect.arrayContaining(["Density", "Corner radius"]))
  const result = await act(() =>
    agent.act({
      steps: [
        { ref: "Density", action: "setValue", args: ["compact"] },
        { ref: "Corner radius", action: "setValue", args: ["none"] },
      ],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(html.getAttribute("data-density")).toBe("compact")
  expect(html.getAttribute("data-radius")).toBe("none")
})

test("glass turns on for the whole page, its strength is a rule on glass scopes, and both reach the CSS", async () => {
  const user = userEvent.setup()
  const { appearance } = renderEditor()
  await settle()
  expect(screen.queryByRole("slider", { name: "Glass strength" })).toBeNull()
  await user.click(screen.getByRole("switch", { name: "Glass" }))
  expect(html.getAttribute("data-theme")).toBe("glass")
  expect(editorText()).toContain('On <html>: data-theme="glass"')
  expect(editorText()).toContain("--glass-opacity: 60%;")
  const strength = screen.getByRole("slider", { name: "Glass strength" })
  expect((strength as HTMLInputElement).value).toBe("40")
  strength.focus()
  await user.keyboard("{ArrowRight}{ArrowRight}")
  const rule = document.getElementById("theme-editor-glass")?.textContent
  expect(rule).toBe('[data-theme="glass"] { --glass-opacity: 50%; --glass-blur: 25px; }')
  expect(html.style.getPropertyValue("--glass-opacity")).toBe("")
  expect(editorText()).toContain("--glass-blur: 25px;")
  expect(JSON.parse(localStorage.getItem(key) ?? "{}")).toEqual({ glass: 50 })

  await user.click(screen.getByRole("switch", { name: "Glass" }))
  expect(appearance.theme.get().value).toBe("default")
  expect(editorText()).not.toContain("--glass-opacity")
  await user.click(screen.getByRole("switch", { name: "Glass" }))
  await user.click(screen.getByRole("button", { name: "Reset" }))
  expect(html.hasAttribute("data-theme")).toBe(false)
  expect(document.getElementById("theme-editor-glass")).toBeNull()
})

test("picking a preset keeps the glass strength", async () => {
  const user = userEvent.setup()
  const { store } = renderEditor()
  await settle()
  act(() => store.set({ glass: 70, brand: "oklch(0.5 0.1 140)" }))
  await user.click(screen.getByRole("radio", { name: "Blue" }))
  expect(store.get()).toEqual({ glass: 70 })
})

test("an agent turns glass on and sets its strength", async () => {
  const { store } = renderEditor()
  await settle()
  const on = await act(() => agent.act({ steps: [{ ref: "Glass", action: "toggle" }] }))
  expect(on.ok, on.error?.message).toBe(true)
  expect(html.getAttribute("data-theme")).toBe("glass")
  await settle()
  const set = await act(() => agent.act({ steps: [{ ref: "Glass strength", action: "setValue", args: [80] }] }))
  expect(set.ok, set.error?.message).toBe(true)
  expect(store.get().glass).toBe(80)
})
