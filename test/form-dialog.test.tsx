import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { FormField, FormServerError } from "@/components/ui/form"
import { FormDialog, type FormDialogProps } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"

import { axeViolations } from "./axe"

const agent = createAgent()

const schema = z.object({ name: z.string().min(3), owner: z.email() })

function ProjectDialog(props: Partial<FormDialogProps<typeof schema>>) {
  return (
    <FormDialog
      schema={schema}
      defaultValues={{ name: "", owner: "" }}
      trigger="New project"
      title="Create project"
      description="It starts on the free plan."
      submitLabel="Create"
      cancelLabel="Cancel"
      onSubmit={() => {}}
      {...props}
    >
      <FormField name="name" label="Project name">
        <Input />
      </FormField>
      <FormField name="owner" label="Owner email">
        <Input type="email" />
      </FormField>
    </FormDialog>
  )
}

async function rejectOwner() {
  throw new FormServerError("", { owner: "Already owns a project." })
}

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atlas")
  await user.type(screen.getByRole("textbox", { name: "Owner email" }), "ada@example.com")
}

test("closes on success and returns focus to the trigger", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ProjectDialog onSubmit={onSubmit} />)
  const trigger = screen.getByRole("button", { name: "New project" })
  await user.click(trigger)
  const dialog = screen.getByRole("dialog", { name: "Create project" })
  expect(await axeViolations(dialog)).toEqual([])
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Create" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onSubmit).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})

test("Escape and outside presses are blocked while pending; one submit runs", async () => {
  const user = userEvent.setup()
  let finish!: () => void
  const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
  render(<ProjectDialog onSubmit={onSubmit} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.keyboard("{Enter}")
  const create = screen.getByRole("button", { name: "Create" })
  await waitFor(() => expect(create.getAttribute("aria-busy")).toBe("true"))
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy()
  await user.click(create)
  create.closest("form")!.requestSubmit()
  expect(onSubmit).toHaveBeenCalledTimes(1)
  finish()
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

test("a server error keeps it open with the error on its field", async () => {
  const user = userEvent.setup()
  render(<ProjectDialog onSubmit={rejectOwner} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Create" }))
  const owner = screen.getByRole("textbox", { name: "Owner email" })
  await waitFor(() => expect(document.activeElement).toBe(owner))
  expect(screen.getByText("Already owns a project.")).toBeTruthy()
  expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy()
})

test("unsaved changes ask before closing; keep editing keeps the values", async () => {
  const user = userEvent.setup()
  render(
    <ProjectDialog confirmDiscard="Discard this project?" discardLabel="Discard" keepEditingLabel="Keep editing" />,
  )
  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atl")
  await user.keyboard("{Escape}")
  const ask = await screen.findByRole("alertdialog", { name: "Discard this project?" })
  await user.click(screen.getByRole("button", { name: "Keep editing" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("Atl")
  void ask

  await user.click(screen.getByRole("button", { name: "Cancel" }))
  await screen.findByRole("alertdialog", { name: "Discard this project?" })
  await user.click(screen.getByRole("button", { name: "Discard" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

const reviewStep = {
  editLabel: "Edit details",
  confirmLabel: "Create for real",
  render: (values: z.output<typeof schema>) => (
    <dl>
      <dt>Project</dt>
      <dd>{values.name}</dd>
      <dt>Owner</dt>
      <dd>{values.owner}</dd>
    </dl>
  ),
}

test("review step: submit validates and reviews, edit keeps values, confirm submits", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ProjectDialog onSubmit={onSubmit} submitLabel="Review" reviewStep={reviewStep} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.click(screen.getByRole("button", { name: "Review" }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Project name" })))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Review" }))
  expect(await screen.findByText("ada@example.com")).toBeTruthy()
  expect(onSubmit).not.toHaveBeenCalled()

  await user.click(screen.getByRole("button", { name: "Edit details" }))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("Atlas")
  await user.click(screen.getByRole("button", { name: "Review" }))
  await user.click(await screen.findByRole("button", { name: "Create for real" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ name: "Atlas", owner: "ada@example.com" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

test("review step: a field error from the server returns to the fields", async () => {
  const user = userEvent.setup()
  render(<ProjectDialog onSubmit={rejectOwner} submitLabel="Review" reviewStep={reviewStep} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Review" }))
  await user.click(await screen.findByRole("button", { name: "Create for real" }))
  expect(await screen.findByText("Already owns a project.")).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Owner email" })))
})

test("an agent opens it, fills it and confirms the review", async () => {
  const onSubmit = vi.fn()
  render(<ProjectDialog onSubmit={onSubmit} submitLabel="Review" reviewStep={reviewStep} />)
  const opened = await agent.act({ steps: [{ ref: "New project", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const result = await agent.act({
    steps: [
      { ref: "Project name", action: "setValue", args: ["Atlas"] },
      { ref: "Owner email", action: "setValue", args: ["ada@example.com"] },
      { ref: "Review", action: "press" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await screen.findByRole("button", { name: "Create for real" })
  const confirmed = await agent.act({ steps: [{ ref: "Create for real", action: "press" }] })
  expect(confirmed.ok, confirmed.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
})

const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

test("onOpenChange and onOpenChangeComplete say why it closed", async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  const onOpenChangeComplete = vi.fn()
  render(<ProjectDialog onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete} />)
  const reasons = () => onOpenChange.mock.calls.map(([open, details]) => `${open}:${details.reason}`)
  const open = async () => {
    await user.click(screen.getByRole("button", { name: "New project" }))
    await screen.findByRole("dialog", { name: "Create project" })
  }

  await open()
  await user.keyboard("{Escape}")
  await closed()
  await waitFor(() =>
    expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape" })),
  )

  await open()
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  await closed()

  await open()
  await user.click(document.querySelector<HTMLElement>('[data-slot="dialog-backdrop"]')!)
  await closed()

  await open()
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Create" }))
  await closed()
  await waitFor(() =>
    expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "submit" })),
  )

  expect(reasons()).toEqual([
    "true:trigger",
    "false:escape",
    "true:trigger",
    "false:cancel",
    "true:trigger",
    "false:outside",
    "true:trigger",
    "false:submit",
  ])
  expect(onOpenChange.mock.calls[1]?.[1].dialogReason).toBe("escape-key")
})

test("closing after confirmDiscard keeps the reason that asked", async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  render(<ProjectDialog confirmDiscard="Discard this project?" onOpenChange={onOpenChange} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atl")
  await user.keyboard("{Escape}")
  await screen.findByRole("alertdialog", { name: "Discard this project?" })
  await user.click(screen.getByRole("button", { name: "Discard" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape" }))
})

test("review step: prepare runs pending before the review and its values reach onSubmit", async () => {
  const user = userEvent.setup()
  let finish!: (result: { values: z.output<typeof schema> }) => void
  const prepare = vi.fn(() => new Promise<{ values: z.output<typeof schema> }>((resolve) => (finish = resolve)))
  const onSubmit = vi.fn()
  render(<ProjectDialog onSubmit={onSubmit} submitLabel="Review" reviewStep={{ ...reviewStep, prepare }} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Review" }))
  const review = screen.getByRole("button", { name: "Review" })
  await waitFor(() => expect(review.getAttribute("aria-busy")).toBe("true"))
  expect(prepare).toHaveBeenCalledWith({ name: "Atlas", owner: "ada@example.com" })
  finish({ values: { name: "Atlas (EU)", owner: "ada@example.com" } })
  expect(await screen.findByText("Atlas (EU)")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Create for real" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ name: "Atlas (EU)", owner: "ada@example.com" })
})

test("review step: prepare errors stay on the fields or the root error", async () => {
  const user = userEvent.setup()
  const prepare = vi
    .fn()
    .mockResolvedValueOnce({ error: { fieldErrors: { owner: "Not on this team." } } })
    .mockResolvedValueOnce({ error: { message: "Pricing is unavailable." } })
  render(<ProjectDialog submitLabel="Review" reviewStep={{ ...reviewStep, prepare }} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Review" }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Owner email" })))
  expect(screen.getByText("Not on this team.")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Review" }))
  expect(await screen.findByText("Pricing is unavailable.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Create for real" })).toBeNull()
})

test("review step: editable hides Edit, a title follows the step", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockRejectedValue(new Error("Delivery failed."))
  render(
    <ProjectDialog
      onSubmit={onSubmit}
      submitLabel="Review"
      reviewStep={{
        ...reviewStep,
        title: (step) => (step === "review" ? "Check the project" : "Create project"),
        editable: (state) => state.error === undefined,
      }}
    />,
  )
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Review" }))
  expect(await screen.findByRole("dialog", { name: "Check the project" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Edit details" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Create for real" }))
  expect(await screen.findByText("Delivery failed.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull()

  cleanup()
  render(<ProjectDialog submitLabel="Review" reviewStep={{ ...reviewStep, editable: false }} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await fill(user)
  await user.click(screen.getByRole("button", { name: "Review" }))
  await screen.findByRole("button", { name: "Create for real" })
  expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull()
  expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy()
})
