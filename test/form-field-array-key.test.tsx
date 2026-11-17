import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, expectTypeOf, test, vi } from "vitest"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { createForm, Form, FormActions, FormField, useFormFieldArray } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const schema = z.object({
  components: z.array(z.object({ id: z.string(), name: z.string().min(1) })),
})

type Values = z.input<typeof schema>

function Components() {
  const rows = useFormFieldArray<Values, "components", "fieldKey">("components", { keyName: "fieldKey" })
  return (
    <>
      {rows.fields.map((row, index) => (
        <FormField key={row.fieldKey} name={`components.${index}.name`} label={`Component ${row.id}`}>
          <Input />
        </FormField>
      ))}
      <Button type="button" onClick={() => rows.append({ id: "c3", name: "Gamma" })}>
        Add component
      </Button>
    </>
  )
}

test("keyName keeps the items' own id and keys rows by the chosen name", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <Form
      schema={schema}
      defaultValues={{
        components: [
          { id: "c1", name: "Alpha" },
          { id: "c2", name: "Beta" },
        ],
      }}
      onSubmit={onSubmit}
      label="Components"
    >
      <Components />
      <FormActions submitLabel="Save" />
    </Form>,
  )
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Component c1" }).value).toBe("Alpha")
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Component c2" }).value).toBe("Beta")
  await user.click(screen.getByRole("button", { name: "Add component" }))
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Component c3" }).value).toBe("Gamma")
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({
    components: [
      { id: "c1", name: "Alpha" },
      { id: "c2", name: "Beta" },
      { id: "c3", name: "Gamma" },
    ],
  })
})
function Untyped() {
  const rows = useFormFieldArray("components", { keyName: "fieldKey" })
  expectTypeOf(rows.fields[0]!).toHaveProperty("fieldKey").toEqualTypeOf<string>()
  return null
}

const typed = createForm<typeof schema>()

function Typed() {
  const rows = typed.useFormFieldArray("components", { keyName: "fieldKey" })
  expectTypeOf(rows.fields[0]!.fieldKey).toEqualTypeOf<string>()
  expectTypeOf(rows.fields[0]!.id).toEqualTypeOf<string>()
  expectTypeOf(rows.fields[0]!.name).toEqualTypeOf<string>()
  const plain = typed.useFormFieldArray("components")
  expectTypeOf(plain.fields[0]!.id).toEqualTypeOf<string>()
  // @ts-expect-error the key is `id` unless keyName says otherwise
  void plain.fields[0]?.fieldKey
  return <output aria-label="Rows">{rows.fields.map((row) => row.id).join(",")}</output>
}

test("keyName types: inferred without generics, through createForm, and `id` by default", () => {
  render(
    <Form schema={schema} defaultValues={{ components: [{ id: "c1", name: "Alpha" }] }} onSubmit={() => {}}>
      <Untyped />
      <Typed />
    </Form>,
  )
  expect(screen.getByRole("status", { name: "Rows" }).textContent).toBe("c1")
})
