import { render, screen, waitFor } from "@testing-library/react"
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
