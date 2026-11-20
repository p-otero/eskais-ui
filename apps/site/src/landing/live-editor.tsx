import { useState } from "react"

import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { MarkdownView } from "@/components/ui/markdown-view"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

const initial = `## Launch checklist

The **beta** ships when these are done:

- [x] Freeze the schema
- [ ] Rotate the deploy keys
- [ ] Write the _changelog_

Type / for blocks.
`

export default function LiveEditor() {
  const [markdown, setMarkdown] = useState(initial)
  const [view, setView] = useState<"edit" | "rendered">("edit")
  return (
    <div className="flex min-w-0 flex-col gap-items">
      <SegmentedControl
        aria-label="Editor view"
        value={view}
        onValueChange={(next) => next && setView(next)}
        className="w-fit"
      >
        <SegmentedControlIndicator />
        <SegmentedControlItem value="edit">Edit</SegmentedControlItem>
        <SegmentedControlItem value="rendered">MarkdownView</SegmentedControlItem>
      </SegmentedControl>
      {view === "edit" ? (
        <MarkdownEditor label="Launch checklist" value={markdown} onChange={setMarkdown} className="h-64" />
      ) : (
        <div className="flex h-64 flex-col overflow-hidden rounded-surface border">
          <ScrollArea className="min-h-0 flex-1">
            <ScrollAreaViewport>
              <div className="p-inset-surface">
                <MarkdownView markdown={markdown} aria-label="Rendered checklist" />
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar />
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
