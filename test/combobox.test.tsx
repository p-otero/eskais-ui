import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"

import { axeViolations } from "./axe"

const agent = createAgent()

const projects = [
  { value: "apollo", label: "Apollo" },
  { value: "artemis", label: "Artemis" },
  { value: "gemini", label: "Gemini" },
]

type ProjectComboboxProps = {
  defaultValue?: string
  onValueChange?: (value: string | null, details: { cancel: () => void }) => void
}

function ProjectCombobox(props: ProjectComboboxProps) {
  return (
    <Field>
      <FieldLabel>Project</FieldLabel>
      <Combobox items={projects} {...props}>
        <ComboboxControl>
          <ComboboxInput placeholder="All projects" />
          <ComboboxClear aria-label="Clear project" />
          <ComboboxTrigger aria-label="Show projects" />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No projects found.</ComboboxEmpty>
          <ComboboxList>
            {(state) =>
              (state.items as typeof projects).map((project) => (
                <ComboboxItem key={project.value} value={project.value}>
                  {project.label}
                  <ComboboxItemIndicator />
                </ComboboxItem>
              ))
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("the field label names the input; trigger and clear have default names", async () => {
  render(
    <Field>
      <FieldLabel>Profile</FieldLabel>
      <Combobox items={["Fast", "Thorough"]} defaultValue="Fast">
        <ComboboxControl>
          <ComboboxInput />
          <ComboboxClear />
          <ComboboxTrigger />
        </ComboboxControl>
      </Combobox>
    </Field>,
  )
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Profile" }).value).toBe("Fast")
  expect(screen.getByRole("button", { name: "Show options" })).toBeTruthy()
  expect(await screen.findByRole("button", { name: "Clear" })).toBeTruthy()
})

test("keyboard: typing filters, arrows highlight, Enter chooses and reports why", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ProjectCombobox onValueChange={onValueChange} />)
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Project" })

  await user.click(input)
  await user.keyboard("ar")
  expect(screen.queryByRole("option", { name: "Apollo" })).toBeNull()
  expect(screen.getByRole("option", { name: "Artemis" })).toBeTruthy()
  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("option", { name: "Artemis" }).hasAttribute("data-highlighted")).toBe(true)
  await user.keyboard("{Enter}")

  expect(onValueChange).toHaveBeenLastCalledWith("artemis", expect.objectContaining({ reason: "item-press" }))
  expect(input.value).toBe("Artemis")
  expect(document.activeElement).toBe(input)
})

test("no match shows the empty state; Escape restores the chosen label", async () => {
  const user = userEvent.setup()
  render(<ProjectCombobox defaultValue="gemini" />)
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Project" })
  await user.click(input)
  await user.clear(input)
  await user.keyboard("zz")
  expect(screen.getByText("No projects found.")).toBeTruthy()
  await user.keyboard("{Escape}{Escape}")
  expect(input.value).toBe("Gemini")
})

test("the clear button empties the value and keeps focus in the input", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ProjectCombobox defaultValue="apollo" onValueChange={onValueChange} />)
  await user.click(await screen.findByRole("button", { name: "Clear project" }))
  const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Project" })
  expect(input.value).toBe("")
  expect(document.activeElement).toBe(input)
  expect(onValueChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "clear-press" }))
})

test("no axe violations, closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <ProjectCombobox defaultValue="apollo" />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Show projects" }))
  expect(screen.getByRole("listbox")).toBeTruthy()
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can find the combobox and choose a project by its label", async () => {
  const onValueChange = vi.fn()
  render(<ProjectCombobox onValueChange={onValueChange} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const combobox = components.find((entry) => entry.component === "combobox")
  expect(combobox?.label).toBe("Project")
  expect(combobox?.actions).toEqual(expect.arrayContaining(["setValue", "clear"]))

  const result = await act(() => agent.act({ steps: [{ ref: "Project", action: "setValue", args: ["Gemini"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Project" }).value).toBe("Gemini")
  expect(onValueChange).toHaveBeenLastCalledWith("gemini", expect.objectContaining({ source: "agent" }))
})
