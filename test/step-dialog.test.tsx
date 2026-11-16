import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { FormField, FormServerError } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { StepDialog, type StepDialogProps } from "@/components/ui/step-dialog"
import { StepForm, type FormStep } from "@/components/ui/step-form"

import { axeViolations } from "./axe"

const agent = createAgent()

const schema = z.object({
  name: z.string().min(3),
  region: z.string().min(1),
  owner: z.email(),
})

type Values = z.input<typeof schema>

const steps: FormStep<Values>[] = [
  {
    id: "project",
    title: "Project",
    description: "Name it.",
    render: () => (
      <FormField name="name" label="Project name">
        <Input />
      </FormField>
    ),
  },
  {
    id: "region",
    title: "Region",
    fields: ["region"],
    validate: (values) => (values.region === "mars" ? { fieldErrors: { region: "Not served yet." } } : undefined),
    render: () => (
      <FormField name="region" label="Region">
        <Input />
      </FormField>
    ),
  },
  {
    id: "owner",
    title: "Owner",
    render: () => (
      <FormField name="owner" label="Owner email">
        <Input type="email" />
      </FormField>
    ),
  },
]

const defaults: Values = { name: "", region: "", owner: "" }

function Wizard(props: Partial<StepDialogProps<typeof schema>>) {
  return (
    <StepDialog
      schema={schema}
      defaultValues={defaults}
      steps={steps}
      trigger="New project"
      title="Create project"
      onSubmit={() => {}}
      {...props}
    />
  )
}

const heading = (name: string) => screen.getByRole("heading", { name })

test("next validates only the current step's fields and focuses the next heading", async () => {
  const user = userEvent.setup()
  const onStepChange = vi.fn()
  render(<Wizard onStepChange={onStepChange} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  const dialog = screen.getByRole("dialog", { name: "Create project" })
  expect(await axeViolations(dialog)).toEqual([])
  const progress = screen.getByRole("list", { name: "Progress" })
  expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain("Project")

  await user.click(screen.getByRole("button", { name: "Next" }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Project name" })))
  expect(screen.queryByText(/email/i)).toBeNull()
  expect(onStepChange).not.toHaveBeenCalled()

  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atlas{Enter}")
  await waitFor(() => expect(document.activeElement).toBe(heading("Region")))
  expect(onStepChange).toHaveBeenLastCalledWith("region", expect.objectContaining({ index: 1, direction: "next" }))
  expect(progress.querySelector('[aria-current="step"]')?.textContent).toContain("Region")

  await user.type(screen.getByRole("textbox", { name: "Region" }), "mars")
  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Not served yet.")).toBeTruthy()
  expect(heading("Region")).toBeTruthy()
})

test("back keeps values; submit runs once with every step's values", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<Wizard onSubmit={onSubmit} />)
  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atlas")
  await user.click(screen.getByRole("button", { name: "Next" }))
  await user.type(screen.getByRole("textbox", { name: "Region" }), "eu")
  await user.click(screen.getByRole("button", { name: "Back" }))
  await waitFor(() => expect(document.activeElement).toBe(heading("Project")))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" }).value).toBe("Atlas")
  await user.click(screen.getByRole("button", { name: "Next" }))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Region" }).value).toBe("eu")
  await user.click(screen.getByRole("button", { name: "Next" }))
  await user.type(screen.getByRole("textbox", { name: "Owner email" }), "ada@example.com")
  await user.click(screen.getByRole("button", { name: "Submit" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onSubmit).toHaveBeenCalledTimes(1)
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ name: "Atlas", region: "eu", owner: "ada@example.com" })
})

const rejectName = () => Promise.reject(new FormServerError("", { name: "Taken." }))

test("a server error on an earlier step's field returns to that step", async () => {
  const user = userEvent.setup()
  const onStepChange = vi.fn()
  render(
    <StepForm
      schema={schema}
      defaultValues={{ name: "Atlas", region: "eu", owner: "ada@example.com" }}
      steps={steps}
      defaultStep="owner"
      onStepChange={onStepChange}
      onSubmit={rejectName}
      label="New project"
      labels={{ next: "Continue", back: "Previous", submit: "Create", progress: "Steps" }}
    />,
  )
  expect(screen.getByRole("list", { name: "Steps" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Create" }))
  expect(await screen.findByText("Taken.")).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Project name" })))
  expect(onStepChange).toHaveBeenLastCalledWith("project", expect.objectContaining({ direction: "error" }))
})

test("an agent goes through the steps with Next and Back", async () => {
  const onSubmit = vi.fn()
  render(<Wizard onSubmit={onSubmit} />)
  const opened = await agent.act({ steps: [{ ref: "New project", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const first = await agent.act({
    steps: [
      { ref: "Project name", action: "setValue", args: ["Atlas"] },
      { ref: "Next", action: "press" },
    ],
  })
  expect(first.ok, first.error?.message).toBe(true)
  await screen.findByRole("textbox", { name: "Region" })
  const second = await agent.act({
    steps: [
      { ref: "Region", action: "setValue", args: ["eu"] },
      { ref: "Next", action: "press" },
    ],
  })
  expect(second.ok, second.error?.message).toBe(true)
  await screen.findByRole("textbox", { name: "Owner email" })
  const back = await agent.act({ steps: [{ ref: "Back", action: "press" }] })
  expect(back.ok, back.error?.message).toBe(true)
  await screen.findByRole("textbox", { name: "Region" })
  await agent.act({ steps: [{ ref: "Next", action: "press" }] })
  await screen.findByRole("textbox", { name: "Owner email" })
  const last = await agent.act({
    steps: [
      { ref: "Owner email", action: "setValue", args: ["ada@example.com"] },
      { ref: "Submit", action: "press" },
    ],
  })
  expect(last.ok, last.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
})

test("a submit that fails validation on an earlier step goes back to it", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <StepForm
      schema={schema}
      defaultValues={{ name: "", region: "eu", owner: "ada@example.com" }}
      steps={steps}
      defaultStep="owner"
      onSubmit={onSubmit}
      label="New project"
    />,
  )
  await user.click(screen.getByRole("button", { name: "Submit" }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Project name" })))
  expect(onSubmit).not.toHaveBeenCalled()
})
