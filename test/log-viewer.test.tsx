import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"

import { LogViewer } from "@/components/ui/log-viewer"
import { logViewer } from "@/components/ui/log-viewer-primitive"
import { createLogStore, type LogStore } from "@/components/ui/log-viewer-store"

import { axeViolations } from "./axe"

const agent = createAgent()
const ESC = "\u001b"

// jsdom has no layout: the log is 200px tall and as high as its rows box says, so the virtualizer has a view.
const descriptors = {
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight"),
  scrollHeight: Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight"),
}
function scrollTo(this: Element, options?: ScrollToOptions | number) {
  if (typeof options === "object" && options.top !== undefined) this.scrollTop = options.top
}

beforeAll(() => {
  Element.prototype.scrollTo = scrollTo as Element["scrollTo"]
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.slot === "log-viewer-log" ? 200 : 0
    },
  })
  Object.defineProperty(Element.prototype, "scrollHeight", {
    configurable: true,
    get(this: Element) {
      const rows = this.querySelector<HTMLElement>('[data-slot="log-viewer-rows"]')
      return rows ? Number.parseFloat(rows.style.height || "0") : 0
    },
  })
})
afterAll(() => {
  if (descriptors.clientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", descriptors.clientHeight)
  if (descriptors.scrollHeight) Object.defineProperty(Element.prototype, "scrollHeight", descriptors.scrollHeight)
})
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard")
})

const now = (notify: () => void) => notify()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function environment(lines = 40) {
  const store = createLogStore({ schedule: now })
  store.append(
    Array.from({ length: lines }, (_, index) => {
      const source = ["frontend", "backend", "db"][index % 3] as string
      if (index === 10) return { text: `${ESC}[31;1mERROR${ESC}[0m connect ECONNREFUSED`, source, level: "error" }
      if (index === 30) return { text: "query failed: deadlock detected", source, level: "error" }
      return { text: `${ESC}[32mline ${String(index)}${ESC}[0m from ${source}`, source }
    }),
  )
  return store
}

function Viewer({ store, ...props }: { store: LogStore } & Partial<Parameters<typeof LogViewer>[0]>) {
  return <LogViewer store={store} label="Environment" sources={["frontend", "backend", "db"]} {...props} />
}

const lineTexts = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-slot="log-viewer-text"]')].map((node) => node.textContent)

test("primitive: renders on the server with a quiet log and a status region", () => {
  checkServer(
    logViewer,
    {},
    `<root aria-label="Logs"><log aria-label="Logs"></log><jump></jump><status></status></root>`,
  )
})

test("server render: a named group around a named log that doesn't read its rows out", () => {
  const html = renderToString(<Viewer store={environment()} />)
  expect(html).toContain('role="log"')
  expect(html).toContain('aria-live="off"')
  expect(html).toContain('role="status"')
  expect(html).toContain('aria-label="Environment"')
})

test("the tail renders, follows, and colours come from SGR codes as text, never as markup", async () => {
  const store = environment()
  const { container } = render(<Viewer store={store} />)
  await settle()
  const log = screen.getByRole("log", { name: "Environment" })
  expect(log.getAttribute("aria-live")).toBe("off")
  expect(log.tabIndex).toBe(0)
  const texts = lineTexts(container)
  expect(texts.at(-1)).toBe("line 39 from frontend")
  expect(texts.length).toBeLessThan(40)
  const green = container.querySelector('[data-line-id="40"] [data-slot="log-viewer-text"] span[style]')
  expect(green?.getAttribute("style")).toContain("oklch(from #0dbc79")

  await act(async () => store.append(`<img src=x onerror="alert(1)">${ESC}]8;;javascript:alert(2)${ESC}\\link`))
  await settle()
  expect(container.querySelector("img")).toBeNull()
  expect(lineTexts(container).at(-1)).toBe('<img src=x onerror="alert(1)">link')
  expect(container.querySelector('[data-slot="log-viewer"]')?.hasAttribute("data-following")).toBe(true)
  expect(await axeViolations(container)).toEqual([])
})

test("error lines are marked, counted and stepped through with F8 and the buttons", async () => {
  const user = userEvent.setup()
  const { container } = render(<Viewer store={environment()} />)
  await settle()
  expect(container.querySelector('[data-line-id="11"]')).toBeNull()
  expect(screen.getByText("2 errors")).toBeTruthy()
  screen.getByRole("log").focus()
  await user.keyboard("{Shift>}{F8}{/Shift}")
  const current = container.querySelector('[data-slot="log-viewer-line"][data-current]')
  expect(current?.getAttribute("data-line-id")).toBe("31")
  expect(current?.hasAttribute("data-error")).toBe(true)
  expect(container.querySelector('[data-slot="log-viewer"]')?.hasAttribute("data-following")).toBe(false)
  await user.click(screen.getByRole("button", { name: "Previous error" }))
  expect(container.querySelector("[data-current]")?.getAttribute("data-line-id")).toBe("11")
  await user.click(screen.getByRole("button", { name: "Next error" }))
  expect(container.querySelector("[data-current]")?.getAttribute("data-line-id")).toBe("31")
})

test("the isError pattern marks lines without a level", async () => {
  render(<Viewer store={environment()} isError={/econnrefused|deadlock|line 3\b/i} />)
  await settle()
  expect(screen.getByText("3 errors")).toBeTruthy()
})

test("scrolling up lets go of the end and counts new lines; End follows again", async () => {
  const user = userEvent.setup()
  const store = environment()
  const { container } = render(<Viewer store={store} />)
  await settle()
  const log = screen.getByRole("log")
  log.focus()
  await user.keyboard("{PageUp}")
  const root = container.querySelector('[data-slot="log-viewer"]')
  expect(root?.hasAttribute("data-following")).toBe(false)
  await act(async () => store.append(["one", "two", "three"]))
  await settle()
  const jump = container.querySelector('[data-slot="log-viewer-jump"]')
  expect(jump?.textContent).toContain("Jump to end")
  expect(jump?.textContent).toContain("3 new")
  await user.keyboard("{End}")
  expect(root?.hasAttribute("data-following")).toBe(true)
  expect(container.querySelector('[data-slot="log-viewer-jump"]')).toBeNull()
  expect(lineTexts(container).at(-1)).toBe("three")
})

test("the source filter and search narrow the lines; copy writes them as plain text", async () => {
  const user = userEvent.setup()
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
  const onCopy = vi.fn()
  const { container } = render(<Viewer store={environment(9)} onCopy={onCopy} />)
  await settle()
  const sources = screen.getByRole("group", { name: "Sources" })
  await user.click(within(sources).getByRole("button", { name: "backend" }))
  await user.click(within(sources).getByRole("button", { name: "db" }))
  await settle()
  expect(lineTexts(container)).toEqual(["line 0 from frontend", "line 3 from frontend", "line 6 from frontend"])
  await user.type(screen.getByRole("searchbox", { name: "Search the log" }), "LINE 3")
  await settle()
  expect(lineTexts(container)).toEqual(["line 3 from frontend"])
  expect(container.querySelector("mark")?.textContent).toBe("line 3")
  await user.click(screen.getByRole("button", { name: "Copy log" }))
  expect(writeText).toHaveBeenCalledWith("[frontend] line 3 from frontend")
  expect(onCopy).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy()
})

test("arrivals are announced politely and throttled: errors by default, a count with announce=lines", async () => {
  vi.useFakeTimers()
  try {
    const store = createLogStore({ schedule: now })
    render(<Viewer store={store} announceDelay={1000} />)
    const status = screen.getByRole("status")
    await act(async () =>
      store.append([{ text: "ok" }, { text: "bad", level: "error" }, { text: "worse", level: "error" }]),
    )
    expect(status.textContent).toBe("")
    await act(async () => vi.advanceTimersByTime(1000))
    expect(status.textContent).toBe("2 new errors")
    await act(async () => store.append("quiet"))
    await act(async () => vi.advanceTimersByTime(1000))
    expect(status.textContent).toBe("2 new errors")
  } finally {
    vi.useRealTimers()
  }
})

test("an agent reads the shown lines and filters, searches, steps through errors, copies and jumps", async () => {
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
  const { container } = render(<Viewer store={environment()} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const log = components.find((entry) => entry.label === "Environment")
  expect(log?.actions).toEqual(
    expect.arrayContaining(["filter", "search", "jumpToEnd", "nextError", "previousError", "copy", "setWrap"]),
  )
  const labels = components.map((entry) => entry.label)
  for (const label of ["Sources", "Search the log", "Wrap lines"]) expect(labels).toContain(label)

  const found = await agent.query({ within: "Environment", text: "deadlock" })
  expect(Array.isArray(found) && found[0]?.items).toEqual([
    { value: "31", label: "[frontend] query failed: deadlock detected" },
  ])

  const result = await agent.act({
    steps: [
      { ref: "Environment", action: "filter", args: [["backend"]] },
      { ref: "Environment", action: "search", args: ["econn"] },
      { ref: "Environment", action: "copy" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await settle()
  expect(writeText).toHaveBeenCalledWith("[backend] ERROR connect ECONNREFUSED")

  const none = await agent.act({ steps: [{ ref: "Environment", action: "nextError" }] })
  expect(none.ok).toBe(true)
  expect(container.querySelector("[data-current]")?.getAttribute("data-line-id")).toBe("11")
  const past = await agent.act({ steps: [{ ref: "Environment", action: "nextError" }] })
  expect(past.ok).toBe(false)
  expect(past.error?.message).toContain("nextError has no error after this one.")

  const unknown = await agent.act({ steps: [{ ref: "Environment", action: "filter", args: ["cache"] }] })
  expect(unknown.error?.message).toContain('No source "cache". Sources: frontend, backend, db.')

  const back = await agent.act({
    steps: [
      { ref: "Environment", action: "search", args: [""] },
      { ref: "Environment", action: "filter", args: [[]] },
      { ref: "Environment", action: "jumpToEnd" },
    ],
  })
  expect(back.ok, back.error?.message).toBe(true)
  await settle()
  expect(container.querySelector('[data-slot="log-viewer"]')?.hasAttribute("data-following")).toBe(true)
  expect(lineTexts(container).at(-1)).toBe("line 39 from frontend")
})
