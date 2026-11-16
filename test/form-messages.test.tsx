import type { StandardSchemaV1 } from "@standard-schema/spec"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import {
  FieldSet,
  Form,
  FormActions,
  FormField,
  FormRootError,
  createFormMessages,
  formIssueMessage,
  formMessagesEs,
  toFormErrors,
  type FormMessages,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

// Effect Schema and others expose only `~standard` with `message` and `path` per issue: no vendor codes.
function effectLike<T extends Record<string, string>>(
  check: (value: Record<string, unknown>) => StandardSchemaV1.Issue[],
): StandardSchemaV1<T, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "effect-like",
      validate: (value) => {
        const issues = check(value as Record<string, unknown>)
        return issues.length ? { issues } : { value: value as T }
      },
    },
  }
}

const handleSchema = effectLike<{ handle: string }>((value) => {
  const handle = String(value.handle ?? "")
  if (handle === "") return [{ message: "Expected a handle", path: ["handle"] }]
  if (handle.includes(" ")) return [{ message: "form.handle.spaces", path: ["handle"] }]
  if (handle === "root") return [{ message: "Handles can't be root", path: [{ key: "handle" }] }]
  return []
})

function ignore() {}

function HandleForm({
  messages,
  fieldMessages,
  onSubmit = ignore,
}: {
  messages?: FormMessages
  fieldMessages?: FormMessages
  onSubmit?: () => unknown
}) {
  return (
    <Form schema={handleSchema} defaultValues={{ handle: "" }} onSubmit={onSubmit} messages={messages}>
      <FormField name="handle" label="Handle" messages={fieldMessages}>
        <Input />
      </FormField>
      <FormRootError />
      <FormActions submitLabel="Save" />
    </Form>
  )
}

const dictionary: Record<string, string> = {
  "form.required": "{field} hace falta",
  "form.handle.spaces": "Sin espacios, por favor",
  "form.handle.taken": "{field} ya está en uso ({suggestion})",
  "form.rate_limited": "Demasiados intentos",
}
const t = (key: string, params: Record<string, unknown>) =>
  dictionary[key]?.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name])) ?? key

test("an Effect-like schema with no codes: empty is required, a key message passes through as the code", async () => {
  const user = userEvent.setup()
  render(<HandleForm messages={createFormMessages(t)} />)
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Handle hace falta")).toBeTruthy()

  await user.type(screen.getByRole("textbox", { name: "Handle" }), "a b")
  expect(await screen.findByText("Sin espacios, por favor")).toBeTruthy()

  await user.clear(screen.getByRole("textbox", { name: "Handle" }))
  await user.type(screen.getByRole("textbox", { name: "Handle" }), "root")
  expect(await screen.findByText("Handles can't be root")).toBeTruthy()
})

const keyedSchema = effectLike<{ handle: string }>((value) => {
  const handle = String(value.handle ?? "")
  if (handle === "admin") return [{ message: 'form.handle.reserved|{"name":', path: ["handle"] }]
  if (handle.length < 3) return [{ message: formIssueMessage("form.handle.min", { min: 3 }), path: ["handle"] }]
  if (handle.length > 8) return [{ message: formIssueMessage("maxLength", { max: 8 }), path: ["handle"] }]
  return []
})

const keyed: Record<string, string> = { "form.handle.min": "Al menos {min}, {field}" }
const translateKeyed = (key: string, params: Record<string, unknown>) =>
  keyed[key]?.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name])) ?? key

test("a schema message can be a key or a built-in code with JSON params", async () => {
  expect(formIssueMessage("form.handle.min", { min: 3 })).toBe('form.handle.min|{"min":3}')
  expect(formIssueMessage("form.handle.taken")).toBe("form.handle.taken")
  const user = userEvent.setup()
  render(
    <Form
      schema={keyedSchema}
      defaultValues={{ handle: "" }}
      onSubmit={ignore}
      messages={createFormMessages(translateKeyed)}
    >
      <FormField name="handle" label="Handle" messages={formMessagesEs}>
        <Input />
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  const handle = screen.getByRole("textbox", { name: "Handle" })
  await user.type(handle, "ab")
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Al menos 3, Handle")).toBeTruthy()
  await user.type(handle, "cdefghij")
  expect(await screen.findByText("Escribe como máximo 8 caracteres.")).toBeTruthy()
  await user.clear(handle)
  await user.type(handle, "admin")
  expect(await screen.findByText('form.handle.reserved|{"name":')).toBeTruthy()
})

test("without messages, a keyed issue shows its key, not the params", async () => {
  const user = userEvent.setup()
  render(
    <Form schema={keyedSchema} defaultValues={{ handle: "" }} onSubmit={ignore}>
      <FormField name="handle" label="Handle">
        <Input />
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  await user.type(screen.getByRole("textbox", { name: "Handle" }), "ab")
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("form.handle.min")).toBeTruthy()
})

async function rejectWithCodes() {
  throw {
    fieldErrors: { handle: { code: "handle.taken", params: { suggestion: "ada2" } } },
    message: { code: "rate_limited" },
  }
}

test("a server error with a code goes through the messages function, with its params", async () => {
  const user = userEvent.setup()
  render(<HandleForm messages={createFormMessages(t)} onSubmit={rejectWithCodes} />)
  await user.type(screen.getByRole("textbox", { name: "Handle" }), "ada")
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Handle ya está en uso (ada2)")).toBeTruthy()
  expect(screen.getByRole("alert").textContent).toContain("Demasiados intentos")
})

test("a field's messages win over the form's, and undefined falls back to the defaults", async () => {
  const user = userEvent.setup()
  render(
    <HandleForm
      messages={formMessagesEs}
      fieldMessages={(issue) => (issue.code === "required" ? `Pick a ${issue.label?.toLowerCase()}` : undefined)}
    />,
  )
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Pick a handle")).toBeTruthy()

  render(<HandleForm messages={() => undefined} />)
  await user.click(screen.getAllByRole("button", { name: "Save" })[1]!)
  expect(await screen.findByText("This field is required.")).toBeTruthy()
})

test("Zod issues get stable codes and params", async () => {
  const user = userEvent.setup()
  const schema = z.object({ name: z.string().max(4), seats: z.number().min(2), site: z.url() })
  const seen: string[] = []
  render(
    <Form
      schema={schema}
      defaultValues={{ name: "Atlas!", seats: 1, site: "nope" }}
      onSubmit={() => {}}
      messages={(issue) => {
        seen.push(`${issue.field}:${issue.code}:${JSON.stringify(issue.params)}`)
        return undefined
      }}
    >
      <FormField name="name" label="Name">
        <Input />
      </FormField>
      <FormField name="seats" label="Seats" render={() => <span>seats</span>} />
      <FormField name="site" label="Site">
        <Input />
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  await user.click(screen.getByRole("button", { name: "Save" }))
  await screen.findByText("Use at most 4 characters.")
  expect(seen).toEqual(expect.arrayContaining(['name:maxLength:{"max":4}', 'seats:min:{"min":2}', "site:url:{}"]))
})

test("toFormErrors reads issue lists, objects and FormServerError-like shapes", () => {
  expect(toFormErrors([{ message: "Taken", path: ["email"] }, { message: "Try later" }])).toEqual({
    fieldErrors: { email: { code: "invalid", params: {}, message: "Taken" } },
    message: { code: "invalid", params: {}, message: "Try later" },
  })
  expect(toFormErrors({ fieldErrors: { email: "Taken" } })).toEqual({ fieldErrors: { email: "Taken" } })
  expect(toFormErrors(new Error("boom"))).toBeUndefined()
})

test("a root error alone takes focus; a plain Error shows its message", async () => {
  const user = userEvent.setup()
  render(
    <HandleForm
      onSubmit={async () => {
        throw new Error("Network is down")
      }}
    />,
  )
  await user.type(screen.getByRole("textbox", { name: "Handle" }), "ada")
  await user.click(screen.getByRole("button", { name: "Save" }))
  const alert = await screen.findByRole("alert")
  expect(alert.textContent).toContain("Network is down")
  await waitFor(() => expect(document.activeElement).toBe(alert))
})

test("pending: fields disabled, button busy, a second submit is ignored", async () => {
  const user = userEvent.setup()
  let finish!: () => void
  const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
  render(<HandleForm onSubmit={onSubmit} />)
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Handle" })
  await user.type(input, "ada{Enter}")
  const button = screen.getByRole("button", { name: "Save" })
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"))
  expect(input.disabled).toBe(true)
  button.closest("form")!.requestSubmit()
  expect(onSubmit).toHaveBeenCalledTimes(1)
  finish()
  await waitFor(() => expect(input.disabled).toBe(false))
  expect(document.activeElement).toBe(input)
})

test("disableWhilePending={false} keeps fields editable", async () => {
  const user = userEvent.setup()
  render(
    <Form
      schema={handleSchema}
      defaultValues={{ handle: "ada" }}
      onSubmit={() => new Promise(() => {})}
      disableWhilePending={false}
    >
      <FormField name="handle" label="Handle">
        <Input />
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Save" }).getAttribute("aria-busy")).toBe("true"))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Handle" }).disabled).toBe(false)
})

test("a destructive submit needs a person; the form hides its own submit from agents", async () => {
  const onSubmit = vi.fn()
  render(
    <Form schema={handleSchema} defaultValues={{ handle: "ada" }} onSubmit={onSubmit} label="Delete account">
      <FieldSet legend="Confirm">
        <FormField name="handle" label="Type your handle">
          <Input />
        </FormField>
      </FieldSet>
      <FormActions submitLabel="Delete forever" tone="destructive" confirm="Deletes the account and its projects" />
    </Form>,
  )
  const labels = agent
    .snapshot()
    .filter((entry) => !entry.offPage)
    .map((entry) => entry.label)
  expect(labels).not.toContain("Delete account")
  const press = { steps: [{ ref: "Delete forever", action: "press" }] }
  expect((await agent.act(press)).ok).toBe(false)
  expect(onSubmit).not.toHaveBeenCalled()
  approve = true
  expect((await agent.act(press)).ok).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  approve = false
  expect(screen.getByRole("group", { name: "Confirm" })).toBeTruthy()
})
