"use client"

import { syntaxTree } from "@codemirror/language"
import type { EditorView } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"
import { useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MarkdownEditorLabels } from "@/components/ui/markdown-editor-labels"
import type { PortalEntry, PortalStore } from "@/components/ui/markdown-editor-widgets"
import { MarkdownView, type MarkdownViewProps } from "@/components/ui/markdown-view"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRequestMeasure } from "@/components/ui/use-markdown-editor"

type ViewOptions = Pick<MarkdownViewProps, "resolveWikilink" | "taskLabel">

function fenceAt(view: EditorView, host: HTMLElement) {
  const pos = view.posAtDOM(host)
  for (let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1); node; node = node.parent) {
    if (node.name === "FencedCode") return node
  }
  return null
}

function setCodeInfo(view: EditorView, host: HTMLElement, info: string) {
  const fence = fenceAt(view, host)
  const open = fence?.firstChild
  if (!fence || open?.name !== "CodeMark" || view.state.readOnly) return
  const current = fence.getChild("CodeInfo")
  const from = current?.from ?? open.to
  view.dispatch({ changes: { from, to: current?.to ?? open.to, insert: info }, userEvent: "input.format" })
}

function CodeLanguage({
  entry,
  labels,
}: {
  entry: Extract<PortalEntry, { kind: "code-language" }>
  labels: MarkdownEditorLabels
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(entry.info)
  const readOnly = entry.view.state.readOnly
  const name = entry.info || labels.plainText
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(entry.info)
        setOpen(next)
      }}
    >
      <PopoverTrigger
        variant="ghost"
        disabled={readOnly}
        aria-label={`${labels.codeLanguage}: ${name}`}
        className="h-auto rounded-full px-inset-chip py-inset-chip text-caption text-muted-foreground"
      >
        {name}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" finalFocus={() => entry.view.contentDOM} className="w-64 p-inline">
        <form
          className="flex items-center gap-inline"
          onSubmit={(event) => {
            event.preventDefault()
            setCodeInfo(entry.view, entry.host, draft.trim())
            setOpen(false)
          }}
        >
          <Input aria-label={labels.codeLanguage} value={draft} onValueChange={setDraft} className="h-control-sm" />
          <Button type="submit" size="sm">
            {labels.apply}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function TableBlock({ entry, options }: { entry: Extract<PortalEntry, { kind: "table" }>; options: ViewOptions }) {
  useRequestMeasure(entry.view)
  return (
    <div className="cursor-text overflow-x-auto">
      <MarkdownView markdown={entry.source} sourcePositions {...options} />
    </div>
  )
}

const keys = new WeakMap<HTMLElement, number>()
let nextKey = 0
const keyOf = (host: HTMLElement) => {
  let key = keys.get(host)
  if (key === undefined) keys.set(host, (key = nextKey++))
  return key
}

function MarkdownEditorPortals({
  store,
  labels,
  options,
}: {
  store: PortalStore
  labels: MarkdownEditorLabels
  options: ViewOptions
}) {
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return entries.map((entry) =>
    createPortal(
      entry.kind === "table" ? (
        <TableBlock entry={entry} options={options} />
      ) : (
        <CodeLanguage entry={entry} labels={labels} />
      ),
      entry.host,
      String(keyOf(entry.host)),
    ),
  )
}

export { MarkdownEditorPortals }
