import { useState } from "react"

import { MarkdownEditor } from "@/components/ui/markdown-editor"

const initial = `# Release notes

Draft for the **beta** cut. Marks show only while the caret is inside them.

- [x] Freeze the schema
- [ ] Rotate the keys
- [ ] Write the _changelog_

Type / for blocks.
`

export default function MarkdownEditorDemo() {
  const [markdown, setMarkdown] = useState(initial)
  return (
    <div className="flex w-full flex-col gap-items">
      <MarkdownEditor label="Release notes" value={markdown} onChange={setMarkdown} className="h-80" />
      <p className="text-caption text-muted-foreground">{markdown.length} characters of plain Markdown</p>
    </div>
  )
}
