import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { useState, type RefObject } from "react"
import { afterEach, beforeAll, expect, test, vi, type Mock } from "vitest"

import {
  DocumentOutline,
  DocumentQuickOpen,
  DocumentWorkspace,
  type DocumentEditor,
  type DocumentSaveState,
  type DocumentWorkspaceMode,
  type DocumentWorkspaceProps,
} from "@/components/ui/document-workspace"
import { extractHeadings, MarkdownView } from "@/components/ui/markdown-view"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})
afterEach(() => localStorage.clear())

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)))
const frames = () => act(() => new Promise((resolve) => setTimeout(resolve, 80)))

const markdown = "# Plan\n\nIntro\n\n## Goals\n\nText\n\n## Risks\n\nMore\n"
const headings = extractHeadings(markdown)

type FakeEditor = { focus: Mock; scrollToLine: Mock; setSelection: Mock; getScrollLine: Mock<() => number> }

function fakeEditor(): FakeEditor {
  return { focus: vi.fn(), scrollToLine: vi.fn(), setSelection: vi.fn(), getScrollLine: vi.fn(() => 1) }
}

const ignore = () => {}

type HarnessProps = Partial<DocumentWorkspaceProps> & {
  editor?: RefObject<DocumentEditor | null>
  onOpen?: (value: string) => void
}

function Harness({ editor, onOpen = ignore, ...props }: HarnessProps) {
  const [mode, setMode] = useState<DocumentWorkspaceMode>(props.defaultMode ?? "edit")
  return (
    <DocumentWorkspace
      mode={mode}
      onModeChange={setMode}
      explorer={
        <ul>
          <li>
            <a href="#/note/plan">Plan</a>
          </li>
        </ul>
      }
      tabs={<span>Plan</span>}
      breadcrumb={<span>Notes / Plan</span>}
      aside={<DocumentOutline />}
      quickOpen={
        <DocumentQuickOpen
          items={[
            { value: "plan", label: "Plan", group: "Notes" },
            { value: "risks", label: "Risks", description: "projects" },
          ]}
          onOpen={onOpen}
        />
      }
      document={
        mode === "edit" ? <textarea aria-label="Note" defaultValue={markdown} /> : <MarkdownView markdown={markdown} />
      }
      editorRef={editor}
      headings={headings}
      {...props}
    />
  )
}

test("landmarks and named toggles that expose their state, in the wide layout", async () => {
  render(<Harness narrow={-1} />)
  await settle()
  expect(screen.getByRole("navigation", { name: "Files" })).toBeTruthy()
  expect(screen.getByRole("region", { name: "Document" })).toBeTruthy()
  expect(screen.getByRole("complementary", { name: "Details" })).toBeTruthy()
  const files = screen.getByRole("button", { name: "Files" })
  const details = screen.getByRole("button", { name: "Details" })
  expect(files.getAttribute("aria-expanded")).toBe("true")
  expect(details.getAttribute("aria-expanded")).toBe("true")
  expect(document.getElementById(files.getAttribute("aria-controls")!)?.getAttribute("aria-label")).toBe("Files")
  expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeTruthy()
  expect(screen.getByRole("separator", { name: "Resize files" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Quick open" })).toBeTruthy()
})

test('documentAs="main" makes the document the main landmark', async () => {
  render(<Harness narrow={-1} documentAs="main" />)
  await settle()
  expect(screen.getByRole("main", { name: "Document" })).toBeTruthy()
})

test("the toggles collapse and restore the columns, and storageKey remembers it", async () => {
  const onExplorerOpenChange = vi.fn()
  const { unmount } = render(<Harness narrow={-1} storageKey="notes" onExplorerOpenChange={onExplorerOpenChange} />)
  await settle()
  const files = screen.getByRole("button", { name: "Files" })
  fireEvent.click(files)
  await settle()
  expect(onExplorerOpenChange).toHaveBeenLastCalledWith(false)
  // jsdom has no layout for the columns to collapse in; tooling/document-workspace-check.mjs sees them go in Chrome.
  expect(files.getAttribute("aria-expanded")).toBe("false")
  expect(JSON.parse(localStorage.getItem("notes") ?? "{}")).toMatchObject({ explorer: false })
  unmount()

  render(<Harness narrow={-1} storageKey="notes" />)
  await settle()
  expect(screen.getByRole("button", { name: "Files" }).getAttribute("aria-expanded")).toBe("false")
  fireEvent.click(screen.getByRole("button", { name: "Files" }))
  await settle()
  expect(screen.getByRole("button", { name: "Files" }).getAttribute("aria-expanded")).toBe("true")
  expect(JSON.parse(localStorage.getItem("notes") ?? "{}")).toMatchObject({ explorer: true })
})

test("narrow: the explorer is a drawer that starts closed, opens from its toggle and returns focus to the document", async () => {
  const onExplorerOpenChange = vi.fn()
  render(<Harness onExplorerOpenChange={onExplorerOpenChange} />)
  await settle()
  const files = screen.getByRole("button", { name: "Files" })
  expect(files.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.queryByRole("complementary")).toBeNull()

  fireEvent.click(files)
  await settle()
  const drawer = screen.getByRole("dialog", { name: "Files" })
  expect(within(drawer).getByRole("navigation", { name: "Files" })).toBeTruthy()
  expect(files.getAttribute("aria-expanded")).toBe("true")
  expect(onExplorerOpenChange).toHaveBeenLastCalledWith(true)

  fireEvent.click(within(drawer).getByRole("link", { name: "Plan" }))
  await settle()
  await frames()
  expect(screen.queryByRole("dialog", { name: "Files" })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Note" }))
})

test("narrow: the aside hides behind its toggle and opens as a drawer", async () => {
  render(<Harness />)
  await settle()
  const details = screen.getByRole("button", { name: "Details" })
  fireEvent.click(details)
  await settle()
  const drawer = screen.getByRole("dialog", { name: "Details" })
  expect(within(drawer).getByRole("complementary", { name: "Details" })).toBeTruthy()
  fireEvent.keyDown(drawer, { key: "Escape" })
  await settle()
  await frames()
  expect(details.getAttribute("aria-expanded")).toBe("false")
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Note" }))
})

function Saving() {
  const [state, setState] = useState<DocumentSaveState>("saved")
  const [conflict, setConflict] = useState(false)
  return (
    <>
      <Harness
        narrow={-1}
        saveState={state}
        labels={{ saving: "Guardando…" }}
        alert={conflict ? <p>Changed on disk</p> : undefined}
      />
      <button type="button" onClick={() => setState("saving")}>
        save
      </button>
      <button type="button" onClick={() => setConflict(true)}>
        conflict
      </button>
    </>
  )
}

test("the save state is a polite status, and the alert slot an assertive alert", async () => {
  render(<Saving />)
  await settle()
  const status = screen.getByRole("status")
  expect(status.tagName).toBe("OUTPUT")
  expect(status.textContent).toBe("Saved")
  fireEvent.click(screen.getByRole("button", { name: "save" }))
  expect(status.textContent).toBe("Guardando…")
  const alert = screen.getByRole("alert")
  expect(alert.textContent).toBe("")
  fireEvent.click(screen.getByRole("button", { name: "conflict" }))
  expect(screen.getByRole("alert")).toBe(alert)
  expect(alert.textContent).toBe("Changed on disk")
})

test("Ctrl+P opens quick open; choosing an item calls onOpen and focus goes back to the document", async () => {
  const onOpen = vi.fn()
  render(<Harness narrow={-1} onOpen={onOpen} />)
  await settle()
  fireEvent.keyDown(document.body, { key: "p", code: "KeyP", ctrlKey: true })
  await settle()
  const dialog = screen.getByRole("dialog", { name: "Quick open" })
  const input = within(dialog).getByRole("combobox", { name: "Quick open" })
  fireEvent.change(input, { target: { value: "risk" } })
  await settle()
  fireEvent.keyDown(input, { key: "Enter" })
  await settle()
  await frames()
  expect(onOpen).toHaveBeenCalledWith("risks")
  expect(screen.queryByRole("dialog", { name: "Quick open" })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Note" }))
})

test("the outline puts the caret at a heading in edit mode, and focuses the heading in read mode", async () => {
  const handle = fakeEditor()
  const editor = { current: handle } as RefObject<DocumentEditor | null>
  render(<Harness narrow={-1} editor={editor} />)
  await settle()
  const outline = screen.getByRole("navigation", { name: "Outline" })
  expect(
    within(outline)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Plan", "Goals", "Risks"])
  fireEvent.click(within(outline).getByRole("button", { name: "Goals" }))
  expect(handle.setSelection).toHaveBeenCalledWith(markdown.indexOf("Goals"))
  expect(handle.scrollToLine).toHaveBeenCalledWith(5)
  expect(handle.focus).toHaveBeenCalled()

  fireEvent.click(screen.getByRole("radio", { name: "Read" }))
  await settle()
  fireEvent.click(within(outline).getByRole("button", { name: "Risks" }))
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Risks" }))
})

test("switching modes keeps the reading position by heading", async () => {
  const handle = fakeEditor()
  handle.getScrollLine.mockReturnValue(6)
  const editor = { current: handle } as RefObject<DocumentEditor | null>
  // Where each element sits: the region's top is at 100, and the headings wherever `tops` says.
  const tops: Record<string, number> = { Document: 100, Plan: 100, Goals: 340, Risks: 600 }
  const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const name = this.getAttribute("aria-label") ?? this.textContent ?? ""
    return DOMRect.fromRect({ y: tops[name] ?? 0, height: 20 })
  })
  render(<Harness narrow={-1} editor={editor} />)
  await settle()
  const region = screen.getByRole("region", { name: "Document" })

  fireEvent.click(screen.getByRole("radio", { name: "Read" }))
  await frames()
  // Line 6 is under Goals, so Goals goes to the top of the read view.
  expect(region.scrollTop).toBe(240)

  // Back in edit mode, the heading at the top of the read view is the line the editor scrolls to.
  Object.assign(tops, { Plan: -300, Goals: 90, Risks: 400 })
  fireEvent.click(screen.getByRole("radio", { name: "Edit" }))
  await frames()
  expect(handle.scrollToLine).toHaveBeenLastCalledWith(headings[1]!.line)
  rect.mockRestore()
})

test("agents switch the mode, open the explorer and the aside, and run quick open by name", async () => {
  const onOpen = vi.fn()
  render(<Harness onOpen={onOpen} />)
  await settle()
  const agent = createAgent({ allow: () => true })
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = entries.map((entry) => entry.label)
  expect(labels).toEqual(expect.arrayContaining(["Mode", "Files", "Details", "Quick open"]))

  const mode = await agent.act({ steps: [{ ref: "Mode", action: "setValue", args: ["read"] }] })
  expect(mode.ok, mode.error?.message).toBe(true)
  await settle()
  expect(screen.getByRole("radio", { name: "Read" }).getAttribute("aria-checked")).toBe("true")
  expect(screen.getByRole("heading", { name: "Plan" })).toBeTruthy()

  const files = await agent.act({ steps: [{ ref: "Files", action: "press" }] })
  expect(files.ok, files.error?.message).toBe(true)
  await settle()
  expect(screen.getByRole("dialog", { name: "Files" })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Files" }), { key: "Escape" })
  await settle()
  await frames()

  const open = await agent.act({ steps: [{ ref: "Quick open", action: "press" }] })
  expect(open.ok, open.error?.message).toBe(true)
  await settle()
  expect(screen.getByRole("dialog", { name: "Quick open" })).toBeTruthy()
})
