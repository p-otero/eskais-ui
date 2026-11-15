import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input, InputClear, InputGroup } from "@/components/ui/input"

test("a field names and describes its input", () => {
  render(
    <Field>
      <FieldLabel>Email</FieldLabel>
      <Input type="email" />
      <FieldDescription>We never share it.</FieldDescription>
    </Field>,
  )
  const input = screen.getByRole("textbox", { name: "Email" })
  expect(input.getAttribute("aria-describedby")).toBeTruthy()
  expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toBe("We never share it.")
})

test("the clear button empties the input, reports why, and returns focus", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(
    <InputGroup>
      <Input aria-label="Website" defaultValue="example.com" onValueChange={onValueChange} />
      <InputClear aria-label="Clear website" />
    </InputGroup>,
  )
  await user.click(await screen.findByRole("button", { name: "Clear website" }))
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Website" })
  expect(input.value).toBe("")
  expect(document.activeElement).toBe(input)
  expect(onValueChange).toHaveBeenLastCalledWith("", expect.objectContaining({ reason: "clear-press" }))
  expect(screen.queryByRole("button", { name: "Clear website" })).toBeNull()
})

test("the clear button has a default accessible name", async () => {
  render(
    <InputGroup>
      <Input aria-label="Query" defaultValue="x" />
      <InputClear />
    </InputGroup>,
  )
  expect(await screen.findByRole("button", { name: "Clear" })).toBeTruthy()
})
