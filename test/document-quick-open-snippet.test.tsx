import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { DocumentQuickOpen, DocumentWorkspace, type DocumentQuickOpenItem } from "@/components/ui/document-workspace"
import type { PageSource } from "@/lib/page-source"

type Note = { slug: string; title: string; folder?: string; body: string }

const notes: Note[] = [
  { slug: "plan", title: "Launch plan", folder: "Projects", body: "The budget for the launch, and the Budget review" },
  { slug: "goals", title: "Goals", body: "Ship the beta" },
  { slug: "html", title: "Markup", body: "<img src=x onerror=alert(1)> budget" },
]

const toItem = (note: Note): DocumentQuickOpenItem => ({
  value: note.slug,
  label: note.title,
  description: note.folder,
  snippet: note.body,
})

const source: PageSource<Note, { q?: string }> = {
  key: ["notes"],
  getId: (note) => note.slug,
  capabilities: { position: "page" },
  fetchPage: async (request) => {
    const q = request.filter.q?.toLowerCase() ?? ""
    return { items: notes.filter((note) => note.body.toLowerCase().includes(q)), hasMore: false }
  },
}

function Workspace({ quickOpen }: { quickOpen: React.ReactNode }) {
  return <DocumentWorkspace narrow={-1} document={<textarea aria-label="Note" />} quickOpen={quickOpen} />
}

async function openQuickOpen() {
  fireEvent.click(screen.getByRole("button", { name: "Quick open" }))
  const dialog = await screen.findByRole("dialog", { name: "Quick open" })
  return { dialog, input: within(dialog).getByRole("combobox", { name: "Quick open" }) }
}

const snippetOf = (option: HTMLElement) => option.querySelector<HTMLElement>("[data-slot=quick-open-snippet]")
const marks = (option: HTMLElement) => [...option.querySelectorAll("mark")].map((mark) => mark.textContent)

test("items: a snippet shows under the label, muted, clamped to two lines, with every query term marked", async () => {
  render(<Workspace quickOpen={<DocumentQuickOpen items={notes.map(toItem)} filter={false} onOpen={vi.fn()} />} />)
  const { dialog, input } = await openQuickOpen()
  const option = await within(dialog).findByRole("option", { name: /^Launch plan/ })
  const snippet = snippetOf(option)!
  expect(snippet.textContent).toBe(", The budget for the launch, and the Budget review")
  expect(snippet.className).toMatch(/\bline-clamp-2\b/)
  expect(snippet.className).toMatch(/\btext-caption\b/)
  expect(snippet.className).toMatch(/\btext-muted-foreground\b/)
  expect(marks(option)).toEqual([])

  fireEvent.change(input, { target: { value: "budget launch" } })
  await waitFor(() => expect(marks(option)).toEqual(["budget", "launch", "Budget"]))
  expect(snippet.textContent).toBe(", The budget for the launch, and the Budget review")
  expect(
    within(dialog)
      .getByRole("option", { name: /^Goals/ })
      .querySelector("mark"),
  ).toBeNull()
})

test("a snippet is text: markup in it never becomes elements", async () => {
  render(<Workspace quickOpen={<DocumentQuickOpen items={notes.map(toItem)} filter={false} onOpen={vi.fn()} />} />)
  const { dialog, input } = await openQuickOpen()
  fireEvent.change(input, { target: { value: "budget" } })
  const option = await within(dialog).findByRole("option", { name: /^Markup/ })
  await waitFor(() => expect(marks(option)).toEqual(["budget"]))
  expect(option.querySelector("img")).toBeNull()
  expect(snippetOf(option)?.textContent).toBe(", <img src=x onerror=alert(1)> budget")
})

test("source: the server's snippet shows and marks the query", async () => {
  render(<Workspace quickOpen={<DocumentQuickOpen source={source} getItem={toItem} onOpen={vi.fn()} debounce={0} />} />)
  const { dialog, input } = await openQuickOpen()
  fireEvent.change(input, { target: { value: "beta" } })
  await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(1))
  const option = within(dialog).getByRole("option")
  expect(option.querySelector("[data-slot=command-item-text]")?.textContent).toBe("Goals")
  await waitFor(() => expect(marks(option)).toEqual(["beta"]))
})

test("agents read the label, the folder and the snippet as the item", async () => {
  render(<Workspace quickOpen={<DocumentQuickOpen items={notes.map(toItem)} filter={false} onOpen={vi.fn()} />} />)
  const agent = createAgent({ allow: () => true })
  await agent.act({ steps: [{ ref: "Quick open", action: "press" }] })
  const dialog = await screen.findByRole("dialog", { name: "Quick open" })
  await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(3))
  const command = agent.snapshot().find((entry) => entry.component === "command" && !entry.offPage)
  expect(command?.items?.[0]).toEqual({
    value: "plan",
    label: "Launch plan, Projects, The budget for the launch, and the Budget review",
  })
  expect(command?.items?.[1]).toEqual({ value: "goals", label: "Goals, Ship the beta" })
})

test("long lists with snippets stay virtualized", async () => {
  const many = Array.from({ length: 400 }, (_, index) => ({
    value: `note-${String(index)}`,
    label: `Note ${String(index)}`,
    snippet: `Passage ${String(index)} of the note`,
  }))
  render(<Workspace quickOpen={<DocumentQuickOpen items={many} onOpen={vi.fn()} />} />)
  const { dialog } = await openQuickOpen()
  await waitFor(() => expect(within(dialog).queryAllByRole("option").length).toBeGreaterThan(0))
  expect(within(dialog).queryAllByRole("option").length).toBeLessThan(60)
})
