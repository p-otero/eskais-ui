import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { ImageCropper, ImageCropperFlip, ImageCropperRotate } from "@/components/ui/image-cropper"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420'/%3E"

function load() {
  const image = document.querySelector<HTMLImageElement>("[data-slot=image-cropper-image]")!
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: 640 })
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: 420 })
  Object.defineProperty(image, "complete", { configurable: true, value: true })
  fireEvent.load(image)
}

test("the default layout has a selection with eight handles, zoom, rotate and flips named by labels", () => {
  render(<ImageCropper aria-label="Cover photo" src={src} alt="Mountains" aspectRatio={3} />)
  expect(screen.getByRole("group", { name: "Cover photo" })).toBeTruthy()
  expect(document.querySelectorAll("[data-slot=image-cropper-handle]")).toHaveLength(8)
  expect(screen.getByRole("slider", { name: "Zoom" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Rotate" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Flip horizontally" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Flip vertically" })).toBeTruthy()
  expect(screen.getByAltText("Mountains")).toBeTruthy()
})

test("a frame has no handles, and labels translate the buttons", () => {
  render(
    <ImageCropper
      aria-label="Avatar"
      src={src}
      mode="frame"
      shape="circle"
      aspectRatio={1}
      labels={{ rotate: "Girar", flip: "Voltear", flipVertical: "Voltear en vertical", zoom: "Ampliar" }}
    />,
  )
  expect(document.querySelectorAll("[data-slot=image-cropper-handle]")).toHaveLength(0)
  expect(screen.getByRole("button", { name: "Girar" })).toBeTruthy()
  expect(screen.getByRole("slider", { name: "Ampliar" })).toBeTruthy()
})

test("rotating once the image loads reports the turned crop", async () => {
  const user = userEvent.setup()
  const onCropChange = vi.fn()
  render(<ImageCropper aria-label="Photo" src={src} alt="" onCropChange={onCropChange} />)
  load()
  await settle()
  await user.click(screen.getByRole("button", { name: "Rotate" }))
  expect(onCropChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ rotation: 90 }),
    expect.objectContaining({ reason: "rotate-press" }),
  )
})

test("composed rotate and flip parts show an icon and a label", () => {
  render(
    <ImageCropper aria-label="Photo" src={src}>
      <ImageCropperRotate />
      <ImageCropperFlip direction="vertical" />
    </ImageCropper>,
  )
  expect(screen.getByRole("button", { name: "Rotate" }).querySelector("svg")).not.toBeNull()
  expect(screen.getByRole("button", { name: "Flip vertically" })).toBeTruthy()
})

test("no axe violations in a frame", async () => {
  const { container } = render(
    <main>
      <ImageCropper aria-label="Avatar" src={src} alt="Mountains" mode="frame" shape="circle" aspectRatio={1} />
    </main>,
  )
  load()
  await settle()
  expect(await axeViolations(container)).toEqual([])
})

// UI SDK 0.1.0-beta.5 puts the resize handles inside the selection's role="slider": nested-interactive.
test.fails("no axe violations with handles", async () => {
  const { container } = render(
    <main>
      <ImageCropper aria-label="Cover photo" src={src} alt="Mountains" />
    </main>,
  )
  load()
  await settle()
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the cropper by its label", async () => {
  render(<ImageCropper aria-label="Cover photo" src={src} alt="Mountains" />)
  load()
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Cover photo")
  expect(entry?.actions.length).toBeGreaterThan(0)
})
