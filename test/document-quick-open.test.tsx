import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import type { AsyncOptionsStatus } from "@ui-sdk/react/async-options"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import {
  DocumentQuickOpen,
  DocumentWorkspace,
  type DocumentQuickOpenItem,
  type DocumentQuickOpenProps,
} from "@/components/ui/document-workspace"
import type { PageRequest, PageSource } from "@/lib/page-source"

type Note = { slug: string; title: string; body: string }

const notes: Note[] = [
  { slug: "plan", title: "Launch plan", body: "The budget for the launch" },
  { slug: "goals", title: "Goals", body: "Ship the beta" },
  { slug: "budget", title: "Budget", body: "Numbers" },
  ...Array.from({ length: 30 }, (_, index) => ({
    slug: `log-${String(index)}`,
    title: `Log ${String(index)}`,
    body: "budget line",
  })),
]

/** Matches the query against titles and bodies, as a server's full-text search would. */
function bodySearch(
  match: (note: Note, q: string) => boolean = (note, q) => `${note.title} ${note.body}`.toLowerCase().includes(q),
  // A query that never settles on its own: only an abort ends it, so a test of the abort doesn't race the timer.
  stalls: (q: string) => boolean = () => false,
) {
  const requests: { request: PageRequest<{ q?: string }>; signal: AbortSignal }[] = []
  const source: PageSource<Note, { q?: string }> = {
    key: ["notes"],
    getId: (note) => note.slug,
    capabilities: { position: "page" },
    fetchPage: (request, { signal }) => {
      requests.push({ request, signal })
      const q = request.filter.q?.toLowerCase() ?? ""
      const found = notes.filter((note) => match(note, q))
      const page = "page" in request.position ? request.position.page : 1
      const items = found.slice((page - 1) * request.size, page * request.size)
      return new Promise((resolve, reject) => {
        const timer = stalls(q)
          ? undefined
          : setTimeout(() => resolve({ items, hasMore: found.length > page * request.size }), 20)
        signal.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(signal.reason)
        })
      })
    },
  }
  return { source, requests }
}

const toItem = (note: Note): DocumentQuickOpenItem => ({ value: note.slug, label: note.title })

function Workspace({ quickOpen }: { quickOpen: React.ReactNode }) {
  return <DocumentWorkspace narrow={-1} document={<textarea aria-label="Note" />} quickOpen={quickOpen} />
}

async function openQuickOpen() {
  fireEvent.click(screen.getByRole("button", { name: "Quick open" }))
  const dialog = await screen.findByRole("dialog", { name: "Quick open" })
  return { dialog, input: within(dialog).getByRole("combobox", { name: "Quick open" }) }
}

const statusOf = (dialog: HTMLElement) => dialog.querySelector("[data-slot=command-status]")?.textContent

const optionNames = (dialog: HTMLElement) =>
  within(dialog)
    .queryAllByRole("option")
    .map((option) => option.textContent)

test("source: searches the server as you type, keeping results whose title lacks the query", async () => {
  const { source, requests } = bodySearch()
  const onOpen = vi.fn()
  render(
    <Workspace
      quickOpen={<DocumentQuickOpen source={source} getItem={toItem} onOpen={onOpen} pageSize={5} debounce={10} />}
    />,
  )
  expect(requests).toHaveLength(0)

  const { dialog, input } = await openQuickOpen()
  await waitFor(() => expect(optionNames(dialog)).toHaveLength(5))
  expect(requests[0]?.request.filter).toEqual({})

  fireEvent.change(input, { target: { value: "b" } })
  fireEvent.change(input, { target: { value: "bu" } })
  fireEvent.change(input, { target: { value: "budget" } })
  await waitFor(() => expect(optionNames(dialog).slice(0, 2)).toEqual(["Launch plan", "Budget"]))
  // Only the last query reached the server once typing paused.
  const searches = requests.filter((entry) => entry.request.filter.q !== undefined)
  expect(searches.map((entry) => entry.request.filter.q)).toEqual(["budget"])
  expect(optionNames(dialog).slice(0, 2)).toEqual(["Launch plan", "Budget"])

  fireEvent.keyDown(input, { key: "Enter" })
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith("plan"))
})

test("source: a newer query aborts the request in flight, so a stale response never shows", async () => {
  const { source, requests } = bodySearch(undefined, (q) => q === "ship")
  render(<Workspace quickOpen={<DocumentQuickOpen source={source} getItem={toItem} onOpen={vi.fn()} debounce={0} />} />)
  const { dialog, input } = await openQuickOpen()
  await waitFor(() => expect(optionNames(dialog).length).toBeGreaterThan(0))
  fireEvent.change(input, { target: { value: "ship" } })
  await waitFor(() => expect(requests.some((entry) => entry.request.filter.q === "ship")).toBe(true))
  fireEvent.change(input, { target: { value: "numbers" } })
  await waitFor(() => expect(optionNames(dialog)).toEqual(["Budget"]))
  const ship = requests.find((entry) => entry.request.filter.q === "ship")
  expect(ship?.signal.aborted).toBe(true)
})

test("source: the next page loads at the end of the list", async () => {
  const { source, requests } = bodySearch()
  render(
    <Workspace
      quickOpen={<DocumentQuickOpen source={source} getItem={toItem} onOpen={vi.fn()} pageSize={5} debounce={0} />}
    />,
  )
  const { dialog, input } = await openQuickOpen()
  await waitFor(() => expect(optionNames(dialog)).toHaveLength(5))
  input.focus()
  for (let step = 0; step < 5; step++) fireEvent.keyDown(input, { key: "ArrowDown" })
  await waitFor(() => expect(optionNames(dialog)).toHaveLength(10))
  expect(requests.at(-1)?.request.position).toEqual({ page: 2 })
})

test("source: loading and errors show in the list and are read out", async () => {
  const source: PageSource<Note, { q?: string }> = {
    ...bodySearch().source,
    fetchPage: () => Promise.reject(new Error("offline")),
  }
  render(
    <Workspace
      quickOpen={
        <DocumentQuickOpen source={source} getItem={toItem} onOpen={vi.fn()} labels={{ error: "Search is offline" }} />
      }
    />,
  )
  const { dialog } = await openQuickOpen()
  await waitFor(() => expect(statusOf(dialog)).toBe("Search is offline"))
  expect(dialog.querySelector("[data-slot=command-empty]")?.textContent).toBe("Search is offline")
})

function OwnSearch({ onOpen }: { onOpen: (value: string) => void }) {
  const [items, setItems] = useState<DocumentQuickOpenItem[]>(notes.slice(0, 3).map(toItem))
  const [status, setStatus] = useState<AsyncOptionsStatus>("idle")
  const props: DocumentQuickOpenProps = {
    items,
    status,
    filter: false,
    onOpen,
    onQueryChange: (query) => {
      setStatus("loading")
      setTimeout(() => {
        setItems(
          notes
            .filter((note) => note.body.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map(toItem),
        )
        setStatus("idle")
      }, 20)
    },
  }
  return <Workspace quickOpen={<DocumentQuickOpen {...props} />} />
}

test("items with filter={false}, onQueryChange and status list your own search's results as they are", async () => {
  const onOpen = vi.fn()
  render(<OwnSearch onOpen={onOpen} />)
  const { dialog, input } = await openQuickOpen()
  fireEvent.change(input, { target: { value: "beta" } })
  expect(statusOf(dialog)).toBe("Searching…")
  await waitFor(() => expect(optionNames(dialog)).toEqual(["Goals"]))
  expect(statusOf(dialog)).toBe("1 result")
  fireEvent.keyDown(input, { key: "Enter" })
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith("goals"))
})

test("items without filter still filter in the browser, by label and keywords", async () => {
  render(
    <Workspace
      quickOpen={
        <DocumentQuickOpen
          items={[
            { value: "plan", label: "Launch plan", keywords: ["budget"] },
            { value: "goals", label: "Goals" },
          ]}
          onOpen={vi.fn()}
          labels={{ empty: (query) => `Nothing for ${query}` }}
        />
      }
    />,
  )
  const { dialog, input } = await openQuickOpen()
  fireEvent.change(input, { target: { value: "budget" } })
  await waitFor(() => expect(optionNames(dialog)).toEqual(["Launch plan"]))
  fireEvent.change(input, { target: { value: "zzz" } })
  await waitFor(() => expect(dialog.querySelector("[data-slot=command-empty]")?.textContent).toBe("Nothing for zzz"))
  expect(dialog.querySelector("[data-slot=command-status]")).toBeNull()
})

// UI SDK 0.1.0-beta.5 offers agents setValue, setQuery and setPages on a Command, not running one (command.test.tsx).
test("agents open quick open, search the server through setQuery and highlight a result", async () => {
  const { source, requests } = bodySearch()
  render(<Workspace quickOpen={<DocumentQuickOpen source={source} getItem={toItem} onOpen={vi.fn()} debounce={0} />} />)
  const agent = createAgent({ allow: () => true })
  const press = await agent.act({ steps: [{ ref: "Quick open", action: "press" }] })
  expect(press.ok, press.error?.message).toBe(true)
  const dialog = await screen.findByRole("dialog", { name: "Quick open" })
  await waitFor(() => expect(optionNames(dialog).length).toBeGreaterThan(0))
  const command = agent.snapshot().find((entry) => entry.component === "command" && !entry.offPage)
  expect(command?.label).toBe("Quick open")
  const searched = await agent.act({ steps: [{ ref: command!.ref, action: "setQuery", args: ["numbers"] }] })
  expect(searched.ok, searched.error?.message).toBe(true)
  await waitFor(() => expect(optionNames(dialog)).toEqual(["Budget"]))
  expect(requests.at(-1)?.request.filter).toEqual({ q: "numbers" })
  const chosen = await agent.act({ steps: [{ ref: command!.ref, action: "setValue", args: ["Budget"] }] })
  expect(chosen.ok, chosen.error?.message).toBe(true)
  expect(within(dialog).getByRole("option", { name: "Budget" }).dataset.highlighted).toBe("")
})
