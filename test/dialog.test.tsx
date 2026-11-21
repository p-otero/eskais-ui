import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const agent = createAgent()

function RenameDialog(props: { dismissible?: boolean; onDismissAttempt?: () => void }) {
  return (
    <Dialog {...props}>
      <DialogTrigger>Rename project</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Apollo</DialogTitle>
          <DialogDescription>Everyone on the team sees the new name.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Project name</FieldLabel>
          <Input defaultValue="Apollo" />
        </Field>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose variant="default" value="save">
            Save
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

test("opens named and described, and Escape returns focus to the trigger", async () => {
  const user = userEvent.setup()
  render(<RenameDialog />)
  const trigger = screen.getByRole("button", { name: "Rename project" })
  expect(trigger.className).toContain("border-input")

  await user.click(trigger)
  const dialog = screen.getByRole("dialog", { name: "Rename Apollo" })
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy()
  expect(dialog.querySelector('[data-slot="dialog-header"]')).not.toBeNull()

  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("each close button closes the dialog", async () => {
  const user = userEvent.setup()
  render(<RenameDialog />)
  for (const name of ["Cancel", "Save"]) {
    await user.click(screen.getByRole("button", { name: "Rename project" }))
    await user.click(screen.getByRole("button", { name }))
    expect(screen.queryByRole("dialog")).toBeNull()
  }
})

test("a non-dismissible dialog refuses Escape and reports the attempt", async () => {
  const user = userEvent.setup()
  const onDismissAttempt = vi.fn()
  render(<RenameDialog dismissible={false} onDismissAttempt={onDismissAttempt} />)
  await user.click(screen.getByRole("button", { name: "Rename project" }))
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog", { name: "Rename Apollo" })).toBeTruthy()
  expect(onDismissAttempt).toHaveBeenCalledTimes(1)
})

test("an agent can open the dialog and edit its field", async () => {
  render(<RenameDialog />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const opened = await agent.act({ steps: [{ ref: "Rename project", action: "open" }] })
  expect(opened.ok, opened.error?.message).toBe(true)

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Project name")

  const result = await agent.act({ steps: [{ ref: "Project name", action: "setValue", args: ["Atlas"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("Atlas")
})

function SizedDialog({ size, sheet }: { size?: "sm" | "md" | "lg" | "xl" | "full"; sheet?: boolean }) {
  return (
    <Dialog defaultOpen>
      <DialogBackdrop />
      <DialogContent size={size} sheet={sheet}>
        <DialogHeader>
          <DialogTitle>Sized</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p>Body</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

test("sizes set the width; md is the default; the body scrolls between a header and footer that don't shrink", () => {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-6xl", full: "max-w-none" } as const
  for (const [size, width] of Object.entries(widths) as [keyof typeof widths, string][]) {
    const { unmount } = render(<SizedDialog size={size} />)
    const dialog = screen.getByRole("dialog", { name: "Sized" })
    expect(dialog.getAttribute("data-size")).toBe(size)
    expect(dialog.className).toContain(width)
    expect(dialog.className).toContain("wrap-anywhere")
    expect(dialog.className).not.toMatch(/\d+d?vh\b|h-screen/)
    unmount()
  }
  render(<SizedDialog />)
  const dialog = screen.getByRole("dialog", { name: "Sized" })
  expect(dialog.getAttribute("data-size")).toBe("md")
  expect(dialog.querySelector('[data-slot="dialog-body"]')?.parentElement?.dataset.slot).toBe("scroll-area")
  expect(dialog.querySelector('[data-slot="dialog-header"]')?.className).toContain("shrink-0")
  expect(dialog.querySelector('[data-slot="dialog-footer"]')?.className).toContain("shrink-0")
})

test("on narrow screens it is a bottom sheet unless sheet={false}", () => {
  const { unmount } = render(<SizedDialog />)
  const sheet = screen.getByRole("dialog", { name: "Sized" })
  expect(sheet.hasAttribute("data-sheet")).toBe(true)
  expect(sheet.className).toContain("narrow:rounded-b-none")
  unmount()
  render(<SizedDialog sheet={false} />)
  const centered = screen.getByRole("dialog", { name: "Sized" })
  expect(centered.hasAttribute("data-sheet")).toBe(false)
  expect(centered.className).not.toContain("narrow:")
})

test("while the on-screen keyboard is up, the content and the sheet fit above it", () => {
  render(<SizedDialog />)
  const sheet = screen.getByRole("dialog", { name: "Sized" })
  // The visible part is cut to the containing block: a stale `offsetTop` with the full height can't push it below.
  expect(sheet.className).toContain("narrow:bottom-[max(0px,100%-var(--dialog-viewport-bottom,100%))]")
  expect(sheet.className).toContain("data-dialog-keyboard:bottom-[max(0px,100%-var(--dialog-viewport-bottom,100%))]")
  // Centered, its top is the middle of the visible part, cut the same way.
  expect(sheet.className).toContain(
    "top-[calc((clamp(0px,var(--dialog-viewport-top,0px),100%-var(--dialog-viewport-height,100%))+min(100%,var(--dialog-viewport-bottom,100%)))/2)]",
  )
  expect(sheet.className).toContain("data-dialog-keyboard:top-auto")
  expect(sheet.className).toContain("max-h-[min(var(--dialog-max-height),calc(var(--dialog-viewport-height,100%)")
  expect(sheet.className).toContain("narrow:max-h-[min(var(--sheet-max-height),calc(var(--dialog-viewport-height,100%)")
  expect(sheet.className).toContain("env(safe-area-inset-bottom)")
})

test("the content is placed from one edge with an auto height, never an intrinsic height between two", () => {
  render(<SizedDialog />)
  const sheet = screen.getByRole("dialog", { name: "Sized" })
  // Safari 26 sizes a fixed box with an intrinsic height from its column flex children's `flex-basis: 0%`, which cut
  // a FormDialog and a StepDialog down to their header (`node tooling/dialog-mobile-check.mjs --engine=webkit26`).
  expect(sheet.className).not.toMatch(/(^|\s|:)(h|size)-(fit|max|min)(\s|$)|inset-0|(^|\s)m-auto/)
  expect(sheet.className).toContain("inset-x-0")
  expect(sheet.className).toContain("-translate-y-1/2")
  expect(sheet.className).toContain("narrow:translate-y-0")
})

test("stays in the visible part of the page, and takes it for the keyboard only while a field is focused", async () => {
  // iOS Safari's toolbars shorten the visual viewport with no keyboard, and its innerHeight can be stale.
  const viewport = Object.assign(new EventTarget(), {
    width: innerWidth,
    height: innerHeight - 90,
    offsetTop: 0,
    scale: 1,
  })
  vi.stubGlobal("visualViewport", viewport)
  try {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Notes</DialogTitle>
          <Field>
            <FieldLabel>Note</FieldLabel>
            <Input />
          </Field>
        </DialogContent>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Notes" })
    await frame()
    act(() => dialog.focus())
    expect(dialog.style.getPropertyValue("--dialog-viewport-bottom")).toBe(`${String(innerHeight - 90)}px`)
    expect(dialog.style.getPropertyValue("--dialog-viewport-height")).toBe(`${String(innerHeight - 90)}px`)
    expect(dialog.hasAttribute("data-dialog-keyboard")).toBe(false)

    viewport.offsetTop = 40
    act(() => viewport.dispatchEvent(new Event("scroll")))
    expect(dialog.style.getPropertyValue("--dialog-viewport-top")).toBe("40px")
    expect(dialog.style.getPropertyValue("--dialog-viewport-bottom")).toBe(`${String(innerHeight - 50)}px`)

    act(() => screen.getByRole("textbox", { name: "Note" }).focus())
    expect(dialog.hasAttribute("data-dialog-keyboard")).toBe(true)

    // Pinch-zoomed, it stays on the box it had instead of chasing the zoom.
    viewport.scale = 2
    viewport.height = (innerHeight - 90) / 2
    viewport.offsetTop = 200
    act(() => viewport.dispatchEvent(new Event("resize")))
    expect(dialog.style.getPropertyValue("--dialog-viewport-top")).toBe("40px")
    expect(dialog.style.getPropertyValue("--dialog-viewport-bottom")).toBe(`${String(innerHeight - 50)}px`)
    expect(dialog.hasAttribute("data-dialog-keyboard")).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})

const frame = () => act(() => new Promise((done) => requestAnimationFrame(() => done(undefined))))

test("a field focused when the keyboard comes up is scrolled back into view", async () => {
  // A visual viewport as phones report it: the keyboard shortens it, the layout viewport (innerHeight) stays.
  const viewport = Object.assign(new EventTarget(), { width: innerWidth, height: innerHeight, offsetTop: 0, scale: 1 })
  vi.stubGlobal("visualViewport", viewport)
  const scrolled = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {})
  try {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Notes</DialogTitle>
          <DialogBody>
            <Field>
              <FieldLabel>Note</FieldLabel>
              <Input />
            </Field>
          </DialogBody>
        </DialogContent>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Notes" })
    const field = screen.getByRole("textbox", { name: "Note" })
    act(() => field.focus())

    viewport.dispatchEvent(new Event("resize"))
    await frame()
    expect(scrolled).not.toHaveBeenCalled()

    viewport.height = innerHeight - 300
    viewport.dispatchEvent(new Event("resize"))
    await frame()
    expect(dialog.hasAttribute("data-keyboard")).toBe(true)
    expect(dialog.style.getPropertyValue("--keyboard-inset")).toBe("300px")
    expect(scrolled).toHaveBeenCalledTimes(1)
    expect(scrolled.mock.contexts[0]).toBe(field)
  } finally {
    scrolled.mockRestore()
    vi.unstubAllGlobals()
  }
})

test("a scroll of the locked page while the dialog is open is put back", () => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  const scrollY = vi.spyOn(window, "scrollY", "get").mockReturnValue(0)
  try {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Still</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    expect(screen.getByRole("dialog", { name: "Still" }).hasAttribute("data-open")).toBe(true)
    document.documentElement.style.overflow = "hidden"
    scrollY.mockReturnValue(140)
    window.dispatchEvent(new Event("scroll"))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  } finally {
    document.documentElement.style.overflow = ""
    scrollTo.mockRestore()
    scrollY.mockRestore()
  }
})
