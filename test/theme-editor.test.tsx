import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test } from "vitest"

import { createAppearance } from "@/components/ui/appearance"

import { ThemeEditor } from "../apps/showcase/src/theme-editor"

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

function renderEditor() {
  const appearance = createAppearance({ palette: "neutral", palettes })
  return render(<ThemeEditor appearance={appearance} palettes={palettes} />)
}

afterEach(() => {
  cleanup()
  html.removeAttribute("style")
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
