import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import {
  Autocomplete,
  AutocompleteClear,
  AutocompleteContent,
  AutocompleteControl,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteItemText,
  AutocompleteList,
  AutocompleteStatus,
  useAsyncOptions,
} from "@/components/ui/autocomplete"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const cities = ["Amsterdam", "Athens", "Barcelona", "Berlin", "Boston"]

function CityField({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Field>
      <FieldLabel>City</FieldLabel>
      <Autocomplete items={cities} onValueChange={onValueChange}>
        <AutocompleteControl>
          <AutocompleteInput placeholder="e.g. Berlin" />
          <AutocompleteClear />
        </AutocompleteControl>
        <AutocompleteContent>
          <AutocompleteEmpty>No city starts like that.</AutocompleteEmpty>
          <AutocompleteList />
        </AutocompleteContent>
      </Autocomplete>
    </Field>
  )
}

const city = () => screen.getByRole<HTMLInputElement>("combobox", { name: "City" })

test("suggestions filter as you type, and any text stays the value", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<CityField onValueChange={onValueChange} />)
  await user.type(city(), "b")
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Barcelona", "Berlin", "Boston"])
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}")
  expect(city().value).toBe("Berlin")
  await user.clear(city())
  await user.type(city(), "Bilbao")
  expect(city().value).toBe("Bilbao")
  expect(onValueChange).toHaveBeenLastCalledWith("Bilbao", expect.anything())
})

test("the clear button has an overridable name", async () => {
  const user = userEvent.setup()
  render(<CityField />)
  await user.type(city(), "Rome")
  await user.click(screen.getByRole("button", { name: "Clear" }))
  expect(city().value).toBe("")
})

test("item text marks the match", async () => {
  const user = userEvent.setup()
  render(
    <Autocomplete>
      <AutocompleteInput aria-label="Fruit" />
      <AutocompleteContent>
        <AutocompleteList>
          {["Apple", "Apricot"].map((fruit) => (
            <AutocompleteItem key={fruit} value={fruit}>
              <AutocompleteItemText>{fruit}</AutocompleteItemText>
            </AutocompleteItem>
          ))}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>,
  )
  await user.type(screen.getByRole("combobox", { name: "Fruit" }), "ap")
  expect(document.querySelector("[data-slot=autocomplete-item-text][data-matched] mark")?.textContent).toBe("Ap")
})

function AsyncCity() {
  const results = useAsyncOptions(
    async (query: string) => cities.filter((name) => name.toLowerCase().startsWith(query.toLowerCase())),
    { debounce: 0 },
  )
  return (
    <Autocomplete
      items={results.items}
      filter={false}
      status={results.status}
      onValueChange={(value) => results.setQuery(value)}
    >
      <AutocompleteInput aria-label="Remote city" />
      <AutocompleteContent>
        <AutocompleteStatus>{(state) => (state.loading ? "Searching" : "")}</AutocompleteStatus>
        <AutocompleteList />
      </AutocompleteContent>
    </Autocomplete>
  )
}

test("useAsyncOptions feeds suggestions a server filtered", async () => {
  const user = userEvent.setup()
  render(<AsyncCity />)
  await user.type(screen.getByRole("combobox", { name: "Remote city" }), "at")
  await waitFor(() => expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Athens"]))
})

test("FormField binds the text and floats its label", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <Form schema={z.object({ city: z.string().min(1) })} defaultValues={{ city: "" }} onSubmit={onSubmit} label="Trip">
      <FormField name="city" label="Destination" labelPlacement="in">
        <Autocomplete items={cities}>
          <AutocompleteControl>
            <AutocompleteInput />
          </AutocompleteControl>
          <AutocompleteContent>
            <AutocompleteList />
          </AutocompleteContent>
        </Autocomplete>
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  expect(document.querySelector("[data-slot=field]")?.getAttribute("data-label-placement")).toBe("in")
  await user.type(screen.getByRole("combobox", { name: "Destination" }), "Lyon")
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ city: "Lyon" }, expect.anything()))
})

test("no axe violations", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <CityField />
    </main>,
  )
  await user.type(city(), "b")
  expect(await axeViolations(document.body)).toEqual([])
  expect(container).toBeTruthy()
})

test("an agent finds the autocomplete by its label and sets free text", async () => {
  const onValueChange = vi.fn()
  render(<CityField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "City")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue"]))
  const result = await act(() => agent.act({ steps: [{ ref: "City", action: "setValue", args: ["Lisbon"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(city().value).toBe("Lisbon")
  expect(onValueChange).toHaveBeenLastCalledWith("Lisbon", expect.objectContaining({ source: "agent" }))
})
