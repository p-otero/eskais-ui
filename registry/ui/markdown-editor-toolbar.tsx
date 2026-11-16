"use client"

import { MenuTrigger } from "@ui-sdk/react/menu"
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

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

const icon = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

type ToolbarFormat = Exclude<MarkdownFormat, "heading">

const ITEMS: { format: ToolbarFormat; glyph: ReactNode; group: number }[] = [
  { group: 0, format: "bold", glyph: icon(<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zm0 7h7a3.5 3.5 0 0 1 0 7H7z" />) },
  { group: 0, format: "italic", glyph: icon(<path d="M14 5h-4m4 14h-4m3-14-2 14" />) },
  {
    group: 0,
    format: "strikethrough",
    glyph: icon(
      <path d="M5 12h14M16 6.5A4 3 0 0 0 12 5c-2.5 0-4 1.3-4 3 0 3.5 8 2.5 8 7 0 1.7-1.8 3-4 3a4.5 3 0 0 1-4.5-2" />,
    ),
  },
  { group: 0, format: "code", glyph: icon(<path d="m9 8-4 4 4 4m6-8 4 4-4 4" />) },
  {
    group: 0,
    format: "link",
    glyph: icon(
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1m2 3.7a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
    ),
  },
  { group: 1, format: "quote", glyph: icon(<path d="M6 6v12M10 8h8m-8 4h8m-8 4h5" />) },
  {
    group: 1,
    format: "bulletList",
    glyph: icon(<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />),
  },
  {
    group: 1,
    format: "orderedList",
    glyph: icon(<path d="M10 6h10M10 12h10M10 18h10M4 5l1-1v5M4 15h2l-2 3h2" />),
  },
  { group: 1, format: "taskList", glyph: icon(<path d="M4 5h5v5H4zm1.5 9.5 1.5 1.5 3-3M13 7.5h7M13 15h7" />) },
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
          {icon(<path d="M6 5v14M18 5v14M6 12h12" />)}
          {icon(<path d="m8 10 4 4 4-4" />)}
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
            {icon(<path d="M5 12h.01M12 12h.01M19 12h.01" />)}
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
