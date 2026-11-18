import {
  Annotation,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type AnnotationType,
  type Extension,
} from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

/**
 * A trigger the handle typed for the user, and the query typed after it. Until an item is chosen it isn't part of
 * the note: `onChange`, the dirty state and undo never see it, and dismissing the menu takes it out again.
 */
type ProvisionalTrigger = {
  from: number
  to: number
  /** The text the trigger replaced, and the selection before it, to put back on dismissal. */
  original: string
  anchor: number
  head: number
}

/** Marks the transactions that type a provisional trigger or take it back out. */
const provisional = Annotation.define<boolean>()
const setProvisional = StateEffect.define<ProvisionalTrigger | null>()

const provisionalTrigger = StateField.define<ProvisionalTrigger | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setProvisional)) return effect.value
    if (!value || !transaction.docChanged) return value
    const { changes } = transaction
    const offset = changes.mapPos(value.from, 1) - value.from
    return {
      ...value,
      from: value.from + offset,
      to: changes.mapPos(value.to, 1),
      anchor: value.anchor + offset,
      head: value.head + offset,
    }
  },
})

function activeProvisional(state: EditorState) {
  return state.field(provisionalTrigger, false) ?? null
}

/**
 * The field, and a filter that keeps the query typed during a session out of undo history. A new `value`
 * (`fromValue`) ends the session: the note it brings is the note.
 */
function provisionalTriggers(fromValue: AnnotationType<boolean>): Extension {
  return [
    provisionalTrigger,
    EditorState.transactionExtender.of((transaction) => {
      const active = activeProvisional(transaction.startState)
      if (!active || !transaction.docChanged) return null
      if (transaction.annotation(fromValue)) return { effects: setProvisional.of(null) }
      return transaction.annotation(provisional) ? null : { annotations: Transaction.addToHistory.of(false) }
    }),
  ]
}

/** Whether a transaction is part of a provisional session, so `onChange` and the dirty state skip it. */
function isProvisional(transaction: Transaction) {
  return transaction.annotation(provisional) === true || activeProvisional(transaction.startState) !== null
}

/** The note without a provisional trigger: what `onChange` sends while a session is open. */
function committedDoc(state: EditorState) {
  const active = activeProvisional(state)
  if (!active) return state.sliceDoc()
  return state.sliceDoc(0, active.from) + active.original + state.sliceDoc(active.to)
}

/** Types `text` over `from`–`to` as a provisional trigger: out of history and out of `onChange`. */
function typeProvisional(view: EditorView, from: number, to: number, text: string) {
  const { state } = view
  const { anchor, head } = state.selection.main
  const end = from + state.toText(text).length
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: end },
    effects: setProvisional.of({ from, to: end, original: state.sliceDoc(from, to), anchor, head }),
    annotations: [provisional.of(true), Transaction.addToHistory.of(false)],
    scrollIntoView: true,
  })
}

/** Takes a provisional trigger and its query out again, putting back the text and the selection from before. */
function revertProvisional(view: EditorView) {
  const active = activeProvisional(view.state)
  if (!active) return null
  view.dispatch({
    changes: { from: active.from, to: active.to, insert: active.original },
    selection: { anchor: active.anchor, head: active.head },
    effects: setProvisional.of(null),
    annotations: [provisional.of(true), Transaction.addToHistory.of(false)],
  })
  return active
}

/**
 * Ends a session once the menu has closed. Text that is still only the trigger and a query goes; anything the user
 * made of it (a closing `]]`, a line break) stays, as one undoable edit.
 */
function settleProvisional(view: EditorView, trigger: string, query: RegExp) {
  const active = activeProvisional(view.state)
  if (!active) return
  const text = view.state.sliceDoc(active.from, active.to)
  const typed = text.startsWith(trigger) ? text.slice(trigger.length) : null
  const untouched = typed === null ? trigger.startsWith(text) : [...typed].every((char) => query.test(char))
  const caret = view.state.selection.main.head - active.from
  revertProvisional(view)
  if (untouched) return
  view.dispatch({
    changes: { from: active.from, to: active.from + active.original.length, insert: text },
    selection: { anchor: active.from + Math.max(0, Math.min(caret, text.length)) },
    userEvent: "input",
  })
}

export {
  activeProvisional,
  committedDoc,
  isProvisional,
  provisionalTriggers,
  revertProvisional,
  settleProvisional,
  typeProvisional,
}
export type { ProvisionalTrigger }
