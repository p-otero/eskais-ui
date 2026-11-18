import { CodeBlock } from "@/components/ui/code-block"
import { diffText } from "@/lib/diff-lines"
import { formatHunks } from "@/lib/diff-patch"

const before = "alpha\nbeta\ngamma\ndelta\n"
const after = "alpha\nbeta two\ngamma\ndelta\nepsilon\n"

export default function DiffDemo() {
  const diff = diffText(before, after, { context: 1 })
  return (
    <CodeBlock
      code={formatHunks(diff.hunks)}
      language="diff"
      title={`+${String(diff.additions)} −${String(diff.deletions)}`}
      className="w-full"
    />
  )
}
