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
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state"
import { EditorView, placeholder as placeholderText, type KeyBinding, type ViewUpdate } from "@codemirror/view"
import { classHighlighter } from "@lezer/highlight"

import { menuAwareKeymap } from "@/components/ui/markdown-editor-adapter"
import { blockPreview } from "@/components/ui/markdown-editor-blocks"
import { lineSeparatorExtension, toggleFormat } from "@/components/ui/markdown-editor-commands"
import { deleteMarker, indentList, outdentList, setHeading } from "@/components/ui/markdown-editor-lines"
import { livePreview, previewConfig, toggleTaskAt, type PreviewConfig } from "@/components/ui/markdown-editor-preview"
import { caretOutOfPrefix } from "@/components/ui/markdown-editor-structure"
import { markdownEditorTheme } from "@/components/ui/markdown-editor-theme"
import { markdownExtensions } from "@/components/ui/markdown-syntax"

/** Marks a transaction that came from `value`, so it never echoes back through `onChange`. */
const fromValue = Annotation.define<boolean>()

type CodeLanguages = readonly LanguageDescription[]
type EditorSettings = {
  label: string
  describedBy?: string
  readOnly: boolean
  placeholder?: string
  cspNonce?: string
  preview: PreviewConfig
}
type EditorHooks = {
  bridge: Extension
  onUpdate: (update: ViewUpdate) => void
  openWikilink: (slug: string) => void
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
  const parser = (commonmarkLanguage.parser as MarkdownParser).configure([
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
      if (node.name !== "Wikilink") continue
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
        hooks.openWikilink(link.slug)
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

function createEditorState(doc: string, settings: EditorSettings, hooks: EditorHooks, languages = NO_LANGUAGES) {
  return EditorState.create({
    doc,
    extensions: [
      lineSeparatorExtension(doc),
      history(),
      markdownSupport(languages),
      syntaxHighlighting(classHighlighter),
      EditorView.lineWrapping,
      markdownEditorTheme,
      menuAwareKeymap(editorKeymap(hooks)),
      livePreview,
      blockPreview,
      caretOutOfPrefix,
      nonceSlot.of(nonceExtension(settings.cspNonce)),
      readOnlySlot.of(readOnlyExtension(settings.readOnly)),
      attributesSlot.of(attributesExtension(settings)),
      previewSlot.of(previewConfig.of(settings.preview)),
      placeholderSlot.of(placeholderExtension(settings.placeholder)),
      EditorView.domEventHandlers({
        mousedown(event, view) {
          if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          const link = pos === null ? null : wikilinkAt(view.state, pos)
          if (!link) return false
          hooks.openWikilink(link.slug)
          return true
        },
      }),
      EditorView.updateListener.of(hooks.onUpdate),
      hooks.bridge,
    ],
  })
}

function reconfigure(view: EditorView, settings: EditorSettings) {
  view.dispatch({
    effects: [
      readOnlySlot.reconfigure(readOnlyExtension(settings.readOnly)),
      attributesSlot.reconfigure(attributesExtension(settings)),
      previewSlot.reconfigure(previewConfig.of(settings.preview)),
      placeholderSlot.reconfigure(placeholderExtension(settings.placeholder)),
      nonceSlot.reconfigure(nonceExtension(settings.cspNonce)),
    ],
  })
}

export { createEditorState, fromValue, reconfigure, toggleTaskOnLine, wikilinkAt }
export type { CodeLanguages, EditorHooks, EditorSettings }
