"use client"

import { MenuTrigger } from "@ui-sdk/react/menu"
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  EllipsisIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  StrikethroughIcon,
  TextQuoteIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemIndicator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import type { MarkdownFormat } from "@/components/ui/markdown-editor-commands"
import type { MarkdownEditorLabels } from "@/components/ui/markdown-editor-labels"

type ToolbarFormat = Exclude<MarkdownFormat, "heading">

const ITEMS: { format: ToolbarFormat; glyph: ReactNode; group: number }[] = [
  { group: 0, format: "bold", glyph: <BoldIcon /> },
  { group: 0, format: "italic", glyph: <ItalicIcon /> },
  { group: 0, format: "strikethrough", glyph: <StrikethroughIcon /> },
  { group: 0, format: "code", glyph: <CodeIcon /> },
  { group: 0, format: "link", glyph: <LinkIcon /> },
  { group: 1, format: "quote", glyph: <TextQuoteIcon /> },
  { group: 1, format: "bulletList", glyph: <ListIcon /> },
  { group: 1, format: "orderedList", glyph: <ListOrderedIcon /> },
  { group: 1, format: "taskList", glyph: <ListTodoIcon /> },
]

const LEVELS = [0, 1, 2, 3, 4, 5, 6] as const
const levelLabel = (labels: MarkdownEditorLabels, level: number) =>
  level === 0 ? labels.paragraph : labels[`heading${level}` as `heading${1 | 2 | 3 | 4 | 5 | 6}`]

const buttonClassName =
  "touch-target inline-flex size-control-sm shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:opacity-50 data-open:bg-accent data-open:text-accent-foreground [&_svg]:size-4"

/** How many items fit beside the heading menu, leaving room for the "more" button when some don't. */
function fitCount(toolbar: HTMLElement) {
  const style = getComputedStyle(toolbar)
  const gap = Number.parseFloat(style.columnGap) || 0
  const available =
    toolbar.clientWidth - Number.parseFloat(style.paddingInlineStart) - Number.parseFloat(style.paddingInlineEnd)
  const button = toolbar.querySelector("[data-slot=toolbar-button]")
  if (!available || !button) return ITEMS.length
  const item = button.getBoundingClientRect().width + gap
  const separator = (toolbar.querySelector("[data-slot=toolbar-separator]")?.getBoundingClientRect().width ?? 1) + gap
  let used = item + separator
  const widths = ITEMS.map(
    (entry, index) => item + (index > 0 && entry.group !== ITEMS[index - 1]!.group ? separator : 0),
  )
  if (used + widths.reduce((sum, width) => sum + width, 0) <= available) return ITEMS.length
  let count = 0
  for (const width of widths) {
    if (used + width + item > available) break
    used += width
    count++
  }
  return count
}

const keepSelection = (event: { preventDefault: () => void }) => event.preventDefault()

type MarkdownEditorToolbarProps = {
  labels: MarkdownEditorLabels
  onFormat: (format: ToolbarFormat) => void
  onHeading: (level: number) => void
  headingLevel: () => number
  restoreFocus: () => HTMLElement | null
}

function MarkdownEditorToolbar({
  labels,
  onFormat,
  onHeading,
  headingLevel,
  restoreFocus,
}: MarkdownEditorToolbarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(ITEMS.length)
  const [level, setLevel] = useState(0)

  useLayoutEffect(() => {
    const toolbar = ref.current
    if (!toolbar || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => setVisible(fitCount(toolbar)))
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])

  const shown = ITEMS.slice(0, visible)
  const overflow = ITEMS.slice(visible)

  return (
    <Toolbar
      ref={ref}
      aria-label={labels.toolbar}
      className="flex min-w-0 flex-nowrap items-center gap-inline overflow-hidden border-b px-inset-item py-inline"
    >
      <DropdownMenu
        onOpenChange={(open) => open && setLevel(headingLevel())}
        onValueChange={(value) => onHeading(Number(value))}
      >
        <ToolbarButton
          render={<MenuTrigger />}
          aria-label={labels.blockType}
          onMouseDown={keepSelection}
          className={`${buttonClassName} w-auto gap-inline px-inline`}
        >
          <HeadingIcon />
          <ChevronDownIcon />
        </ToolbarButton>
        <DropdownMenuContent finalFocus={restoreFocus}>
          <DropdownMenuRadioGroup value={String(level)} aria-label={labels.blockType}>
            {LEVELS.map((value) => (
              <DropdownMenuRadioItem key={value} value={String(value)}>
                <DropdownMenuItemIndicator />
                {levelLabel(labels, value)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarSeparator className="h-5 w-px shrink-0 self-center bg-border" />
      {shown.map(({ format, glyph, group }, index) => [
        index > 0 && group !== shown[index - 1]!.group && (
          <ToolbarSeparator key={`separator-${format}`} className="h-5 w-px shrink-0 self-center bg-border" />
        ),
        <ToolbarButton
          key={format}
          aria-label={labels[format]}
          // Keeps focus and the selection in the editor; the toolbar still takes focus from the keyboard.
          onMouseDown={keepSelection}
          onClick={() => onFormat(format)}
          className={buttonClassName}
        >
          {glyph}
        </ToolbarButton>,
      ])}
      {overflow.length > 0 && (
        <DropdownMenu onAction={(value) => onFormat(value as ToolbarFormat)}>
          <ToolbarButton
            render={<MenuTrigger />}
            aria-label={labels.more}
            onMouseDown={keepSelection}
            className={`${buttonClassName} ms-auto`}
          >
            <EllipsisIcon />
          </ToolbarButton>
          <DropdownMenuContent align="end" finalFocus={restoreFocus}>
            {overflow.map(({ format, glyph }) => (
              <DropdownMenuItem key={format} value={format}>
                <DropdownMenuItemIcon>{glyph}</DropdownMenuItemIcon>
                {labels[format]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Toolbar>
  )
}

export { MarkdownEditorToolbar }
export type { ToolbarFormat }
