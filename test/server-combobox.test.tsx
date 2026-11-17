import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { ServerCombobox } from "@/components/ui/server-combobox"
import { arraySource } from "@/lib/array-source"

import { axeViolations } from "./axe"

const agent = createAgent()

type Person = { id: string; name: string }

const people: Person[] = Array.from({ length: 45 }, (_, index) => ({
  id: `p${String(index + 1)}`,
  name: `${["Ada", "Grace", "Alan", "Edsger", "Barbara"][index % 5] ?? "Ada"} ${String(index + 1)}`,
}))

function peopleSource(options: Parameters<typeof arraySource<Person, { q?: string }>>[1] = {}) {
  return arraySource<Person, { q?: string }>(people, { search: { fields: ["name"] }, ...options })
}

function Single({
  source,
  onValueChange,
}: {
  source: ReturnType<typeof peopleSource>
  onValueChange?: (v: string | null) => void
}) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <Field>
      <FieldLabel>Owner</FieldLabel>
      <ServerCombobox
        source={source}
        getLabel={(person) => person.name}
        value={value}
        onValueChange={(next) => {
          setValue(next)
          onValueChange?.(next)
        }}
        pageSize={10}
        debounce={50}
      />
    </Field>
  )
}

function optionNames() {
  return screen.queryAllByRole("option").map((option) => option.textContent)
}

test("loads the first page and searches on the server once typing pauses", async () => {
  const user = userEvent.setup()
  const source = peopleSource({ delay: 20 })
  const fetchPage = vi.spyOn(source, "fetchPage")
  const onValueChange = vi.fn()
  render(<Single source={source} onValueChange={onValueChange} />)
  await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1))
  await user.click(screen.getByRole("button", { name: "Show options" }))
  await waitFor(() => expect(optionNames()).toHaveLength(10))

  const input = screen.getByRole("combobox", { name: "Owner" })
  await user.clear(input)
  await user.type(input, "Gra")
  await waitFor(() => expect(optionNames().every((name) => name?.startsWith("Grace"))).toBe(true))
  const searches = fetchPage.mock.calls.filter((call) => call[0].filter.q !== undefined)
  expect(searches.at(-1)?.[0]).toMatchObject({ filter: { q: "Gra" }, size: 10, position: { page: 1 } })
  expect(searches.length).toBeLessThanOrEqual(2)

  await user.click(screen.getByRole("option", { name: "Grace 2" }))
  expect(onValueChange).toHaveBeenLastCalledWith("p2")
  expect((input as HTMLInputElement).value).toBe("Grace 2")
})

test("asks for the next page when the list reaches its end", async () => {
  const user = userEvent.setup()
  const source = peopleSource()
  const fetchPage = vi.spyOn(source, "fetchPage")
  render(<Single source={source} />)
  await user.click(screen.getByRole("button", { name: "Show options" }))
  await waitFor(() => expect(optionNames()).toHaveLength(10))
  const input = screen.getByRole("combobox", { name: "Owner" })
  input.focus()
  for (let step = 0; step < 10; step++) await user.keyboard("{ArrowDown}")
  await waitFor(() => expect(optionNames()).toHaveLength(20))
  expect(fetchPage.mock.lastCall?.[0].position).toEqual({ page: 2 })
})

test("follows cursors for a cursor source", async () => {
  const user = userEvent.setup()
  const source = peopleSource({ position: "cursor", total: "none" })
  const fetchPage = vi.spyOn(source, "fetchPage")
  render(<Single source={source} />)
  await user.click(screen.getByRole("button", { name: "Show options" }))
  await waitFor(() => expect(optionNames()).toHaveLength(10))
  screen.getByRole("combobox", { name: "Owner" }).focus()
  for (let step = 0; step < 10; step++) await user.keyboard("{ArrowDown}")
  await waitFor(() => expect(optionNames()).toHaveLength(20))
  expect(fetchPage.mock.lastCall?.[0].position).toEqual({ cursor: "10", direction: "forward" })
})

test("multiple shows chips named for removal, with labels for values that haven't loaded", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(
    <Field>
      <FieldLabel>Reviewers</FieldLabel>
      <ServerCombobox
        multiple
        source={peopleSource()}
        getLabel={(person) => person.name}
        defaultValue={["p44"]}
        valueLabels={{ p44: "Edsger 44" }}
        onValueChange={onValueChange}
        pageSize={10}
        debounce={0}
      />
    </Field>,
  )
  expect(screen.getByText("Edsger 44")).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Show options" }))
  await waitFor(() => expect(optionNames()).toHaveLength(10))
  await user.click(screen.getByRole("option", { name: "Alan 3" }))
  expect(onValueChange).toHaveBeenLastCalledWith(["p44", "p3"], { labels: { p44: "Edsger 44", p3: "Alan 3" } })
  await user.click(screen.getByRole("button", { name: "Remove Edsger 44" }))
  expect(onValueChange).toHaveBeenLastCalledWith(["p3"], { labels: { p3: "Alan 3" } })
})

test("agents choose an option by its label; no axe violations", async () => {
  const onValueChange = vi.fn()
  const { container } = render(<Single source={peopleSource()} onValueChange={onValueChange} />)
  await waitFor(() => expect(agent.snapshot().some((entry) => entry.label === "Owner")).toBe(true))
  const result = await agent.act({ steps: [{ ref: "Owner", action: "setValue", args: ["Barbara 5"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("p5")
  expect(await axeViolations(container)).toEqual([])
})
