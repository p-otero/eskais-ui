import { StateEffect, StateField, type Extension } from "@codemirror/state"
import { EditorView, keymap, type KeyBinding } from "@codemirror/view"
import type { EditorChange, TextEditorAdapter } from "@ui-sdk/react/trigger-menu"

import { toDocText } from "@/components/ui/markdown-editor-commands"

const setMenuOpen = StateEffect.define<boolean>()
const menuOpen = StateField.define<boolean>({
  create: () => false,
  update: (open, transaction) => {
    for (const effect of transaction.effects) if (effect.is(setMenuOpen)) open = effect.value
    return open
  },
})

const MENU_KEYS = new Set(["Enter", "ArrowUp", "ArrowDown", "Tab", "Escape", "Home", "End", "PageUp", "PageDown"])

/**
 * CodeMirror's keydown listener sits on the content element before the menu's and prevents default when a
 * binding runs, which the menu respects. While the menu is open, its keys skip every binding instead.
 */
function menuAwareKeymap(bindings: readonly KeyBinding[]): Extension {
  return [
    menuOpen,
    keymap.of(
      bindings.map((binding) => {
        if (!binding.key || !MENU_KEYS.has(binding.key)) return binding
        const { run, shift } = binding
        return {
          ...binding,
          preventDefault: false,
          run: run && ((view) => !view.state.field(menuOpen) && run(view)),
          shift: shift && ((view) => !view.state.field(menuOpen) && shift(view)),
        }
      }),
    ),
  ]
}

/** The listener extension must be in the state before the view exists; the adapter attaches once it does. */
function createAdapterBridge() {
  const listeners = new Set<(change: EditorChange) => void>()
  const emit = (change: EditorChange) => listeners.forEach((listener) => listener(change))

  const extension = EditorView.updateListener.of((update) => {
    if (!listeners.size) return
    for (const transaction of update.transactions) {
      if (!transaction.docChanged) continue
      const user =
        transaction.isUserEvent("input.type") ||
        transaction.isUserEvent("input.paste") ||
        transaction.isUserEvent("delete")
      transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) =>
        emit({ type: "input", inserted: inserted.toString(), range: { start: fromA, end: toA }, user }),
      )
    }
    if (update.selectionSet && !update.docChanged) emit({ type: "selection" })
  })

  const onStart = () => emit({ type: "compositionstart" })
  const onEnd = () => emit({ type: "compositionend" })

  function attach(view: EditorView) {
    view.contentDOM.addEventListener("compositionstart", onStart)
    view.contentDOM.addEventListener("compositionend", onEnd)

    const adapter: TextEditorAdapter = {
      get element() {
        return view.contentDOM
      },
      textBefore(length) {
        const head = view.state.selection.main.head
        const offset = Math.max(0, head - length)
        return { text: view.state.doc.sliceString(offset, head, "\n"), offset }
      },
      selection() {
        if (!view.hasFocus) return null
        const { from, to } = view.state.selection.main
        return { start: from, end: to }
      },
      rectAt(offset) {
        const rect = view.coordsAtPos(Math.min(offset, view.state.doc.length))
        return rect && { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }
      },
      replace(range, content) {
        const text = toDocText(view.state, typeof content === "string" ? content : content.label)
        view.dispatch({
          changes: { from: range.start, to: range.end, insert: text },
          selection: { anchor: range.start + view.state.toText(text).length },
          userEvent: "input.complete",
          scrollIntoView: true,
        })
      },
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      composing: () => view.composing,
    }

    const detach = () => {
      view.contentDOM.removeEventListener("compositionstart", onStart)
      view.contentDOM.removeEventListener("compositionend", onEnd)
      listeners.clear()
    }
    return { adapter, detach }
  }

  return { extension, attach }
}

export { createAdapterBridge, menuAwareKeymap, menuOpen, setMenuOpen }
