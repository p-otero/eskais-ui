import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { StepDialog, type StepDialogProps } from "@/components/ui/step-dialog"
import type { FormStep } from "@/components/ui/step-form"

import { axeViolations } from "./axe"

const agent = createAgent()

const schema = z.object({ name: z.string().min(3), region: z.string().min(1) })

type Values = z.input<typeof schema>
type Created = { id: string; name: string }

const steps: FormStep<Values>[] = [
  {
    id: "project",
    title: "Project",
    render: () => (
      <FormField name="name" label="Project name">
        <Input />
      </FormField>
    ),
  },
  {
    id: "region",
    title: "Region",
    render: () => (
      <FormField name="region" label="Region">
        <Input />
      </FormField>
    ),
  },
]

const create = async (values: z.output<typeof schema>): Promise<Created> => ({ id: "p_1", name: values.name })

const resultStep: NonNullable<StepDialogProps<typeof schema, Created>["resultStep"]> = {
  title: "Project created",
  render: (result, { restart }) => (
    <>
      <p>
        {result.name} is ready as {result.id}.
      </p>
      <Button type="button" variant="outline" onClick={restart}>
        Create another
      </Button>
    </>
  ),
}

function Wizard(props: Partial<StepDialogProps<typeof schema, Created>>) {
  return (
    <StepDialog
      schema={schema}
      defaultValues={{ name: "", region: "" }}
      steps={steps}
      trigger="New project"
      title="Create project"
      onSubmit={create}
      resultStep={resultStep}
      {...props}
    />
  )
}

async function finish(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atlas{Enter}")
  await user.type(await screen.findByRole("textbox", { name: "Region" }), "eu")
  await user.click(screen.getByRole("button", { name: "Submit" }))
}

test("a submit that resolves shows the result in the dialog, with focus on its heading", async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  render(<Wizard onOpenChange={onOpenChange} />)
  await finish(user)
  const heading = await screen.findByRole("heading", { name: "Project created" })
  await waitFor(() => expect(document.activeElement).toBe(heading))
  expect(screen.getByText("Atlas is ready as p_1.")).toBeTruthy()
  const dialog = screen.getByRole("dialog", { name: "Create project" })
  expect(dialog.getAttribute("aria-busy")).toBeNull()
  expect(screen.queryByRole("button", { name: "Submit" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
  expect(await axeViolations(dialog)).toEqual([])
  expect(onOpenChange.mock.calls.map(([open, details]) => `${open}:${details.reason}`)).toEqual(["true:trigger"])

  await user.click(screen.getByRole("button", { name: "Done" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "done" }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "New project" })))

  await user.click(screen.getByRole("button", { name: "New project" }))
  expect(await screen.findByRole("heading", { name: "Project" })).toBeTruthy()
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("")
})

test("Escape closes the result step with the escape reason", async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  render(<Wizard onOpenChange={onOpenChange} />)
  await finish(user)
  await screen.findByRole("heading", { name: "Project created" })
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "escape" }))
})

test("restart goes back to the first step with the default values", async () => {
  const user = userEvent.setup()
  const onStepChange = vi.fn()
  render(<Wizard onStepChange={onStepChange} labels={{ done: "Close" }} />)
  await finish(user)
  await screen.findByRole("heading", { name: "Project created" })
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Create another" }))
  const first = await screen.findByRole("heading", { name: "Project" })
  await waitFor(() => expect(document.activeElement).toBe(first))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("")
  expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy()
})

test("without resultStep it still closes on submit with the submit reason", async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()
  render(<Wizard resultStep={undefined} onOpenChange={onOpenChange} />)
  await finish(user)
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "submit" }))
})

test("a failed submit stays on the steps, not the result", async () => {
  const user = userEvent.setup()
  render(<Wizard onSubmit={() => Promise.reject(new Error("Quota reached."))} />)
  await finish(user)
  expect(await screen.findByText("Quota reached.")).toBeTruthy()
  expect(screen.queryByRole("heading", { name: "Project created" })).toBeNull()
})

test("an agent finishes the wizard, reads the result and presses Done", async () => {
  const onOpenChange = vi.fn()
  render(<Wizard onOpenChange={onOpenChange} />)
  const opened = await agent.act({ steps: [{ ref: "New project", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  const first = await agent.act({
    steps: [
      { ref: "Project name", action: "setValue", args: ["Atlas"] },
      { ref: "Next", action: "press" },
    ],
  })
  expect(first.ok, first.error?.message).toBe(true)
  await screen.findByRole("textbox", { name: "Region" })
  const last = await agent.act({
    steps: [
      { ref: "Region", action: "setValue", args: ["eu"] },
      { ref: "Submit", action: "press" },
    ],
  })
  expect(last.ok, last.error?.message).toBe(true)
  await screen.findByRole("heading", { name: "Project created" })
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Create another", "Done"]))
  const done = await agent.act({ steps: [{ ref: "Done", action: "press" }] })
  expect(done.ok, done.error?.message).toBe(true)
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "done" }))
})
