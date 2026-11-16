import { MarkdownView } from "@/components/ui/markdown-view"

const markdown = `## Release notes

Draft for the **beta** cut, with [the review](#review).

- [x] Freeze the schema
- [ ] Rotate the keys
- [ ] Write the _changelog_

| Area | Owner | Status |
| :--- | :---: | ---: |
| Editor | Ines | ready |
| View | Kofi | review |

> Quotes, tables and tasks render without HTML: raw <b>tags</b> show as text.
`

export default function MarkdownViewDemo() {
  return <MarkdownView markdown={markdown} className="w-full max-w-xl" />
}
