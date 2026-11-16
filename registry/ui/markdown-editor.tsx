"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { useId, useMemo, useState } from "react"

import { setMenuOpen } from "@/components/ui/markdown-editor-adapter"
import {
  insertAtCaret,
  insertAtSelection,
  insertWikilink,
  replaceDocument,
  toggleFormat,
} from "@/components/ui/markdown-editor-commands"
import {
  markdownEditorLabelsEn,
  markdownEditorLabelsEs,
  type MarkdownEditorLabels,
} from "@/components/ui/markdown-editor-labels"
import { headingLevel, setHeading } from "@/components/ui/markdown-editor-lines"
import {
  MarkdownEditorMenus,
  markdownSlashCommands,
  type SlashCommand,
  type SuggestWikilinks,
} from "@/components/ui/markdown-editor-menus"
import { MarkdownEditorPortals } from "@/components/ui/markdown-editor-portals"
import { markdownDocument, markdownEditor, type MarkdownEditorHandle } from "@/components/ui/markdown-editor-primitive"
import { toggleTaskOnLine, type CodeLanguages, type EditorSettings } from "@/components/ui/markdown-editor-state"
import type { MarkdownConflict } from "@/components/ui/markdown-editor-sync"
import { MarkdownEditorToolbar } from "@/components/ui/markdown-editor-toolbar"
import { PortalStore } from "@/components/ui/markdown-editor-widgets"
import type { WikilinkResolver } from "@/components/ui/markdown-syntax"
import { fieldSurfaceClassName } from "@/components/ui/input"
import { useMarkdownEditorView } from "@/components/ui/use-markdown-editor"
import { cn } from "@/lib/utils"

const { Root: EditorRoot } = createParts(markdownEditor, { root: "div" })
const { Root: DocumentRoot } = createParts(markdownDocument, { root: "div" })

type MarkdownEditorProps = {
  /** Accessible name of the editor and its text box. */
  label: string
  value?: string
  defaultValue?: string
  /** Debounced by `changeDelay`; flushed on blur and unmount. Never called for `value` itself. */
  onChange?: (markdown: string) => void
  changeDelay?: number
  /** Whether the text differs from the last `value` (or `defaultValue`), counting edits `onChange` hasn't sent yet. */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * Runs when a new `value` arrives while edits are still waiting for `onChange`. Return the text to keep, or
   * nothing to take `remote`. Without it, the local text goes out through `onChange` first, then `remote` applies.
   */
  onConflict?: (conflict: MarkdownConflict) => string | undefined | void
  readOnly?: boolean
  placeholder?: string
  resolveWikilink?: WikilinkResolver
  suggestWikilinks?: SuggestWikilinks
  onOpenWikilink?: (slug: string) => void
  slashCommands?: SlashCommand[]
  /** Languages for fenced code, loaded when a block first uses one; read once, at mount. */
  codeLanguages?: CodeLanguages
  /** Nonce for the style element CodeMirror injects, for pages with a strict Content Security Policy. */
  cspNonce?: string
  toolbar?: boolean
  labels?: Partial<MarkdownEditorLabels>
  className?: string
}

function MarkdownEditor(props: MarkdownEditorProps) {
  const { label, readOnly = false, placeholder, resolveWikilink, cspNonce, toolbar = true, className } = props
  const labels = useMemo(() => ({ ...markdownEditorLabelsEn, ...props.labels }), [props.labels])
  const slashCommands = useMemo(
    () => props.slashCommands ?? markdownSlashCommands(labels),
    [props.slashCommands, labels],
  )
  const hintId = useId()
  const [portals] = useState(() => new PortalStore())

  const settings = useMemo<EditorSettings>(
    () => ({
      label,
      describedBy: hintId,
      readOnly,
      placeholder,
      cspNonce,
      preview: { resolve: resolveWikilink, taskLabel: labels.task, portals },
    }),
    [label, hintId, readOnly, placeholder, cspNonce, resolveWikilink, labels.task, portals],
  )
  const { hostRef, view, adapter, sync } = useMarkdownEditorView(props, settings)

  const handle = useMemo<MarkdownEditorHandle | undefined>(() => {
    if (!view) return undefined
    return {
      getMarkdown: () => view.state.sliceDoc(),
      insertText: (text) => insertAtCaret(view, text),
      replaceSelection: (text) => insertAtSelection(view, text),
      insertWikilink: (slug, wikilinkLabel) => insertWikilink(view, slug, wikilinkLabel),
      toggleFormat: (format) => toggleFormat(view, format),
      setHeading: (level) => setHeading(view, level),
      toggleTask: (line) => toggleTaskOnLine(view, line),
      setMarkdown: (markdown) => {
        if (!replaceDocument(view, markdown)) sync.rebuild(markdown)
        return true
      },
    }
  }, [view, sync])

  return (
    <EditorRoot
      editor={handle}
      readOnly={readOnly}
      aria-label={label}
      className={cn(
        `${fieldSurfaceClassName} flex min-h-0 flex-col overflow-hidden rounded-choice text-body has-[.cm-focused]:ring-2 has-[.cm-focused]:ring-ring data-readonly:bg-transparent data-readonly:shadow-none`,
        className,
      )}
    >
      {toolbar && !readOnly && (
        <MarkdownEditorToolbar
          labels={labels}
          headingLevel={() => (view ? headingLevel(view.state) : 0)}
          restoreFocus={() => view?.contentDOM ?? null}
          onFormat={(format) => {
            if (!view) return
            toggleFormat(view, format)
            view.focus()
          }}
          onHeading={(level) => {
            if (!view) return
            setHeading(view, level)
            view.focus()
          }}
        />
      )}
      <DocumentRoot
        editor={handle}
        readOnly={readOnly}
        agentConfirm={labels.setMarkdownConfirm}
        aria-label={labels.document}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div ref={hostRef} data-slot="markdown-editor-content" className="h-full" />
      </DocumentRoot>
      <p id={hintId} hidden>
        {labels.usageHint}
      </p>
      <MarkdownEditorPortals store={portals} labels={labels} options={{ resolveWikilink, taskLabel: labels.task }} />
      {!readOnly && (
        <MarkdownEditorMenus
          adapter={adapter}
          view={view}
          slashCommands={slashCommands}
          suggestWikilinks={props.suggestWikilinks}
          emptyLabel={labels.noMatches}
          onOpenChange={(open) => view?.dispatch({ effects: setMenuOpen.of(open) })}
        />
      )}
    </EditorRoot>
  )
}

export { MarkdownEditor, markdownEditorLabelsEn, markdownEditorLabelsEs, markdownSlashCommands }
export type { MarkdownConflict, MarkdownEditorLabels, MarkdownEditorProps, SlashCommand, SuggestWikilinks }
