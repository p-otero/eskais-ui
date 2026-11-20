import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { DialogTrigger } from "@ui-sdk/react/dialog"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Lightbox, type LightboxItem } from "@/components/ui/lightbox"
import { lightbox } from "@/components/ui/lightbox-primitive"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

const items: LightboxItem[] = [
  { id: "a", src: "/a.png", srcDark: "/a-dark.png", alt: "Settings page, light", name: "settings.png" },
  { id: "b", src: "/b.png", alt: "Error state of the import form", name: "import-error.png", href: "/b-full.png" },
  { id: "c", src: "/c.png", alt: "Mobile layout" },
]

function Opened({ onIndexChange }: { onIndexChange?: (index: number) => void }) {
  return (
    <Lightbox items={items} defaultOpen onIndexChange={(index) => onIndexChange?.(index)}>
      <DialogTrigger>View screenshots</DialogTrigger>
    </Lightbox>
  )
}

test("primitive: steps within its range and arrow keys follow the reading direction", async () => {
  const onIndexChange = vi.fn()
  const view = mount(lightbox, { index: 0, count: 3, onIndexChange }, `<root tabindex="0"></root>`)
  try {
    expect(view.api.previous()).toBe(false)
    await view.keys("Tab", "ArrowRight")
    expect(onIndexChange).toHaveBeenCalledWith(1, expect.objectContaining({ reason: "list-navigation" }))
    expect(() => view.api.goTo(7)).toThrow(RangeError)
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(lightbox, { index: 1, count: 3 }, `<root aria-label="Image viewer"></root>`)
})

test("shows one image with its caption, counter and original link", async () => {
  render(<Opened />)
  const dialog = await screen.findByRole("dialog", { name: "settings.png" })
  expect(dialog.textContent).toContain("1 / 3")
  expect(dialog.textContent).toContain("Settings page, light")
  expect(screen.getByRole("link", { name: "Open original" }).getAttribute("href")).toBe("/a.png")
  const images = dialog.querySelectorAll("img")
  expect([...images].map((image) => image.getAttribute("src"))).toEqual(["/a.png", "/a-dark.png"])
  expect(await axeViolations(dialog)).toEqual([])
})

test("previous and next buttons, arrow keys and the zoom toggle", async () => {
  const user = userEvent.setup()
  const onIndexChange = vi.fn()
  render(<Opened onIndexChange={onIndexChange} />)
  await screen.findByRole("dialog")

  await user.click(screen.getByRole("button", { name: "Next image" }))
  expect(screen.getByRole("dialog", { name: "import-error.png" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Open original" }).getAttribute("href")).toBe("/b-full.png")

  await user.keyboard("{ArrowRight}")
  expect(screen.getByRole("dialog", { name: "Mobile layout" }).textContent).toContain("3 / 3")
  expect(screen.getByRole("button", { name: "Next image" }).getAttribute("aria-disabled")).toBe("true")

  await user.keyboard("{ArrowLeft}")
  expect(onIndexChange.mock.calls.map(([index]) => index)).toEqual([1, 2, 1])

  const zoom = screen.getByRole("button", { name: "Actual size" })
  await user.click(zoom)
  expect(zoom.getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("dialog").querySelector("[data-zoom]")?.getAttribute("data-zoom")).toBe("actual")
})

function Thumbs() {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  return (
    <>
      {items.map((item, position) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            setIndex(position)
            setOpen(true)
          }}
        >
          Open {item.alt}
        </button>
      ))}
      <Lightbox items={items} index={index} onIndexChange={setIndex} open={open} onOpenChange={setOpen} />
    </>
  )
}

test("focus returns to the thumbnail that opened it", async () => {
  const user = userEvent.setup()
  render(<Thumbs />)
  const thumb = screen.getByRole("button", { name: "Open Mobile layout" })
  await user.click(thumb)
  await screen.findByRole("dialog", { name: "Mobile layout" })
  await user.keyboard("{Escape}")
  await settle(50)
  expect(document.activeElement).toBe(thumb)
})

test("an agent can page through the images", async () => {
  render(<Opened />)
  await screen.findByRole("dialog")
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const viewer = components.find((entry) => entry.component === "lightbox")
  expect(viewer?.label).toBe("Image viewer")
  expect(viewer?.actions).toEqual(expect.arrayContaining(["next", "previous", "goTo"]))

  let result = await agent.act({ steps: [{ ref: "Image viewer", action: "next" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("dialog", { name: "import-error.png" })).toBeTruthy()

  result = await agent.act({ steps: [{ ref: "Image viewer", action: "goTo", args: [2] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("dialog", { name: "Mobile layout" })).toBeTruthy()

  result = await agent.act({ steps: [{ ref: "Image viewer", action: "previous" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("dialog", { name: "import-error.png" })).toBeTruthy()
})

test("fills the screen on a phone instead of becoming a sheet that fits its content", () => {
  render(<Opened />)
  const dialog = screen.getByRole("dialog")
  expect(dialog.className).toContain("h-[min(var(--dialog-max-height),")
  expect(dialog.className).not.toMatch(/narrow:h-fit|narrow:top-auto/)
  expect(dialog.hasAttribute("data-sheet")).toBe(false)
})
