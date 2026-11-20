import { useCallback, useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { MarkdownEditor, markdownEditorLabelsEs } from "@/components/ui/markdown-editor"
import { markdownCodeLanguages } from "@/components/ui/markdown-editor-languages"
import { MarkdownView } from "@/components/ui/markdown-view"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

import { Section } from "../section"

const notes: Record<string, string> = {
  "release-plan": "Release plan",
  "design-review": "Design review",
  "api-keys": "Rotating API keys",
  "on-call": "On-call handbook",
}

const initial = `# Release notes

Draft for the **beta** cut. See [[release-plan]] and [[design-review|the review]]; [[missing-page]] doesn't exist yet.

## Checklist

- [x] Freeze the schema
- [ ] Rotate the keys, per [[api-keys]]
- [ ] Write the _changelog_ with ~~two~~ three sections

Setext heading
--------------

* A star bullet
* With \`inline code\` and an escaped \\*star\\*

> A quote renders a bar; its marks never show.

| Area | Owner | Status |
| :--- | :---: | ---: |
| Editor | Ines | ready |
| View | Kofi | review |

\`\`\`ts
const answer: number = 42 // highlighted lazily
\`\`\`

<div>Raw HTML shows as text.</div>
`

const resolveWikilink = (slug: string) => ({ exists: slug in notes, label: notes[slug] })
const wikilinkHref = (slug: string) => `#${slug}`

async function suggestWikilinks(query: string, { signal }: { signal: AbortSignal }) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 120)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
  const needle = query.toLowerCase()
  return Object.entries(notes)
    .filter(([slug, label]) => slug.includes(needle) || label.toLowerCase().includes(needle))
    .map(([slug, label]) => ({ slug, label }))
}

const narrowNote = "## Narrow\n\nThe toolbar keeps one row: what doesn't fit moves into **More**.\n"

function MarkdownSection() {
  const [markdown, setMarkdown] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [opened, setOpened] = useState<string>()
  const [language, setLanguage] = useState("en")
  const onOpenWikilink = useCallback((slug: string) => setOpened(slug), [])
  const labels = language === "es" ? markdownEditorLabelsEs : undefined
  return (
    <Section
      title="Markdown editor"
      description="CodeMirror 6 with a live preview: the document is the Markdown text. Marks show only while the caret is inside their span; headings, bullets and quotes never show theirs. Type / for blocks or [[ for a note; Ctrl or Cmd+click opens a wikilink."
    >
      <div className="flex w-full flex-col gap-group">
        <Field>
          <FieldLabel>Labels</FieldLabel>
          <SegmentedControl value={language} onValueChange={(next) => next && setLanguage(next)}>
            <SegmentedControlIndicator />
            <SegmentedControlItem value="en">English</SegmentedControlItem>
            <SegmentedControlItem value="es">Español</SegmentedControlItem>
          </SegmentedControl>
        </Field>
        <div className="grid w-full gap-section lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-items">
            <MarkdownEditor
              label="Release notes"
              value={markdown}
              onChange={setMarkdown}
              onDirtyChange={setDirty}
              resolveWikilink={resolveWikilink}
              suggestWikilinks={suggestWikilinks}
              onOpenWikilink={onOpenWikilink}
              codeLanguages={markdownCodeLanguages}
              labels={labels}
              placeholder="Write something…"
              className="h-136"
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {dirty ? "Unsent edits" : "In sync"}
              {opened ? ` · Opened ${opened}` : ""}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-items">
            <div className="flex h-136 flex-col overflow-hidden rounded-surface border">
              <ScrollArea className="min-h-0 flex-1">
                <ScrollAreaViewport>
                  <div className="p-inset-surface">
                    <MarkdownView
                      aria-label="Preview"
                      markdown={markdown}
                      resolveWikilink={resolveWikilink}
                      wikilinkHref={wikilinkHref}
                    />
                  </div>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar />
              </ScrollArea>
            </div>
          </div>
        </div>
        <MarkdownEditor label="Narrow note" defaultValue={narrowNote} labels={labels} className="h-48 w-72" />
      </div>
    </Section>
  )
}

export { MarkdownSection }
