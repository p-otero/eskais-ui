import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { commonmarkLanguage, markdownKeymap } from "@codemirror/lang-markdown"
import {
  Language,
  LanguageDescription,
  LanguageSupport,
  ParseContext,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language"
import { parseCode, type MarkdownParser } from "@lezer/markdown"
import { Annotation, Compartment, EditorState, Text, type Extension } from "@codemirror/state"
import { EditorView, placeholder as placeholderText, type KeyBinding, type ViewUpdate } from "@codemirror/view"
import { classHighlighter } from "@lezer/highlight"

import { menuAwareKeymap } from "@/components/ui/markdown-editor-adapter"
import { blockPreview } from "@/components/ui/markdown-editor-blocks"
import { lineSeparatorExtension, toggleFormat } from "@/components/ui/markdown-editor-commands"
import { deleteMarker, indentList, outdentList, setHeading } from "@/components/ui/markdown-editor-lines"
import { livePreview, previewConfig, toggleTaskAt, type PreviewConfig } from "@/components/ui/markdown-editor-preview"
import { caretOutOfPrefix, frontmatterEnd } from "@/components/ui/markdown-editor-structure"
import { provisionalTriggers } from "@/components/ui/markdown-editor-provisional"
import { markdownEditorTheme } from "@/components/ui/markdown-editor-theme"
import { markdownExtensions } from "@/components/ui/markdown-syntax"
import { assumeType } from "@/lib/narrow"

/** Marks a transaction that came from `value`, so it never echoes back through `onChange`. */
const fromValue = Annotation.define<boolean>()

type CodeLanguages = readonly LanguageDescription[]
/** `"readonly"` keeps a leading YAML block as it is: edits inside it, or that would break its fences, are dropped. */
type FrontmatterEditing = "editable" | "readonly"
/** Where the caret starts: after a leading YAML block (on the line below its closing fence), or at the very start. */
type InitialCaret = "afterFrontmatter" | "start"
type EditorSettings = {
  label: string
  frontmatter?: FrontmatterEditing
  describedBy?: string
  readOnly: boolean
  placeholder?: string
  cspNonce?: string
  preview: PreviewConfig
}
type EditorHooks = {
  bridge: Extension
  onUpdate: (update: ViewUpdate) => void
  openWikilink: (slug: string, event: Event | undefined) => void
}

const supports = new WeakMap<CodeLanguages, LanguageSupport>()
const NO_LANGUAGES: CodeLanguages = []

// `markdown()` always builds an HTML language for inline tags, which pulls lang-html, lang-css and
// lang-javascript into the bundle; HTML here is shown as muted text, so the language is built directly.
function markdownSupport(languages: CodeLanguages) {
  let support = supports.get(languages)
  if (support) return support
  const codeParser = (info: string) => {
    const found = LanguageDescription.matchLanguageName(languages, info, true)
    if (!found) return null
    return found.support ? found.support.language.parser : ParseContext.getSkippingParser(found.load())
  }
  // @codemirror/lang-markdown types its language's parser as Lezer's base `Parser`; it is the commonmark
  // `MarkdownParser` configured with CodeMirror's fold and indent props, which a fresh one would lack.
  const parser = assumeType<MarkdownParser>(commonmarkLanguage.parser).configure([
    ...markdownExtensions,
    parseCode({ codeParser }),
  ])
  support = new LanguageSupport(new Language(commonmarkLanguage.data, parser, [], "markdown"))
  supports.set(languages, support)
  return support
}

const readOnlySlot = new Compartment()
const attributesSlot = new Compartment()
const previewSlot = new Compartment()
const placeholderSlot = new Compartment()
const nonceSlot = new Compartment()
const frontmatterSlot = new Compartment()

/**
 * Drops the part of an edit that falls in the frontmatter or on the line break after its closing fence, so the
 * block keeps every byte. Text from `value` still replaces it. Typing at the very start would break the opening
 * fence, so such a transaction is dropped whole; an insertion after a closing fence that ends the document goes
 * through, and `bodyAfterFence` starts it on a new line.
 */
const protectFrontmatter = EditorState.changeFilter.of((transaction) => {
  if (!transaction.docChanged || transaction.annotation(fromValue)) return true
  const { startState } = transaction
  const end = frontmatterEnd(startState)
  if (end < 0) return true
  const guard = Math.min(end + 1, startState.doc.length)
  let breaksFence = false
  transaction.changes.iterChangedRanges((from, to) => {
    if (from === 0 && to === 0) breaksFence = true
  })
  return breaksFence ? false : [0, guard]
})

const startsWithLineBreak = (text: Text) => text.lines > 1 && text.line(1).length === 0

/** Puts a line break before text inserted right after a closing fence that ends the document. */
const bodyAfterFence = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged || transaction.annotation(fromValue)) return transaction
  const { startState } = transaction
  const end = frontmatterEnd(startState)
  if (end < 0 || end !== startState.doc.length) return transaction
  let at = -1
  transaction.changes.iterChanges((fromA, _toA, fromB, _toB, inserted) => {
    if (fromA === end && inserted.length && !startsWithLineBreak(inserted)) at = fromB
  })
  if (at < 0) return transaction
  return [transaction, { changes: { from: at, insert: Text.of(["", ""]) }, sequential: true }]
})

const frontmatterExtension = (editing: FrontmatterEditing = "editable") =>
  editing === "readonly" ? [protectFrontmatter, bodyAfterFence] : []

const readOnlyExtension = (readOnly: boolean) => EditorState.readOnly.of(readOnly)
const attributesExtension = ({ label, describedBy, readOnly }: EditorSettings) =>
  EditorView.contentAttributes.of({
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": label,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(readOnly ? { "aria-readonly": "true" } : {}),
  })
const nonceExtension = (nonce?: string) => (nonce ? EditorView.cspNonce.of(nonce) : [])
const placeholderExtension = (text?: string) => (text ? placeholderText(text) : [])

function wikilinkAt(state: EditorState, pos: number) {
  for (const side of [1, -1] as const) {
    for (
      let node: ReturnType<typeof syntaxTree>["topNode"] | null = syntaxTree(state).resolveInner(pos, side);
      node;
      node = node.parent
    ) {
      if (node.name !== "Wikilink" && node.name !== "Embed") continue
      const target = node.getChild("WikilinkTarget")
      if (target) return { slug: state.sliceDoc(target.from, target.to).trim(), from: node.from, to: node.to }
    }
  }
  return null
}

const TASK_PREFIX = /^(\s*(?:[-*+]|\d+[.)])\s+)\[[ xX]\]/

function toggleTaskOnLine(view: EditorView, number: number) {
  if (view.state.readOnly || number < 1 || number > view.state.doc.lines) return false
  const line = view.state.doc.line(number)
  const prefix = TASK_PREFIX.exec(line.text)?.[1]
  return prefix !== undefined && toggleTaskAt(view, line.from + prefix.length)
}

function editorKeymap(hooks: EditorHooks): KeyBinding[] {
  return [
    {
      key: "Enter",
      run: (view) => {
        const { main } = view.state.selection
        const link = main.empty ? wikilinkAt(view.state, main.head) : null
        if (!link || main.head <= link.from || main.head >= link.to) return false
        hooks.openWikilink(link.slug, undefined)
        return true
      },
    },
    {
      key: "Mod-Enter",
      run: (view) => toggleTaskOnLine(view, view.state.doc.lineAt(view.state.selection.main.head).number),
    },
    { key: "Tab", run: indentList },
    { key: "Shift-Tab", run: outdentList },
    { key: "Backspace", run: deleteMarker },
    ...[0, 1, 2, 3, 4, 5, 6].map((level) => ({
      key: `Mod-Alt-${level}`,
      run: (view: EditorView) => setHeading(view, level),
    })),
    { key: "Mod-b", run: (view) => toggleFormat(view, "bold") },
    { key: "Mod-i", run: (view) => toggleFormat(view, "italic") },
    { key: "Mod-e", run: (view) => toggleFormat(view, "code") },
    { key: "Mod-Shift-x", run: (view) => toggleFormat(view, "strikethrough") },
    ...markdownKeymap,
    ...historyKeymap,
    ...defaultKeymap,
  ]
}

function createEditorState(
  doc: string,
  settings: EditorSettings,
  hooks: EditorHooks,
  languages = NO_LANGUAGES,
  caret: InitialCaret = "afterFrontmatter",
) {
  const state = EditorState.create({
    doc,
    extensions: [
      lineSeparatorExtension(doc),
      history(),
      markdownSupport(languages),
      syntaxHighlighting(classHighlighter),
      EditorView.lineWrapping,
      markdownEditorTheme,
      menuAwareKeymap(editorKeymap(hooks)),
      provisionalTriggers(fromValue),
      livePreview,
      blockPreview,
      caretOutOfPrefix,
      nonceSlot.of(nonceExtension(settings.cspNonce)),
      readOnlySlot.of(readOnlyExtension(settings.readOnly)),
      attributesSlot.of(attributesExtension(settings)),
      previewSlot.of(previewConfig.of(settings.preview)),
      placeholderSlot.of(placeholderExtension(settings.placeholder)),
      frontmatterSlot.of(frontmatterExtension(settings.frontmatter)),
      EditorView.domEventHandlers({
        mousedown(event, view) {
          if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          const link = pos === null ? null : wikilinkAt(view.state, pos)
          if (!link) return false
          hooks.openWikilink(link.slug, event)
          return true
        },
      }),
      EditorView.updateListener.of(hooks.onUpdate),
      hooks.bridge,
    ],
  })
  const end = caret === "afterFrontmatter" ? frontmatterEnd(state) : -1
  if (end < 0) return state
  return state.update({ selection: { anchor: Math.min(end + 1, state.doc.length) } }).state
}

function reconfigure(view: EditorView, settings: EditorSettings) {
  view.dispatch({
    effects: [
      readOnlySlot.reconfigure(readOnlyExtension(settings.readOnly)),
      attributesSlot.reconfigure(attributesExtension(settings)),
      previewSlot.reconfigure(previewConfig.of(settings.preview)),
      placeholderSlot.reconfigure(placeholderExtension(settings.placeholder)),
      nonceSlot.reconfigure(nonceExtension(settings.cspNonce)),
      frontmatterSlot.reconfigure(frontmatterExtension(settings.frontmatter)),
    ],
  })
}

export { createEditorState, fromValue, reconfigure, toggleTaskOnLine, wikilinkAt }
export type { CodeLanguages, EditorHooks, EditorSettings, FrontmatterEditing, InitialCaret }
