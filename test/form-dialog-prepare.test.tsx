import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { FormField } from "@/components/ui/form"
import { FormDialog, type ReviewStep } from "@/components/ui/form-dialog"
import { Input } from "@/components/ui/input"

const schema = z.object({ name: z.string().min(3), owner: z.email() })

type Output = z.output<typeof schema>
type Input = z.input<typeof schema>

const base: ReviewStep<Output, Input> = {
  editLabel: "Edit details",
  confirmLabel: "Create for real",
  render: (values) => <p>Reviewing {values.name}</p>,
}

type Prepare = NonNullable<ReviewStep<Output, Input>["prepare"]>

const writeOwner: Prepare = async (_values, { form }) => {
  form.setValue("owner", "ada@atlas.dev")
}

const writeAndReturn: Prepare = (values, { form }) => {
  form.setValue("name", "Written")
  return { values: { ...values, name: "Returned" } }
}

const writeInvalid: Prepare = (_values, { form }) => {
  form.setValue("owner", "not an email")
}

const noop = () => {}

function ProjectDialog({
  reviewStep,
  onSubmit = noop,
}: {
  reviewStep: ReviewStep<Output, Input>
  onSubmit?: (values: Output) => void
}) {
  return (
    <FormDialog
      schema={schema}
      defaultValues={{ name: "", owner: "" }}
      trigger="New project"
      title="Create project"
      submitLabel="Review"
      cancelLabel="Cancel"
      reviewStep={reviewStep}
      onSubmit={onSubmit}
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

async function review(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "New project" }))
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atlas")
  await user.type(screen.getByRole("textbox", { name: "Owner email" }), "ada@example.com")
  await user.click(screen.getByRole("button", { name: "Review" }))
}

const nameField = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" })

test("returned values replace the form values: Edit shows them and they are submitted", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  const prepare = vi.fn((values: Output) => ({ values: { ...values, name: `${values.name} (EU)` } }))
  render(<ProjectDialog reviewStep={{ ...base, prepare }} onSubmit={onSubmit} />)
  await review(user)
  expect(await screen.findByText("Reviewing Atlas (EU)")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Edit details" }))
  expect(nameField().value).toBe("Atlas (EU)")
  await user.click(screen.getByRole("button", { name: "Review" }))
  expect(await screen.findByText("Reviewing Atlas (EU) (EU)")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Create for real" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ name: "Atlas (EU) (EU)", owner: "ada@example.com" })
})

test("prepare gets the form: values it writes show in the review, after Edit and in onSubmit", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <ProjectDialog
      reviewStep={{ ...base, prepare: writeOwner, render: (values) => <p>Owner {values.owner}</p> }}
      onSubmit={onSubmit}
    />,
  )
  await review(user)
  expect(await screen.findByText("Owner ada@atlas.dev")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Edit details" }))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Owner email" }).value).toBe("ada@atlas.dev")
  await user.click(screen.getByRole("button", { name: "Review" }))
  await user.click(await screen.findByRole("button", { name: "Create for real" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ name: "Atlas", owner: "ada@atlas.dev" })
})

test("returned values win over what prepare wrote through the form", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ProjectDialog reviewStep={{ ...base, prepare: writeAndReturn }} onSubmit={onSubmit} />)
  await review(user)
  expect(await screen.findByText("Reviewing Returned")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Edit details" }))
  expect(nameField().value).toBe("Returned")
})

test("a value prepare writes that fails the schema stays on the fields", async () => {
  const user = userEvent.setup()
  render(<ProjectDialog reviewStep={{ ...base, prepare: writeInvalid }} />)
  await review(user)
  const owner = screen.getByRole<HTMLInputElement>("textbox", { name: "Owner email" })
  await waitFor(() => expect(document.activeElement).toBe(owner))
  expect(owner.value).toBe("not an email")
  expect(screen.queryByRole("button", { name: "Create for real" })).toBeNull()
})
