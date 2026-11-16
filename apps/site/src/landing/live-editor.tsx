import { useState } from "react"

import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { MarkdownView } from "@/components/ui/markdown-view"
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
        <div className="h-64 overflow-auto rounded-surface border p-inset-surface">
          <MarkdownView markdown={markdown} aria-label="Rendered checklist" />
        </div>
      )}
    </div>
  )
}
