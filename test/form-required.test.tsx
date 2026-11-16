import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Form, FormActions, FormField, createForm } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

import { axeViolations } from "./axe"

const agent = createAgent()

const schema = z.object({
  name: z.string().min(1),
  email: z.email(),
  bio: z.string().max(80),
  nickname: z.string().optional(),
})

const defaults = { name: "", email: "", bio: "", nickname: "" }

const marker = (label: string) =>
  screen.getByText(label, { selector: "label" }).querySelector('[data-slot="form-field-required"]')

test("a required field shows an aria-hidden marker and keeps its name", async () => {
  render(
    <Form schema={z.object({ title: z.string() })} defaultValues={{ title: "" }} onSubmit={() => {}} label="Task">
      <FormField name="title" label="Title" required>
        <Input />
      </FormField>
    </Form>,
  )
  const input = screen.getByRole("textbox", { name: "Title" })
  expect(input.hasAttribute("required")).toBe(true)
  expect(marker("Title")?.querySelector('[aria-hidden="true"]')?.textContent).toBe("*")
  expect(await axeViolations(document.body)).toEqual([])
})

test("the schema marks fields that reject an empty value", () => {
  render(
    <Form schema={schema} defaultValues={defaults} onSubmit={() => {}} label="Profile">
      <FormField name="name" label="Name">
        <Input />
      </FormField>
      <FormField name="email" label="Email">
        <Input type="email" />
      </FormField>
      <FormField name="bio" label="Bio">
        <Input />
      </FormField>
      <FormField name="nickname" label="Nickname">
        <Input />
      </FormField>
    </Form>,
  )
  expect(marker("Name")).not.toBeNull()
  expect(marker("Email")).not.toBeNull()
  expect(marker("Bio")).toBeNull()
  expect(marker("Nickname")).toBeNull()
  expect(screen.getByRole("textbox", { name: "Name" }).hasAttribute("required")).toBe(true)
  expect(screen.getByRole("textbox", { name: "Bio" }).hasAttribute("required")).toBe(false)
})

test("required={false} drops the marker; requiredLabel adds words for screen readers", () => {
  render(
    <Form schema={schema} defaultValues={defaults} onSubmit={() => {}} label="Profile" requiredLabel="required">
      <FormField name="name" label="Name" required={false}>
        <Input />
      </FormField>
      <FormField name="email" label="Email" requiredLabel="obligatorio">
        <Input type="email" />
      </FormField>
      <FormField name="bio" label="Bio" required>
        <Input />
      </FormField>
    </Form>,
  )
  expect(marker("Name")).toBeNull()
  expect(screen.getByRole("textbox", { name: "Email obligatorio" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Bio required" })).toBeTruthy()
})

const typed = createForm<typeof schema>()

test("createForm types FormField names against the schema", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <typed.Form schema={schema} defaultValues={defaults} onSubmit={onSubmit} label="Profile">
      <typed.FormField name="name" label="Name">
        <Input />
      </typed.FormField>
      <typed.FormField name="email" label="Email">
        <Input type="email" />
      </typed.FormField>
      <FormActions submitLabel="Save" />
    </typed.Form>,
  )
  const typo = (
    // @ts-expect-error: "nmae" is not a key of the schema
    <typed.FormField name="nmae" label="Name">
      <Input />
    </typed.FormField>
  )
  void typo
  const result = await agent.act({
    steps: [
      { ref: "Name", action: "setValue", args: ["Ada"] },
      { ref: "Email", action: "setValue", args: ["ada@example.com"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toMatchObject({ name: "Ada", email: "ada@example.com" })
})

test("a nullable field that starts at null isn't required; a null the schema rejects is", () => {
  const nullable = z.object({ window: z.string().nullable(), region: z.string().nullable().refine(Boolean) })
  render(
    <Form schema={nullable} defaultValues={{ window: null, region: null }} onSubmit={() => {}} label="Deploy">
      <FormField name="window" label="Window">
        <Input />
      </FormField>
      <FormField name="region" label="Region">
        <Input />
      </FormField>
    </Form>,
  )
  expect(marker("Window")).toBeNull()
  expect(marker("Region")).not.toBeNull()
})
