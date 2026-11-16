import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormActions, FormField, useFormFieldArray, useFormInstance, useFormWatch } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const schema = z.object({
  name: z.string().min(1),
  tags: z.array(z.object({ label: z.string().min(1) })).min(1),
})

type Values = z.input<typeof schema>

function Preview() {
  const form = useFormInstance<Values>()
  const name = useFormWatch<Values, "name">("name")
  return (
    <>
      <output aria-label="Preview">{name}</output>
      <Button type="button" onClick={() => form.setValue("name", form.getValues("name").toUpperCase())}>
        Shout
      </Button>
    </>
  )
}

function Tags() {
  const tags = useFormFieldArray<Values, "tags">("tags")
  return (
    <>
      {tags.fields.map((tag, index) => (
        <FormField key={tag.id} name={`tags.${index}.label`} label={`Tag ${index + 1}`}>
          <Input />
        </FormField>
      ))}
      <Button type="button" onClick={() => tags.append({ label: "" })}>
        Add tag
      </Button>
    </>
  )
}

test("useFormInstance writes the form, useFormWatch follows a value, useFormFieldArray adds rows", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <Form schema={schema} defaultValues={{ name: "", tags: [] }} onSubmit={onSubmit} label="Tags">
      <FormField name="name" label="Name">
        <Input />
      </FormField>
      <Preview />
      <Tags />
      <FormActions submitLabel="Save" />
    </Form>,
  )
  await user.type(screen.getByRole("textbox", { name: "Name" }), "atlas")
  expect(screen.getByRole("status", { name: "Preview" }).textContent).toBe("atlas")
  await user.click(screen.getByRole("button", { name: "Shout" }))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("ATLAS")

  await user.click(screen.getByRole("button", { name: "Add tag" }))
  await user.type(screen.getByRole("textbox", { name: "Tag 1" }), "docs")
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ name: "ATLAS", tags: [{ label: "docs" }] })
})

function Outside() {
  useFormInstance()
  return null
}

test("the hooks need a Form", () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  expect(() => render(<Outside />)).toThrow("useFormInstance must be inside a Form.")
  vi.restoreAllMocks()
})
