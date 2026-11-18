"use client"

import { Button } from "@/components/ui/button"
import { useDocumentWorkspace, type DocumentHeading } from "@/components/ui/document-workspace-context"
import { cn } from "@/lib/utils"

type DocumentOutlineProps = {
  /** The headings to list; the workspace's `headings` by default. */
  headings?: readonly DocumentHeading[]
  /** The navigation landmark's name. */
  label?: string
  /** Deeper headings are left out. */
  maxLevel?: number
  className?: string
}

/**
 * The document's headings as buttons. In edit mode one puts the caret at its heading's text, scrolled to the top,
 * and focuses the editor; in read mode it scrolls to the heading and moves focus to it.
 */
function DocumentOutline({ headings: own, label = "Outline", maxLevel = 6, className }: DocumentOutlineProps) {
  const workspace = useDocumentWorkspace()
  const headings = own ?? workspace.headings
  const shallowest = Math.min(...headings.map((heading) => heading.level))

  const go = (index: number) => {
    const heading = headings[index]
    if (!heading) return
    const editor = workspace.editorRef?.current
    if (workspace.mode === "edit" && editor) {
      editor.setSelection(heading.textFrom)
      editor.scrollToLine(heading.line)
      editor.focus()
      return
    }
    workspace.revealHeading(index)
  }

  return (
    <nav aria-label={label} data-slot="document-outline" className={cn("flex min-w-0 flex-col", className)}>
      <ol className="flex flex-col">
        {headings.map(
          (heading, index) =>
            heading.level <= maxLevel && (
              <li key={`${String(heading.line)}:${heading.text}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  data-level={heading.level}
                  onClick={() => go(index)}
                  className="w-full min-w-0 justify-start gap-0 px-inset-item pointer-coarse:h-(--control-height-touch) font-normal text-muted-foreground hover:text-foreground data-[level='1']:font-medium data-[level='1']:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    data-depth={Math.min(heading.level - shallowest, 5)}
                    className="shrink-0 data-[depth='1']:w-3 data-[depth='2']:w-6 data-[depth='3']:w-9 data-[depth='4']:w-12 data-[depth='5']:w-15"
                  />
                  <span className="truncate">{heading.text}</span>
                </Button>
              </li>
            ),
        )}
      </ol>
    </nav>
  )
}

export { DocumentOutline }
export type { DocumentOutlineProps }
