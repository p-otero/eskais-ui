import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { markdownCodeLanguages } from "@/components/ui/markdown-editor-languages"

const sample = `Fenced code is highlighted in every language CodeMirror knows:

\`\`\`ts
const answer: number = 42
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"Hello, {name}"
\`\`\`
`

export default function MarkdownEditorLanguagesDemo() {
  return (
    <MarkdownEditor
      label="Snippets"
      defaultValue={sample}
      codeLanguages={markdownCodeLanguages}
      className="h-72 w-full"
    />
  )
}
