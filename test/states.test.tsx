import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { StrictMode } from "react"
import { expect, test, vi } from "vitest"

import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"

import { axeViolations } from "./axe"

const agent = createAgent()

type Project = { id: string; name: string }

const labels = { errorTitle: "Couldn't load projects", retry: "Retry loading", emptyTitle: "No projects yet" }

function Projects({
  status,
  data,
  error,
  onRetry,
  keepPreviousData,
  fetching,
}: {
  status: DataStatus
  data?: Project[]
  error?: unknown
  onRetry?: () => unknown
  keepPreviousData?: boolean
  fetching?: boolean
}) {
  const common = { status, data, error, keepPreviousData, fetching }
  const list = (projects: Project[]) => (
    <ul aria-label="Projects">
      {projects.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  )
  return onRetry ? (
    <DataState {...common} onRetry={onRetry} labels={labels}>
      {list}
    </DataState>
  ) : (
    <DataState {...common} labels={labels}>
      {list}
    </DataState>
  )
}

const apollo = [{ id: "p1", name: "Apollo" }]

function shown() {
  if (screen.queryByRole("list", { name: "Projects" })) return "data"
  if (document.querySelector("[data-slot=error-state]")) return "error"
  if (document.querySelector("[data-slot=loading-state]")) return "loading"
  if (document.querySelector("[data-slot=empty]")) return "empty"
  return "nothing"
}

test("pending shows loading, success shows data, and an empty result shows empty", () => {
  const { rerender } = render(<Projects status="pending" />)
  expect(shown()).toBe("loading")
  rerender(<Projects status="success" data={apollo} />)
  expect(shown()).toBe("data")
  expect(screen.getByText("Apollo")).toBeTruthy()
  rerender(<Projects status="success" data={[]} />)
  expect(shown()).toBe("empty")
  expect(screen.getByText("No projects yet")).toBeTruthy()
})

test("it never shows empty while pending or after an error", () => {
  const { rerender } = render(<Projects status="pending" data={[]} />)
  expect(shown()).toBe("loading")
  rerender(<Projects status="pending" data={undefined} keepPreviousData={false} />)
  expect(shown()).toBe("loading")
  rerender(<Projects status="error" error={new Error("Network down")} data={[]} />)
  expect(shown()).toBe("error")
  rerender(<Projects status="error" error={new Error("Network down")} />)
  expect(shown()).toBe("error")
  expect(screen.queryByText("No projects yet")).toBeNull()
})

test("an error shows its message in an alert and retries through the button", async () => {
  const user = userEvent.setup()
  const retry = vi.fn()
  const { container } = render(<Projects status="error" error={new Error("Network down")} onRetry={retry} />)
  const alert = screen.getByRole("alert")
  expect(alert.textContent).toContain("Couldn't load projects")
  expect(alert.textContent).toContain("Network down")
  expect(alert.textContent).not.toContain("Retry loading")
  await user.click(screen.getByRole("button", { name: "Retry loading" }))
  expect(retry).toHaveBeenCalledOnce()
  expect(await axeViolations(container)).toEqual([])
})

test("a refetch keeps the previous data on screen, marked busy", () => {
  const { container, rerender } = render(<Projects status="success" data={apollo} />)
  const root = container.querySelector("[data-slot=data-state]")!
  expect(root.hasAttribute("aria-busy")).toBe(false)

  rerender(<Projects status="pending" data={undefined} />)
  expect(shown()).toBe("data")
  expect(root.getAttribute("aria-busy")).toBe("true")
  expect(screen.getByRole("status").textContent).toBe("Refreshing")

  rerender(<Projects status="success" data={[...apollo, { id: "p2", name: "Gemini" }]} />)
  expect(screen.getByText("Gemini")).toBeTruthy()
  expect(root.hasAttribute("aria-busy")).toBe(false)
  expect(screen.queryByRole("status")).toBeNull()

  rerender(<Projects status="success" data={apollo} fetching />)
  expect(shown()).toBe("data")
  expect(root.getAttribute("aria-busy")).toBe("true")
})

test("keepPreviousData={false} shows loading during a refetch", () => {
  const { rerender } = render(<Projects status="success" data={apollo} keepPreviousData={false} />)
  rerender(<Projects status="pending" keepPreviousData={false} />)
  expect(shown()).toBe("loading")
})

test("custom loading, empty and error slots replace the defaults", async () => {
  const user = userEvent.setup()
  const retry = vi.fn()
  function Custom({ status, data }: { status: DataStatus; data?: string[] }) {
    return (
      <DataState
        status={status}
        data={data}
        error="boom"
        loading={<p>Fetching…</p>}
        empty={<p>Nothing here</p>}
        onRetry={retry}
        renderError={(error, again) => (
          <button type="button" onClick={() => again?.()}>
            {String(error)}, again
          </button>
        )}
      >
        {(items) => <p>{items.join(", ")}</p>}
      </DataState>
    )
  }
  const { rerender } = render(<Custom status="pending" />)
  expect(screen.getByText("Fetching…")).toBeTruthy()
  rerender(<Custom status="success" data={[]} />)
  expect(screen.getByText("Nothing here")).toBeTruthy()
  rerender(<Custom status="error" />)
  await user.click(screen.getByRole("button", { name: "boom, again" }))
  expect(retry).toHaveBeenCalledOnce()
})

test("isEmpty decides what counts as empty", () => {
  render(
    <DataState
      status="success"
      data={{ total: 0 }}
      isEmpty={(page) => page.total === 0}
      labels={{ errorTitle: "Failed", emptyTitle: "No results" }}
    >
      {(page) => <p>{page.total}</p>}
    </DataState>,
  )
  expect(screen.getByText("No results")).toBeTruthy()
})

test("DataState forwards its root's attributes and keeps its own state attributes", () => {
  render(
    <DataState
      status="pending"
      data={undefined}
      data-testid="projects-state"
      id="projects"
      aria-label="Projects"
      data-status="ignored"
      labels={{ errorTitle: "Failed", emptyTitle: "No results" }}
    >
      {(page: string[]) => <p>{page.length}</p>}
    </DataState>,
  )
  const root = screen.getByTestId("projects-state")
  expect(root.id).toBe("projects")
  expect(root.getAttribute("aria-label")).toBe("Projects")
  expect(root.dataset.slot).toBe("data-state")
  expect(root.dataset.status).toBe("pending")
  expect(root.hasAttribute("labels")).toBe(false)
})

type Page = { items: Project[]; loaded: boolean }

function PagedProjects({ status, data, placeholderData }: { status: DataStatus; data?: Page; placeholderData?: Page }) {
  return (
    <DataState
      status={status}
      data={data}
      placeholderData={placeholderData}
      isEmpty={(page) => page.loaded && page.items.length === 0}
      labels={labels}
    >
      {(page) => (
        <ul aria-label="Projects">
          {page.items.map((project) => (
            <li key={project.id}>{project.name}</li>
          ))}
        </ul>
      )}
    </DataState>
  )
}

test("data passed while pending, before any success, still shows loading", () => {
  const { rerender } = render(<PagedProjects status="pending" data={{ items: [], loaded: false }} />)
  expect(shown()).toBe("loading")
  rerender(<PagedProjects status="pending" data={{ items: apollo, loaded: false }} />)
  expect(shown()).toBe("loading")
  rerender(<PagedProjects status="success" data={{ items: apollo, loaded: true }} />)
  expect(shown()).toBe("data")
})

test("an initial [] with a custom isEmpty shows loading, not content", () => {
  render(
    <DataState status="pending" data={[] as Project[]} isEmpty={() => false} labels={labels}>
      {(projects) => <ul aria-label="Projects">{projects.length}</ul>}
    </DataState>,
  )
  expect(shown()).toBe("loading")
})

test("only data from a past success is kept during a refetch", () => {
  const { container, rerender } = render(<Projects status="success" data={apollo} />)
  rerender(<Projects status="pending" data={[{ id: "p9", name: "Stale guess" }]} />)
  expect(shown()).toBe("data")
  expect(screen.getByText("Apollo")).toBeTruthy()
  expect(screen.queryByText("Stale guess")).toBeNull()
  expect(container.querySelector("[data-slot=data-state]")!.getAttribute("aria-busy")).toBe("true")
})

test("placeholderData shows as content, marked busy, until the first success", () => {
  const placeholder = { items: [{ id: "p0", name: "Cached Apollo" }], loaded: false }
  const { container, rerender } = render(<PagedProjects status="pending" placeholderData={placeholder} />)
  const root = container.querySelector("[data-slot=data-state]")!
  expect(screen.getByText("Cached Apollo")).toBeTruthy()
  expect(root.getAttribute("aria-busy")).toBe("true")
  rerender(<PagedProjects status="success" data={{ items: apollo, loaded: true }} placeholderData={placeholder} />)
  expect(screen.getByText("Apollo")).toBeTruthy()
  expect(root.hasAttribute("aria-busy")).toBe(false)
  rerender(<PagedProjects status="pending" placeholderData={placeholder} />)
  expect(screen.getByText("Apollo")).toBeTruthy()
  rerender(<PagedProjects status="error" placeholderData={placeholder} />)
  expect(shown()).toBe("error")
})

test("a new array on every render renders once per render, with no state update in render", () => {
  let parentRenders = 0
  let childRenders = 0
  function Parent({ status }: { status: DataStatus; tick?: number }) {
    parentRenders++
    const data = apollo.map((project) => ({ ...project }))
    return (
      <DataState status={status} data={data} isEmpty={() => false} labels={labels}>
        {(projects) => {
          childRenders++
          return <ul aria-label="Projects">{projects.map((project) => project.name)}</ul>
        }}
      </DataState>
    )
  }
  const { rerender } = render(<Parent status="success" />)
  for (let tick = 1; tick <= 5; tick++) rerender(<Parent status="success" tick={tick} />)
  expect(parentRenders).toBe(6)
  expect(childRenders).toBe(parentRenders)
  rerender(<Parent status="pending" />)
  rerender(<Parent status="success" />)
  expect(childRenders).toBe(parentRenders)
  expect(shown()).toBe("data")

  cleanup()
  render(
    <StrictMode>
      <Parent status="success" />
    </StrictMode>,
  )
  expect(shown()).toBe("data")
})

test("LoadingState is busy, with its label for screen readers only", async () => {
  const { container, rerender } = render(<LoadingState label="Loading projects" />)
  const root = container.querySelector("[data-slot=loading-state]")!
  expect(root.getAttribute("aria-busy")).toBe("true")
  expect(screen.getByRole("status").textContent).toBe("Loading projects")
  expect(screen.getByRole("status").className).toContain("sr-only")
  expect(root.querySelector("[data-slot=spinner]")).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
  rerender(<LoadingState label="Loading projects" variant="skeleton" rows={5} />)
  expect(root.querySelectorAll("[data-slot=skeleton]")).toHaveLength(5)
  expect(root.querySelector("[data-slot=spinner]")).toBeNull()
  expect(await axeViolations(container)).toEqual([])
})

test("ErrorState hides details behind a disclosure", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <ErrorState
      title="Couldn't save"
      message="The server answered 503."
      details="request-id: 7f3a9c"
      detailsLabel="Technical details"
    />,
  )
  expect(container.querySelector("[data-slot=error-state]")?.getAttribute("data-tone")).toBe("destructive")
  const trigger = screen.getByRole("button", { name: "Technical details" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  await user.click(trigger)
  expect(screen.getByText("request-id: 7f3a9c")).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("Empty has inline, panel and page sizes", () => {
  const { container, rerender } = render(
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No files</EmptyTitle>
      </EmptyHeader>
    </Empty>,
  )
  const root = container.querySelector("[data-slot=empty]")!
  expect(root.getAttribute("data-size")).toBe("panel")
  expect(root.className).toContain("border-dashed")
  rerender(
    <Empty size="inline">
      <EmptyTitle>No files</EmptyTitle>
    </Empty>,
  )
  expect(root.getAttribute("data-size")).toBe("inline")
  expect(root.className).not.toContain("border-dashed")
  rerender(
    <Empty size="page">
      <EmptyTitle>No files</EmptyTitle>
    </Empty>,
  )
  expect(root.className).toContain("py-section")
})

test("an agent finds the retry and details controls by name and retries", async () => {
  const retry = vi.fn()
  render(
    <ErrorState
      title="Couldn't load projects"
      onRetry={retry}
      retryLabel="Retry loading"
      details="503"
      detailsLabel="Technical details"
    />,
  )
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const names = entries.map((entry) => entry.label)
  expect(names).toContain("Retry loading")
  expect(names).toContain("Technical details")
  const result = await act(() =>
    agent.act({
      steps: [
        { ref: "Technical details", action: "open" },
        { ref: "Retry loading", action: "press" },
      ],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(retry).toHaveBeenCalledOnce()
  expect(screen.getByText("503")).toBeTruthy()
})

test("visible copy has no default: titles and the retry label are required by type", () => {
  const cases = [
    // @ts-expect-error errorTitle and emptyTitle are required without renderError and empty
    <DataState key="a" status="success" data={[]}>
      {() => null}
    </DataState>,
    // @ts-expect-error retry is required once onRetry is set
    <DataState
      key="b"
      status="error"
      data={[]}
      onRetry={() => {}}
      labels={{ errorTitle: "Failed", emptyTitle: "None" }}
    >
      {() => null}
    </DataState>,
    // @ts-expect-error retryLabel is required with onRetry
    <ErrorState key="c" title="Failed" onRetry={() => {}} />,
  ]
  expect(cases).toHaveLength(3)
})
