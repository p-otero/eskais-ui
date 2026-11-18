import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { FileInput, FileInputFiles, FileInputTrigger, FileUpload, formatFileSize } from "@/components/ui/file-input"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const pdf = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type: "application/pdf" })
const fileInputOf = (container: HTMLElement) => container.querySelector<HTMLInputElement>("input[type=file]")!

function Upload({ onValueChange }: { onValueChange?: (files: File[]) => void }) {
  return (
    <Field>
      <FieldLabel>Contracts</FieldLabel>
      <FileUpload
        multiple
        accept=".pdf"
        maxSize={2000}
        maxFiles={2}
        title="Drop contracts here"
        description="PDF, up to 2 kB"
        browseLabel="Browse"
        onValueChange={onValueChange}
      />
      <FieldDescription>Signed copies only.</FieldDescription>
    </Field>
  )
}

test("the field label names the trigger, and picked files show as chips with named remove buttons", async () => {
  const user = userEvent.setup({ applyAccept: false, pointerEventsCheck: 0 })
  const onValueChange = vi.fn()
  const { container } = render(<Upload onValueChange={onValueChange} />)
  expect(screen.getByRole("button", { name: /^Contracts/ }).textContent).toBe("Browse")
  await user.upload(fileInputOf(container), [pdf("lease.pdf", 1500)])
  const list = screen.getByRole("list", { name: "Files" })
  expect(within(list).getByText("lease.pdf")).toBeTruthy()
  expect(within(list).getByText(/^PDF · /)).toBeTruthy()
  expect(onValueChange).toHaveBeenLastCalledWith([expect.any(File)], expect.objectContaining({ reason: "picker" }))
  await user.click(screen.getByRole("button", { name: "Remove lease.pdf", hidden: true }))
  expect(screen.queryByText("lease.pdf")).toBeNull()
})

test("rejected files say why in the destructive tone and mark the drop zone", async () => {
  const user = userEvent.setup({ applyAccept: false, pointerEventsCheck: 0 })
  const { container } = render(<Upload />)
  await user.upload(fileInputOf(container), [
    pdf("big.pdf", 5000),
    new File(["x"], "notes.txt", { type: "text/plain" }),
  ])
  const rejections = container.querySelector("[data-slot=file-input-rejections]")!
  expect(rejections.textContent).toContain("big.pdf is larger than 2 kB.")
  expect(rejections.textContent).toContain("notes.txt isn't a type of file this accepts.")
  expect(container.querySelector("[data-slot=file-input-dropzone]")?.hasAttribute("data-invalid")).toBe(true)

  await user.upload(fileInputOf(container), [pdf("ok.pdf", 10)])
  expect(container.querySelector("[data-slot=file-input-rejections]")).toBeNull()
})

test("labels translate the list, remove buttons and messages", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  const { container } = render(
    <FileInput multiple>
      <FileInputTrigger>Elegir</FileInputTrigger>
      <FileInputFiles labels={{ list: "Archivos", remove: (name) => `Quitar ${name}` }} />
    </FileInput>,
  )
  await user.upload(fileInputOf(container), [pdf("a.pdf", 1)])
  expect(screen.getByRole("list", { name: "Archivos" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Quitar a.pdf", hidden: true })).toBeTruthy()
  expect(formatFileSize(1536, "en")).toMatch(/1\.5/)
})

test("no axe violations", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  const { container } = render(
    <main>
      <Upload />
    </main>,
  )
  await user.upload(fileInputOf(container), [pdf("lease.pdf", 100)])
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the file input by its label", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  const { container } = render(<Upload />)
  await user.upload(fileInputOf(container), [pdf("lease.pdf", 100)])
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Contracts Browse")
  expect(entry).toBeTruthy()
  // UI SDK 0.1.0-beta.10 drops the actions that would need a File from an agent; clearing stays.
  expect(entry?.actions).toEqual(expect.arrayContaining(["clear"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Contracts Browse", action: "clear" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.queryByText("lease.pdf")).toBeNull()
})
