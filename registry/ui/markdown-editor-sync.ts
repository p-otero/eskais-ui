import { Transaction, type EditorState, type Text } from "@codemirror/state"
import type { EditorView, ViewUpdate } from "@codemirror/view"
import { useState, type RefObject } from "react"

import { replaceDocument } from "@/components/ui/markdown-editor-commands"
import { committedDoc, isProvisional } from "@/components/ui/markdown-editor-provisional"
import { fromValue } from "@/components/ui/markdown-editor-state"

type MarkdownConflict = { local: string; remote: string }

type SyncProps = {
  onChange?: (markdown: string) => void
  onDirtyChange?: (dirty: boolean) => void
  onConflict?: (conflict: MarkdownConflict) => string | undefined | void
  changeDelay?: number
}

const noop = () => {}

/** Keeps the editor and the `value` prop in step: debounced `onChange`, dirty state and outside updates. */
function createSync(props: RefObject<SyncProps>) {
  let view: EditorView | undefined
  let rebuildState: (markdown: string) => void = noop
  let baseline: Text | undefined
  let emitted: string | undefined
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const updateDirty = (state: EditorState) => {
    const next = baseline ? !state.doc.eq(baseline) : false
    if (next === dirty) return
    dirty = next
    props.current.onDirtyChange?.(next)
  }
  const emit = (markdown: string) => {
    emitted = markdown
    props.current.onChange?.(markdown)
  }
  const flush = () => {
    if (timer === undefined || !view) return
    clearTimeout(timer)
    timer = undefined
    emit(committedDoc(view.state))
  }
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(flush, props.current.changeDelay ?? 300)
  }
  const apply = (markdown: string) => {
    if (!view) return
    if (!replaceDocument(view, markdown, [fromValue.of(true), Transaction.addToHistory.of(false)]))
      rebuildState(markdown)
  }

  return {
    attach(editor: EditorView, initial: string, rebuild: (markdown: string) => void) {
      view = editor
      rebuildState = rebuild
      baseline = editor.state.doc
      emitted = initial
      return () => {
        flush()
        view = undefined
      }
    },
    onUpdate(update: ViewUpdate) {
      if (update.focusChanged && !update.view.hasFocus) flush()
      if (!update.docChanged) return
      if (update.transactions.every(isProvisional)) return
      updateDirty(update.state)
      if (update.transactions.some((transaction) => transaction.annotation(fromValue))) return
      schedule()
    },
    receive(value: string) {
      if (!view) return
      if (value !== emitted && value !== view.state.sliceDoc()) {
        if (timer === undefined) apply(value)
        else {
          clearTimeout(timer)
          timer = undefined
          const local = view.state.sliceDoc()
          const { onConflict } = props.current
          if (onConflict) {
            const kept = onConflict({ local, remote: value })
            apply(typeof kept === "string" ? kept : value)
            if (typeof kept === "string" && kept !== value) schedule()
          } else {
            emit(local)
            apply(value)
          }
        }
      }
      emitted = value
      baseline = view.state.toText(value)
      updateDirty(view.state)
    },
    rebuild: (markdown: string) => rebuildState(markdown),
  }
}

function useMarkdownSync(props: RefObject<SyncProps>) {
  const [sync] = useState(() => createSync(props))
  return sync
}

export { useMarkdownSync }
export type { MarkdownConflict }
