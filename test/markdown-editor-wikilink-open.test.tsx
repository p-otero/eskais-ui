import { redo, undo } from "@codemirror/commands"
import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, within } from "@testing-library/react"
import { createRef } from "react"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/ui/markdown-editor"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const tick = (ms = 0) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!
const suggest = vi.fn(async (query: string) =>
  ["roadmap", "risks"].filter((slug) => slug.includes(query)).map((slug) => ({ slug })),
)

async function mount(value: string) {
  const ref = createRef<MarkdownEditorHandle>()
  const onChange = vi.fn()
  const result = render(
    <MarkdownEditor
      ref={ref}
      label="Note"
      value={value}
      onChange={onChange}
      changeDelay={5}
      suggestWikilinks={suggest}
    />,
  )
  await tick()
  if (!ref.current) throw new Error("no handle")
  return { handle: ref.current, onChange, ...result }
}

const listbox = () => document.querySelector<HTMLElement>("[data-slot=trigger-menu-content][data-open] [role=listbox]")
const isOpen = () => document.querySelector("[data-slot=trigger-menu-content][data-open]") !== null

async function waitForOptions() {
  for (let tries = 0; tries < 20 && !listbox()?.querySelector("[role=option]"); tries++) await tick(10)
  return listbox()
}

async function typeChars(text: string) {
  const view = editorView()
  for (const char of text) {
    act(() => {
      const at = view.state.selection.main.head
      view.dispatch({ changes: { from: at, insert: char }, selection: { anchor: at + 1 }, userEvent: "input.type" })
    })
    await tick()
  }
}

async function openSuggestions(handle: MarkdownEditorHandle) {
  let opened = false
  act(() => {
    opened = handle.openWikilinkSuggestions()
  })
  expect(opened).toBe(true)
  expect(await waitForOptions()).not.toBeNull()
}

test("Escape after openWikilinkSuggestions restores the note byte for byte, with no onChange", async () => {
  const { handle, onChange } = await mount("Hola")
  await openSuggestions(handle)
  expect(handle.getValue()).toBe("[[Hola")
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(isOpen()).toBe(false)
  expect(handle.getValue()).toBe("Hola")
  expect(handle.getSelection().head).toBe(0)
  expect(onChange).not.toHaveBeenCalled()
})

test("a typed query is dropped too, and undo has nothing of the session to undo", async () => {
  const { handle, onChange } = await mount("see \n")
  act(() => handle.setSelection(4))
  await openSuggestions(handle)
  await typeChars("ro")
  expect(handle.getValue()).toBe("see [[ro\n")
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.getValue()).toBe("see \n")
  act(() => {
    undo(editorView())
  })
  expect(handle.getValue()).toBe("see \n")
  expect(onChange).not.toHaveBeenCalled()
})

test("leaving the editor dismisses the session the same way", async () => {
  const { handle, onChange } = await mount("Hola")
  await openSuggestions(handle)
  act(() => {
    editorView().contentDOM.blur()
    fireEvent.focusOut(editorView().contentDOM, { relatedTarget: document.body })
    fireEvent.pointerDown(document.body)
  })
  await tick(20)
  expect(isOpen()).toBe(false)
  expect(handle.getValue()).toBe("Hola")
  expect(onChange).not.toHaveBeenCalled()
})

test("choosing an item inserts the wikilink, one undo step from the original note", async () => {
  const { handle, onChange } = await mount("see \n")
  act(() => handle.setSelection(4))
  await openSuggestions(handle)
  await typeChars("ro")
  const options = await waitForOptions()
  fireEvent.click(within(options!).getByRole("option", { name: "roadmap" }))
  await tick(20)
  expect(handle.getValue()).toBe("see [[roadmap]]\n")
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenLastCalledWith("see [[roadmap]]\n")
  act(() => {
    undo(editorView())
  })
  expect(handle.getValue()).toBe("see \n")
  act(() => {
    redo(editorView())
  })
  expect(handle.getValue()).toBe("see [[roadmap]]\n")
})

test("a [[ typed by hand stays when the menu is dismissed", async () => {
  const { handle } = await mount("see \n")
  act(() => {
    handle.focus()
    handle.setSelection(4)
  })
  await typeChars("[[")
  expect(await waitForOptions()).not.toBeNull()
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.getValue()).toBe("see [[\n")
  act(() => handle.setSelection(6))
  await openSuggestions(handle)
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.getValue()).toBe("see [[\n")
})

test("an edit sent before the session still goes out, without the session's [[", async () => {
  const { handle, onChange } = await mount("Hola")
  act(() => handle.setSelection(4))
  await typeChars("!")
  await openSuggestions(handle)
  await tick(20)
  expect(onChange).toHaveBeenLastCalledWith("Hola!")
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.getValue()).toBe("Hola!")
  expect(onChange).toHaveBeenCalledTimes(1)
})

test("a query the user closes with ]] stays, as one undoable edit", async () => {
  const { handle, onChange } = await mount("see \n")
  act(() => handle.setSelection(4))
  await openSuggestions(handle)
  await typeChars("idea]]")
  await tick(20)
  expect(isOpen()).toBe(false)
  expect(handle.getValue()).toBe("see [[idea]]\n")
  expect(handle.getSelection().head).toBe("see [[idea]]".length)
  expect(onChange).toHaveBeenLastCalledWith("see [[idea]]\n")
  act(() => {
    undo(editorView())
  })
  expect(handle.getValue()).toBe("see \n")
})

test("a new value during the session replaces the note and ends the session", async () => {
  const { handle, onChange, rerender } = await mount("Hola")
  await openSuggestions(handle)
  rerender(<MarkdownEditor label="Note" value="Adiós" onChange={onChange} changeDelay={5} suggestWikilinks={suggest} />)
  await tick(20)
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.getValue()).toBe("Adiós")
  expect(onChange).not.toHaveBeenCalled()
})

async function mountWithSlash(
  value: string,
  run: (handle: MarkdownEditorHandle, range: { from: number; to: number }) => void,
) {
  const ref = createRef<MarkdownEditorHandle>()
  const onChange = vi.fn()
  const slashCommands = [
    {
      value: "link",
      label: "Link to a note",
      run: (view: EditorView, range: { from: number; to: number }) => {
        view.dispatch({ changes: range, selection: { anchor: range.from }, userEvent: "input.complete" })
        run(ref.current!, range)
      },
    },
  ]
  render(
    <MarkdownEditor
      ref={ref}
      label="Note"
      value={value}
      onChange={onChange}
      changeDelay={5}
      suggestWikilinks={suggest}
      slashCommands={slashCommands}
    />,
  )
  await tick()
  act(() => {
    ref.current!.focus()
    ref.current!.setSelection(value.length)
  })
  return { handle: ref.current!, onChange }
}

test("openWikilinkSuggestions from a slash command's run opens once the slash menu has closed", async () => {
  let opened: boolean | undefined
  const { handle, onChange } = await mountWithSlash("see ", (current) => {
    opened = current.openWikilinkSuggestions()
  })
  await typeChars("/li")
  const slash = await waitForOptions()
  fireEvent.click(within(slash!).getByRole("option", { name: "Link to a note" }))
  expect(opened).toBe(true)
  const options = await waitForOptions()
  expect(
    within(options!)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["roadmap", "risks"])
  expect(handle.getValue()).toBe("see [[")
  fireEvent.click(within(options!).getByRole("option", { name: "risks" }))
  await tick(20)
  expect(handle.getValue()).toBe("see [[risks]]")
  expect(onChange).toHaveBeenLastCalledWith("see [[risks]]")
})

test("dismissing suggestions a slash command opened leaves the note as the command left it", async () => {
  const { handle } = await mountWithSlash("see ", (current) => {
    current.openWikilinkSuggestions()
  })
  await typeChars("/li")
  fireEvent.keyDown(editorView().contentDOM, { key: "Enter" })
  expect(await waitForOptions()).not.toBeNull()
  expect(handle.getValue()).toBe("see [[")
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(isOpen()).toBe(false)
  expect(handle.getValue()).toBe("see ")
  act(() => {
    undo(editorView())
  })
  expect(handle.getValue()).toBe("see /li")
})
