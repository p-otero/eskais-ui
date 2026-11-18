"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { createTriggerMenuController } from "@ui-sdk/react/trigger-menu"
import { useId, useMemo, useState, type ReactNode, type Ref } from "react"

import { openProvisionally, setMenuOpen } from "@/components/ui/markdown-editor-adapter"
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
  WIKILINK_QUERY,
  type SlashCommand,
  type SuggestWikilinks,
} from "@/components/ui/markdown-editor-menus"
import type {
  HandleMenus,
  InsertTextOptions,
  MarkdownBlockKind,
  MarkdownEditorCommand,
  MarkdownEditorHandle,
  MarkdownSelection,
} from "@/components/ui/markdown-editor-handle"
import { settleProvisional } from "@/components/ui/markdown-editor-provisional"
import { MarkdownEditorPortals } from "@/components/ui/markdown-editor-portals"
import { markdownDocument, markdownEditor, type MarkdownEditorActions } from "@/components/ui/markdown-editor-primitive"
import {
  toggleTaskOnLine,
  type CodeLanguages,
  type EditorSettings,
  type FrontmatterEditing,
  type InitialCaret,
} from "@/components/ui/markdown-editor-state"
import type { MarkdownConflict } from "@/components/ui/markdown-editor-sync"
import { MarkdownEditorToolbar } from "@/components/ui/markdown-editor-toolbar"
import { PortalStore } from "@/components/ui/markdown-editor-widgets"
import type { WikilinkResolver } from "@/components/ui/markdown-syntax"
import { fieldSurfaceClassName } from "@/components/ui/input"
import { useEditorHandle, useMarkdownEditorView } from "@/components/ui/use-markdown-editor"
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
  /**
   * `"readonly"` protects a leading YAML block: typing, deleting or pasting into it, or across its fences, leaves it
   * as written, so the Markdown round-trips byte for byte. A new `value` still replaces it. `"editable"` by default.
   */
  frontmatter?: FrontmatterEditing
  /** Where the caret starts: on the line after a leading YAML block (default), or `"start"`. Read at mount. */
  initialCaret?: InitialCaret
  placeholder?: string
  resolveWikilink?: WikilinkResolver
  suggestWikilinks?: SuggestWikilinks
  /** Ctrl/Cmd+click on a wikilink or an embed, or Enter with the caret inside one. `event` is the click. */
  onWikilinkClick?: (target: string, event: Event | undefined) => void
  /** Like `onWikilinkClick`, with the target only. */
  onOpenWikilink?: (slug: string) => void
  /** Shows `![[target]]` off the caret as a preview: `renderEmbed`, or a link-like placeholder. Read at mount. */
  embedPreview?: boolean
  /** What an embed preview shows. Keep it stable (module-level or `useCallback`). */
  renderEmbed?: (target: string, alias: string | undefined) => ReactNode
  slashCommands?: SlashCommand[]
  /** Languages for fenced code, loaded when a block first uses one; read once, at mount. */
  codeLanguages?: CodeLanguages
  /** Nonce for the style element CodeMirror injects, for pages with a strict Content Security Policy. */
  cspNonce?: string
  toolbar?: boolean
  labels?: Partial<MarkdownEditorLabels>
  className?: string
  /** Gets a `MarkdownEditorHandle` once the editor has mounted, for a host's menus and an outline. */
  ref?: Ref<MarkdownEditorHandle | null>
}

// React Compiler treats every prop read beside `props.ref` as a ref, and can't memoize from a rest object, so the
// body takes the ref as `handle`.
function MarkdownEditor({ ref, ...props }: MarkdownEditorProps) {
  return <MarkdownEditorBody {...props} handle={ref} />
}

function MarkdownEditorBody(props: Omit<MarkdownEditorProps, "ref"> & { handle: MarkdownEditorProps["ref"] }) {
  const { label, readOnly = false, placeholder, resolveWikilink, cspNonce, toolbar = true, className } = props
  const { frontmatter = "editable" } = props
  const { embedPreview = false, renderEmbed } = props
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
      frontmatter,
      preview: { resolve: resolveWikilink, taskLabel: labels.task, portals, embeds: embedPreview },
    }),
    [label, hintId, readOnly, placeholder, cspNonce, frontmatter, resolveWikilink, labels.task, portals, embedPreview],
  )
  const { hostRef, view, adapter, sync } = useMarkdownEditorView(props, settings)
  const [menuController] = useState(createTriggerMenuController)
  const suggests = props.suggestWikilinks !== undefined && !readOnly
  const menus = useMemo<HandleMenus>(
    () => ({
      openWikilinkSuggestions: () => {
        if (!view || !suggests || view.state.readOnly) return false
        view.focus()
        const closed = openProvisionally(view, () => menuController.open({ trigger: "[[" }))
        void closed.then(() => settleProvisional(view, "[[", WIKILINK_QUERY))
        return true
      },
    }),
    [view, suggests, menuController],
  )
  useEditorHandle(props.handle, view, menus)

  const handle = useMemo<MarkdownEditorActions | undefined>(() => {
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
        `${fieldSurfaceClassName} flex min-h-0 flex-col overflow-hidden rounded-choice text-body pointer-coarse:text-entry has-[.cm-focused]:ring-2 has-[.cm-focused]:ring-ring data-readonly:bg-transparent data-readonly:shadow-none`,
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
      <MarkdownEditorPortals
        store={portals}
        labels={labels}
        options={{ resolveWikilink, renderEmbed, taskLabel: labels.task }}
      />
      {!readOnly && (
        <MarkdownEditorMenus
          adapter={adapter}
          controller={menuController}
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
export type {
  FrontmatterEditing,
  InitialCaret,
  InsertTextOptions,
  MarkdownBlockKind,
  MarkdownConflict,
  MarkdownEditorCommand,
  MarkdownEditorHandle,
  MarkdownEditorLabels,
  MarkdownEditorProps,
  MarkdownSelection,
  SlashCommand,
  SuggestWikilinks,
}
