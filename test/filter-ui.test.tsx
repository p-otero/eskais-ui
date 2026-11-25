import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState, type ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { FilterChips } from "@/components/ui/filter-chips"
import { FilterField } from "@/components/ui/filter-field"
import { FilterPanel, FilterPanelTrigger } from "@/components/ui/filter-panel"
import { FilterScope } from "@/components/ui/filter-scope"
import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { usePageController } from "@/components/ui/use-server-data"
import type { FilterField as FilterFieldDefinition } from "@/lib/filter-schema"

import { axeViolations } from "./axe"
import { serverTaskFilters as schema, taskSource, type ServerTaskFilter } from "./fixtures/server-tasks"

const agent = createAgent()
const source = taskSource({ key: ["test", "filter-ui"] })

const noFilter: ServerTaskFilter = {}

function Scope({ children, filter = noFilter }: { children: ReactNode; filter?: ServerTaskFilter }) {
  const { state, controller } = usePageController(source, { filter, search: { key: "q" } })
  return (
    <FilterScope schema={schema} controller={controller} label="Task filters">
      {children}
      <output data-testid="applied">{JSON.stringify(state.filter)}</output>
    </FilterScope>
  )
}

function current(): ServerTaskFilter {
  return JSON.parse(screen.getByTestId("applied").textContent || "{}") as ServerTaskFilter
}

function Panel() {
  const [open, setOpen] = useState(false)
  return (
    <Scope filter={{ archived: true }}>
      <FilterPanelTrigger open={open} onOpenChange={setOpen} count={1} />
      <FilterPanel open={open} onOpenChange={setOpen} />
    </Scope>
  )
}

function Editor({
  field,
  initial,
  onChange,
}: {
  field: FilterFieldDefinition
  initial?: unknown
  onChange: (value: unknown) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <FilterField
      field={field}
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("FilterField", () => {
  test("multiple options are checkboxes named by the field", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Editor field={schema.status} onChange={onChange} />)
    expect(screen.getByRole("group", { name: "Status" })).toBeTruthy()
    await user.click(screen.getByRole("checkbox", { name: "Blocked" }))
    await user.click(screen.getByRole("checkbox", { name: "Open" }))
    expect(onChange).toHaveBeenLastCalledWith(["open", "blocked"])
    await user.click(screen.getByRole("checkbox", { name: "Open" }))
    await user.click(screen.getByRole("checkbox", { name: "Blocked" }))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  test("a single option and a boolean are selects with Any", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <>
        <Editor field={schema.priority} onChange={onChange} />
        <Editor field={schema.archived} onChange={onChange} />
      </>,
    )
    await user.click(screen.getByRole("combobox", { name: "Priority" }))
    await user.click(await screen.findByRole("option", { name: "High" }))
    expect(onChange).toHaveBeenLastCalledWith("high")
    await user.click(screen.getByRole("combobox", { name: "Archived" }))
    await user.click(await screen.findByRole("option", { name: "Active" }))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  test("a number takes a comparison; between takes two numbers", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Editor field={schema.points} onChange={onChange} />)
    expect(screen.getByText("Value").tagName).toBe("LABEL")
    expect(screen.getByText("Comparison").tagName).toBe("LABEL")
    await user.type(screen.getByRole("textbox", { name: "Value" }), "5")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith({ op: "eq", value: 5 })
    await user.click(screen.getByRole("combobox", { name: "Comparison" }))
    await user.click(await screen.findByRole("option", { name: "At least" }))
    expect(onChange).toHaveBeenLastCalledWith({ op: "gte", value: 5 })
    await user.click(screen.getByRole("combobox", { name: "Comparison" }))
    await user.click(await screen.findByRole("option", { name: "Between" }))
    await user.type(screen.getByRole("textbox", { name: "Minimum" }), "2")
    await user.type(screen.getByRole("textbox", { name: "Maximum" }), "8")
    await user.tab()
    expect(onChange).toHaveBeenLastCalledWith({ op: "between", min: 2, max: 8 })
  })

  test("a date range has a From and a To", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Editor field={schema.created} onChange={onChange} />)
    const group = screen.getByRole("group", { name: "Created" })
    expect(within(group).getByText("From").tagName).toBe("LABEL")
    expect(within(group).getByText("To").tagName).toBe("LABEL")
    await user.type(within(group).getByRole("textbox", { name: "From" }), "2026-01-05{Enter}")
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-01-05" })
    await user.type(within(group).getByRole("textbox", { name: "To" }), "2026-01-31{Enter}")
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-01-05", to: "2026-01-31" })
  })
})

test("a remote option says Any until something is chosen", () => {
  render(<Editor field={schema.assignee} onChange={() => {}} />)
  expect(screen.getByRole("combobox", { name: "Assignee" }).getAttribute("placeholder")).toBe("Any")
})

function chipNames(toolbar: HTMLElement) {
  return within(toolbar)
    .queryAllByRole("button")
    .filter((button) => button.closest("[data-slot=filter-chip]") && !button.getAttribute("aria-label"))
    .map((button) => button.textContent)
}

describe("FilterChips", () => {
  test("one chip per active filter; a pick applies at once; remove returns focus to Add filter", async () => {
    const user = userEvent.setup()
    render(
      <Scope filter={{ status: ["open", "blocked"], q: "login" }}>
        <FilterChips />
      </Scope>,
    )
    const toolbar = screen.getByRole("toolbar", { name: "Filters" })
    const chip = within(toolbar).getByRole("button", { name: "Status: Open, Blocked" })
    expect(within(toolbar).queryByRole("button", { name: /Search/ })).toBeNull()

    await user.click(chip)
    await user.click(await screen.findByRole("checkbox", { name: "Done" }))
    expect(current().status).toEqual(["open", "blocked", "done"])
    await user.keyboard("{Escape}")
    await waitFor(() => expect(within(toolbar).getByRole("button", { name: "Status: 3 selected" })).toBeTruthy())

    await user.click(within(toolbar).getByRole("button", { name: "Remove Status filter" }))
    expect(current().status).toBeUndefined()
    expect(current().q).toBe("login")
    await waitFor(() =>
      expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "Add filter" })),
    )
  })

  test("Add filter opens the field's editor; leaving it empty adds nothing; reset clears the chips", async () => {
    const user = userEvent.setup()
    render(
      <Scope>
        <FilterChips />
      </Scope>,
    )
    const toolbar = screen.getByRole("toolbar", { name: "Filters" })
    await user.click(within(toolbar).getByRole("button", { name: "Add filter" }))
    await user.click(await screen.findByRole("menuitem", { name: "Priority" }))
    await user.click(await screen.findByRole("combobox", { name: "Priority" }))
    await user.click(await screen.findByRole("option", { name: "Urgent" }))
    expect(current().priority).toBe("urgent")
    await user.keyboard("{Escape}")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(within(toolbar).getByRole("button", { name: "Priority: Urgent" })).toBeTruthy())

    await user.click(within(toolbar).getByRole("button", { name: "Add filter" }))
    await user.click(await screen.findByRole("menuitem", { name: "Points" }))
    await screen.findByRole("textbox", { name: "Value" })
    await user.keyboard("{Escape}")
    await waitFor(() => expect(within(toolbar).queryByRole("button", { name: /^Points/ })).toBeNull())

    await user.click(within(toolbar).getByRole("button", { name: "Reset filters" }))
    expect(current()).toEqual({})
  })

  test("a chip keeps the place it was added in, not the schema's order, when set and when edited", async () => {
    const user = userEvent.setup()
    render(
      <Scope filter={{ points: { op: "gte", value: 3 } }}>
        <FilterChips />
      </Scope>,
    )
    const toolbar = screen.getByRole("toolbar", { name: "Filters" })
    await user.click(within(toolbar).getByRole("button", { name: "Add filter" }))
    await user.click(await screen.findByRole("menuitem", { name: "Status" }))
    expect(chipNames(toolbar)).toEqual(["Points: ≥ 3", "Status"])
    await user.click(await screen.findByRole("checkbox", { name: "Open" }))
    expect(chipNames(toolbar)).toEqual(["Points: ≥ 3", "Status: Open"])
    await user.keyboard("{Escape}")
    await waitFor(() => expect(chipNames(toolbar)).toEqual(["Points: ≥ 3", "Status: Open"]))

    await user.click(within(toolbar).getByRole("button", { name: "Points: ≥ 3" }))
    const value = await screen.findByRole("textbox", { name: "Value" })
    await user.clear(value)
    await user.type(value, "5{Enter}")
    await waitFor(() => expect(chipNames(toolbar)).toEqual(["Points: ≥ 5", "Status: Open"]))

    await user.click(within(toolbar).getByRole("button", { name: "Status: Open" }))
    await user.click(await screen.findByRole("checkbox", { name: "Open" }))
    await user.click(await screen.findByRole("checkbox", { name: "Done" }))
    expect(chipNames(toolbar)).toEqual(["Points: ≥ 5", "Status: Done"])
    await user.keyboard("{Escape}")

    await user.click(within(toolbar).getByRole("button", { name: "Remove Points filter" }))
    await user.click(within(toolbar).getByRole("button", { name: "Add filter" }))
    await user.click(await screen.findByRole("menuitem", { name: "Points" }))
    await user.type(await screen.findByRole("textbox", { name: "Value" }), "8{Enter}")
    await waitFor(() => expect(chipNames(toolbar)).toEqual(["Status: Done", "Points: = 8"]))
  })

  test("a filter an agent adds goes after the chips already there", async () => {
    render(
      <Scope filter={{ points: { op: "gte", value: 3 } }}>
        <FilterChips />
      </Scope>,
    )
    const toolbar = screen.getByRole("toolbar", { name: "Filters" })
    const result = await agent.act({
      steps: [{ ref: "Task filters", action: "filter", args: ["Status", ["Open"]] }],
    })
    expect(result.ok, result.error?.message).toBe(true)
    await waitFor(() => expect(chipNames(toolbar)).toEqual(["Points: ≥ 3", "Status: Open"]))
  })
})

describe("FilterPanel", () => {
  test("a side panel on wide screens: the draft applies on Apply, Reset clears its fields", async () => {
    const user = userEvent.setup()
    const { container } = render(<Panel />)
    await user.click(screen.getByRole("button", { name: /Filters/ }))
    const panel = screen.getByRole("complementary", { name: "Filters" })
    await user.click(within(panel).getByRole("checkbox", { name: "Blocked" }))
    expect(current().status).toBeUndefined()
    await user.click(within(panel).getByRole("button", { name: "Apply filters" }))
    expect(current()).toEqual({ archived: true, status: ["blocked"] })
    expect(screen.getByRole("complementary", { name: "Filters" })).toBeTruthy()
    await user.click(within(panel).getByRole("button", { name: "Reset" }))
    expect(current()).toEqual({})
    expect(await axeViolations(container)).toEqual([])
  })

  test("a bottom sheet on narrow screens, closed by Apply", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("47.5rem"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const user = userEvent.setup()
    render(<Panel />)
    await user.click(screen.getByRole("button", { name: /Filters/ }))
    const sheet = await screen.findByRole("dialog", { name: "Filters" })
    expect(sheet.getAttribute("data-side")).toBe("bottom")
    await user.click(within(sheet).getByRole("checkbox", { name: "Done" }))
    await user.click(within(sheet).getByRole("button", { name: "Apply filters" }))
    expect(current().status).toEqual(["done"])
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull())
  })
})

describe("ServerDataTable filter UIs", () => {
  const labels = { errorTitle: "Couldn't load", retry: "Retry", emptyTitle: "Nothing" }
  const columns = [{ id: "id", header: "Task", cell: (task: { id: string }) => task.id }]

  function renderTable(filterUi: "chips" | "panel") {
    const client = createDataClient({ retryDelay: 0 })
    return render(
      <DataProvider client={client}>
        <ServerDataTable
          label="Tasks"
          source={taskSource({ key: ["test", "filter-ui", filterUi] })}
          columns={columns}
          filters={schema}
          filterUi={filterUi}
          pageSize={5}
          labels={labels}
        />
      </DataProvider>,
    )
  }

  test("chips: search and a filters toolbar; agents still filter by label", async () => {
    renderTable("chips")
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeTruthy()
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeTruthy()
    const result = await agent.act({
      steps: [{ ref: "Tasks filters", action: "filter", args: ["Priority", "Urgent"] }],
    })
    expect(result.ok, result.error?.message).toBe(true)
    await waitFor(() => expect(screen.getByRole("button", { name: "Priority: Urgent" })).toBeTruthy())
  })

  test("panel: a trigger with the count, the panel beside the table", async () => {
    const user = userEvent.setup()
    renderTable("panel")
    await user.click(screen.getByRole("button", { name: "Filters" }))
    const panel = screen.getByRole("complementary", { name: "Filters" })
    await user.click(within(panel).getByRole("checkbox", { name: "Open" }))
    await user.click(within(panel).getByRole("button", { name: "Apply filters" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Filters 1" })).toBeTruthy())
    act(() => {
      within(panel).getByRole("button", { name: "Close" }).click()
    })
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filters 1" }))
  })
})
