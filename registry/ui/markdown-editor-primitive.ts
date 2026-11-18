import { definePrimitive } from "@ui-sdk/core"

import type { MarkdownFormat } from "@/components/ui/markdown-editor-commands"

type MarkdownEditorActions = {
  getMarkdown: () => string
  insertText: (text: string) => boolean
  replaceSelection: (text: string) => boolean
  insertWikilink: (slug: string, label?: string) => boolean
  toggleFormat: (format: MarkdownFormat) => boolean
  setHeading: (level: number) => boolean
  toggleTask: (line: number) => boolean
  setMarkdown: (markdown: string) => boolean
}

type MarkdownEditorOptions = { editor?: MarkdownEditorActions; readOnly?: boolean }

function handleOf(options: () => MarkdownEditorOptions, write: boolean) {
  const { editor, readOnly } = options()
  if (!editor) throw new Error("The editor isn't ready yet.")
  if (write && readOnly) throw new Error("This document is read-only.")
  return editor
}

const stateOf = (options: MarkdownEditorOptions) => ({ readOnly: Boolean(options.readOnly) })

const markdownEditor = definePrimitive({
  name: "markdown-editor",
  options: { editor: "value", readOnly: "boolean" },
  state: stateOf,
  sync: stateOf,
  api: (context) => ({
    getMarkdown: () => handleOf(context.options, false).getMarkdown(),
    insertText: (text: string) => handleOf(context.options, true).insertText(String(text)),
    replaceSelection: (text: string) => handleOf(context.options, true).replaceSelection(String(text)),
    insertWikilink: (slug: string, label?: string) =>
      handleOf(context.options, true).insertWikilink(String(slug), label === undefined ? undefined : String(label)),
    toggleFormat: (format: MarkdownFormat) => handleOf(context.options, true).toggleFormat(format),
    setHeading: (level: number) => handleOf(context.options, true).setHeading(Number(level)),
    toggleTask: (line: number) => handleOf(context.options, true).toggleTask(Number(line)),
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-readonly": state.readOnly ? "" : undefined }),
    }),
  }),
  agent: {
    actions: [
      "getMarkdown",
      "insertText",
      "replaceSelection",
      "insertWikilink",
      "toggleFormat",
      "setHeading",
      "toggleTask",
    ],
  },
})

type MarkdownDocumentOptions = MarkdownEditorOptions & { agentConfirm?: string }

const documentStateOf = (options: MarkdownDocumentOptions) => ({
  readOnly: Boolean(options.readOnly),
  agentConfirm: options.agentConfirm,
})

// A separate component so its confirm mark covers only the whole-document replacement, not the editor's other actions.
const markdownDocument = definePrimitive({
  name: "markdown-document",
  options: { editor: "value", readOnly: "boolean", agentConfirm: "string" },
  state: documentStateOf,
  sync: documentStateOf,
  api: (context) => ({
    setMarkdown: (markdown: string) => handleOf(context.options, true).setMarkdown(String(markdown)),
  }),
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: (state) => ({ "data-agent-confirm": state.agentConfirm }),
    }),
  }),
  agent: { actions: ["setMarkdown"], shown: (state) => !state.readOnly },
})

export { markdownDocument, markdownEditor }
export type { MarkdownEditorActions, MarkdownEditorOptions }
