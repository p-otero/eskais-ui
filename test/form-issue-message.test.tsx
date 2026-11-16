import type { StandardSchemaV1 } from "@standard-schema/spec"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test } from "vitest"

import { Form, FormActions, FormField, formIssueMessage, type FormIssue } from "@/components/ui/form"
import { issueFromSchema } from "@/components/ui/form-messages"
import { Input } from "@/components/ui/input"

const builtInCodes = [
  "required",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "min",
  "max",
  "email",
  "url",
  "pattern",
  "invalid",
  "server",
] as const

const params = { min: 3, max: 8, pattern: "^[a-z]+$", label: "a|b {c}" }

const cases: [code: string, params: Record<string, unknown> | undefined][] = [
  ...builtInCodes.flatMap((code): [string, Record<string, unknown> | undefined][] => [
    [code, undefined],
    [code, params],
  ]),
  ["form.handle.taken", undefined],
  ["form.handle.min", { min: 3 }],
  ["checkout.card-number.invalid", { last4: "4242" }],
  ["billing.vat_id.format", {}],
]

const issue = (message: string): StandardSchemaV1.Issue => ({ message, path: ["handle"] })

describe("formIssueMessage round-trips through issueFromSchema", () => {
  test.each(cases)("%s with %j", (code, given) => {
    const parsed = issueFromSchema(issue(formIssueMessage(code, given)), { handle: "x" })
    expect(parsed).toEqual<FormIssue>({
      code,
      field: "handle",
      params: given ?? {},
      message: undefined,
    })
  })

  test.each(builtInCodes)("%s survives an empty value", (code) => {
    const parsed = issueFromSchema(issue(formIssueMessage(code)), { handle: "" })
    expect(parsed.code).toBe(code)
  })
})

describe("plain prose stays prose", () => {
  test.each(["email", "required", "Too short.", "Use a.b format", "a|b", 'min|{"min":3}x', "e.g. this"])(
    "%j",
    (message) => {
      const parsed = issueFromSchema(issue(message), { handle: "x" })
      expect(parsed.code).toBe("invalid")
      expect(parsed.message).toBe(message)
    },
  )
})

describe("the earlier `code|{json}` encoding still reads", () => {
  test.each([
    ['form.handle.min|{"min":3}', "form.handle.min", { min: 3 }],
    ['maxLength|{"max":8}', "maxLength", { max: 8 }],
    ["form.handle.taken", "form.handle.taken", {}],
  ] as const)("%s", (message, code, expected) => {
    const parsed = issueFromSchema(issue(message), { handle: "x" })
    expect(parsed).toEqual({ code, field: "handle", params: expected, message: undefined })
  })

  test("a malformed legacy message stays text", () => {
    const parsed = issueFromSchema(issue('form.handle.reserved|{"name":'), { handle: "x" })
    expect(parsed).toMatchObject({ code: "invalid", message: 'form.handle.reserved|{"name":' })
  })
})

const emailSchema: StandardSchemaV1<{ handle: string }, { handle: string }> = {
  "~standard": {
    version: 1,
    vendor: "effect-like",
    validate: (value) => {
      const handle = String((value as { handle?: unknown }).handle ?? "")
      return handle.includes("@")
        ? { value: { handle } }
        : { issues: [{ message: formIssueMessage("email"), path: ["handle"] }] }
    },
  },
}

const preferMessage = (given: FormIssue) => given.message ?? `[${given.code}]`

test("a built-in code without params reaches messages as that code, with no message", async () => {
  const user = userEvent.setup()
  render(
    <Form schema={emailSchema} defaultValues={{ handle: "" }} onSubmit={() => {}} label="Profile">
      <FormField name="handle" label="Email">
        <Input />
      </FormField>
      <FormField name="handle" label="Email again" messages={preferMessage}>
        <Input />
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  await user.type(screen.getByRole("textbox", { name: "Email" }), "ada")
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Enter a valid email address.")).toBeTruthy()
  expect(screen.getByText("[email]")).toBeTruthy()
})
