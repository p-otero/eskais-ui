"use client"

import type { EditorView } from "@codemirror/view"
import {
  TriggerMenu,
  TriggerMenuContent,
  TriggerMenuEmpty,
  TriggerMenuItem,
  TriggerMenuList,
  TriggerMenuStatus,
  type TextEditorAdapter,
  type TriggerDefinition,
  type TriggerMenuController,
  type TriggerMenuData,
  type TriggerMenuDataItem,
} from "@ui-sdk/react/trigger-menu"
import { useMemo, type ReactNode } from "react"

import {
  insertBlock,
  toggleFormat,
  type MarkdownBlockKind,
  type MarkdownFormat,
} from "@/components/ui/markdown-editor-commands"
import { markdownEditorLabelsEn, type MarkdownEditorLabels } from "@/components/ui/markdown-editor-labels"
import { setHeading } from "@/components/ui/markdown-editor-lines"
import { wikilinkText } from "@/components/ui/markdown-syntax"

type SlashCommand = {
  value: string
  label: string
  keywords?: string[]
  hint?: string
  /**
   * Replaces the typed `/query` (from `from` to `to`) with whatever the command inserts. It may call the handle's
   * `openWikilinkSuggestions()`, which opens once the slash menu has closed.
   */
  run: (view: EditorView, range: { from: number; to: number }) => void
}

type WikilinkSuggestion = { slug: string; label?: string }
type SuggestWikilinks = (query: string, context: { signal: AbortSignal }) => Promise<WikilinkSuggestion[]>

/** What a wikilink query may hold, one character at a time. */
const WIKILINK_QUERY = /[^\]|[\r\n]/u

const block =
  (kind: MarkdownBlockKind): SlashCommand["run"] =>
  (view, range) => {
    insertBlock(view, kind, range, "input.complete")
  }

function lineCommand(apply: (view: EditorView) => unknown): SlashCommand["run"] {
  return (view, { from, to }) => {
    view.dispatch({ changes: { from, to }, selection: { anchor: from }, userEvent: "input.complete" })
    apply(view)
  }
}

type SlashLabels = Pick<
  MarkdownEditorLabels,
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "quote"
  | "codeBlock"
  | "table"
  | "divider"
>

const heading = (level: number) => lineCommand((view) => setHeading(view, level))
const lines = (format: MarkdownFormat) => lineCommand((view) => toggleFormat(view, format))

function markdownSlashCommands(labels: Partial<SlashLabels> = {}): SlashCommand[] {
  const text = { ...markdownEditorLabelsEn, ...labels }
  return [
    { value: "paragraph", label: text.paragraph, keywords: ["text"], run: heading(0) },
    { value: "h1", label: text.heading1, keywords: ["title"], hint: "#", run: heading(1) },
    { value: "h2", label: text.heading2, hint: "##", run: heading(2) },
    { value: "h3", label: text.heading3, hint: "###", run: heading(3) },
    { value: "bullet", label: text.bulletList, hint: "-", run: lines("bulletList") },
    { value: "ordered", label: text.orderedList, hint: "1.", run: lines("orderedList") },
    { value: "task", label: text.taskList, hint: "- [ ]", run: lines("taskList") },
    { value: "quote", label: text.quote, hint: ">", run: lines("quote") },
    { value: "code", label: text.codeBlock, hint: "```", run: block("codeBlock") },
    { value: "table", label: text.table, hint: "| |", run: block("table") },
    { value: "divider", label: text.divider, hint: "---", run: block("divider") },
  ]
}

const runNow = (run: () => void) => run()

// Workaround: the visible entries' type also allows groups, separators and plain strings, which these triggers never return.
const isDataItem = (entry: TriggerMenuData<unknown>[number]): entry is TriggerMenuDataItem<unknown> =>
  typeof entry === "object" && "value" in entry

type MarkdownEditorMenusProps = {
  adapter: TextEditorAdapter | undefined
  /** Opens the wikilink suggestions for the editor's handle. */
  controller?: TriggerMenuController
  view: EditorView | undefined
  slashCommands: SlashCommand[]
  suggestWikilinks?: SuggestWikilinks
  onOpenChange: (open: boolean) => void
  /** Runs a slash command's `run`, so the editor knows what it calls from there. */
  runCommand?: (run: () => void) => void
  emptyLabel: ReactNode
}

function MarkdownEditorMenus({
  adapter,
  controller,
  view,
  slashCommands,
  suggestWikilinks,
  onOpenChange,
  runCommand = runNow,
  emptyLabel,
}: MarkdownEditorMenusProps) {
  const triggers = useMemo<TriggerDefinition[]>(() => {
    const list: TriggerDefinition[] = [
      {
        char: "/",
        boundary: "word",
        // Workaround: UI SDK's default trigger pattern ends the match at punctuation such as ? or ), which closed the
        // menu mid-query.
        pattern: /\S/u,
        type: "command",
        items: slashCommands.map(({ value, label, keywords }) => ({ value, label, keywords })),
      },
    ]
    if (suggestWikilinks) {
      list.push({
        char: "[[",
        boundary: "anywhere",
        spaces: true,
        maxLength: 80,
        pattern: WIKILINK_QUERY,
        items: async (query, { signal }) =>
          (await suggestWikilinks(query, { signal })).map((item) => ({
            value: item.slug,
            label: item.label ?? item.slug,
          })),
        insert: (item) => wikilinkText(item.value),
      })
    }
    return list
  }, [slashCommands, suggestWikilinks])

  return (
    <TriggerMenu
      editor={adapter}
      controller={controller}
      triggers={triggers}
      onOpenChange={(open) => onOpenChange(open)}
      onSelect={(value, details) => {
        if (details.trigger !== "/" || !view) return
        const command = slashCommands.find((entry) => entry.value === value)
        if (!command) return
        details.preventDefault()
        runCommand(() => command.run(view, { from: details.match.start, to: details.match.end }))
      }}
    >
      <TriggerMenuContent
        side="bottom"
        align="start"
        sideOffset={4}
        // oxlint-disable-next-line eskais/scroll-area -- the slash and wikilink menus, floating like dropdown-menu's
        className="max-h-(--available-height) w-64 overflow-y-auto surface-floating p-inline"
      >
        <TriggerMenuStatus className="sr-only" />
        <TriggerMenuEmpty className="px-inset-item py-inset-item text-sm text-muted-foreground not-data-empty:hidden">
          {emptyLabel}
        </TriggerMenuEmpty>
        <TriggerMenuList className="flex flex-col aria-busy:opacity-60">
          {(state) =>
            state.items.filter(isDataItem).map((item) => {
              const hint =
                state.trigger === "/"
                  ? slashCommands.find((entry) => entry.value === item.value)?.hint
                  : typeof item.value === "string" && item.value !== item.label
                    ? item.value
                    : undefined
              return (
                <TriggerMenuItem
                  key={String(item.value)}
                  value={item.value}
                  label={item.label}
                  className="flex h-control-sm cursor-default items-center justify-between gap-inline rounded-control px-inset-item text-sm outline-none select-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="truncate">{item.label}</span>
                  {hint && <span className="shrink-0 font-mono text-xs text-muted-foreground">{hint}</span>}
                </TriggerMenuItem>
              )
            })
          }
        </TriggerMenuList>
      </TriggerMenuContent>
    </TriggerMenu>
  )
}

export { MarkdownEditorMenus, markdownSlashCommands, WIKILINK_QUERY }
export type { SlashCommand, SlashLabels, SuggestWikilinks, WikilinkSuggestion }
