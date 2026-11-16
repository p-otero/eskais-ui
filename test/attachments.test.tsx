import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { AttachmentStrip, AttachmentThumb, formatFileSize, type Attachment } from "@/components/ui/attachments"
import { attachments as attachmentsPrimitive } from "@/components/ui/attachments-primitive"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

const files: Attachment[] = [
  {
    id: "shot-1",
    kind: "image",
    name: "checkout.png",
    src: "/checkout.png",
    srcDark: "/checkout-dark.png",
    thumbnail: "/checkout-thumb.png",
    thumbnailDark: "/checkout-thumb-dark.png",
    alt: "Checkout page with the new address form",
  },
  { id: "shot-2", kind: "image", name: "receipt.png", src: "/receipt.png", alt: "Receipt email" },
  {
    id: "log",
    kind: "file",
    name: "build-log.txt",
    src: "/build-log.txt",
    href: "/build-log.txt",
    alt: "",
    size: 48_213,
    mimeType: "text/plain",
  },
  { id: "spec", kind: "file", name: "spec.pdf", src: "/spec.pdf", href: "/spec.pdf", alt: "", size: 2_400_000 },
]

test("formats sizes with the locale's unit words", () => {
  expect(formatFileSize(512, "en")).toBe("512 byte")
  expect(formatFileSize(48_213, "en")).toBe("48.2 kB")
  expect(formatFileSize(2_400_000, "de")).toBe("2,4 MB")
})

test("primitive: opening an unknown id lists the real ones, and onOpen can cancel", () => {
  const open = vi.fn()
  const view = mount(
    attachmentsPrimitive,
    { attachments: files, open, onOpen: (_attachment, details) => details.cancel() },
    `<root aria-label="Files"></root>`,
  )
  try {
    expect(() => view.api.openAttachment("nope")).toThrow(/shot-1, shot-2, log, spec/)
    expect(view.api.openAttachment("log")).toBe(false)
    expect(open).not.toHaveBeenCalled()
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(attachmentsPrimitive, { attachments: files }, `<root aria-label="Files"></root>`)
})

test("renders image thumbnails in both schemes and file chips with type and size", async () => {
  const { container } = render(<AttachmentStrip aria-label="Attachments" attachments={files} locale="en" />)
  const strip = screen.getByRole("group", { name: "Attachments" })
  const thumb = screen.getByRole("button", { name: "Open checkout.png" })
  expect([...thumb.querySelectorAll("img")].map((image) => image.getAttribute("src"))).toEqual([
    "/checkout-thumb.png",
    "/checkout-thumb-dark.png",
  ])
  const log = screen.getByRole("link", { name: /build-log\.txt/ })
  expect(log.getAttribute("href")).toBe("/build-log.txt")
  expect(log.textContent).toContain("TXT · 48.2 kB")
  expect(strip).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("clicking an image opens the lightbox at it, and focus returns to that thumbnail", async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<AttachmentStrip aria-label="Attachments" attachments={files} onOpen={onOpen} />)
  const thumb = screen.getByRole("button", { name: "Open receipt.png" })
  await user.click(thumb)
  expect(await screen.findByRole("dialog", { name: "receipt.png" })).toBeTruthy()
  expect(onOpen).toHaveBeenCalledWith(files[1], expect.objectContaining({ reason: "item-press" }))
  await user.click(screen.getByRole("button", { name: "Previous image" }))
  expect(screen.getByRole("dialog", { name: "checkout.png" })).toBeTruthy()
  await user.keyboard("{Escape}")
  await settle(50)
  expect(document.activeElement).toBe(thumb)
})

test("a cancelled open keeps the link from following", async () => {
  const user = userEvent.setup()
  let defaultPrevented: boolean | undefined
  render(
    <AttachmentStrip
      aria-label="Attachments"
      attachments={files}
      onOpen={(_attachment, details) => details.cancel()}
    />,
  )
  const link = screen.getByRole("link", { name: /spec\.pdf/ })
  // React handles clicks at its root, so read the outcome once the event reaches the document.
  const record = (event: Event) => {
    defaultPrevented = event.defaultPrevented
  }
  document.addEventListener("click", record)
  await user.click(link)
  document.removeEventListener("click", record)
  expect(defaultPrevented).toBe(true)
})

test("max shows a +N button that reveals the rest and focuses the first one", async () => {
  const user = userEvent.setup()
  render(<AttachmentStrip aria-label="Attachments" attachments={files} max={2} size="sm" />)
  expect(screen.queryByRole("link", { name: /build-log/ })).toBeNull()
  const more = screen.getByRole("button", { name: "Show 2 more attachments" })
  expect(more.textContent).toBe("+2")
  await user.click(more)
  expect(document.activeElement).toBe(screen.getByRole("link", { name: /build-log/ }))
})

test("a thumbnail on its own is static without onOpen", () => {
  render(<AttachmentThumb attachment={files[1]!} />)
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.getByRole("img", { name: "Receipt email" })).toBeTruthy()
})

test("an agent can open an attachment by id", async () => {
  const open = vi.spyOn(globalThis, "open").mockReturnValue(null)
  render(<AttachmentStrip aria-label="Attachments" attachments={files} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const strip = components.find((entry) => entry.component === "attachments")
  expect(strip?.label).toBe("Attachments")
  expect(strip?.actions).toContain("openAttachment")

  let result = await agent.act({ steps: [{ ref: "Attachments", action: "openAttachment", args: ["shot-2"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(await screen.findByRole("dialog", { name: "receipt.png" })).toBeTruthy()
  await userEvent.keyboard("{Escape}")
  await settle(50)

  result = await agent.act({ steps: [{ ref: "Attachments", action: "openAttachment", args: ["spec"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(open).toHaveBeenCalledWith("/spec.pdf", "_blank", "noopener,noreferrer")
  open.mockRestore()
})
