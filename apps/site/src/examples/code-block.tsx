import { Code, CodeBlock } from "@/components/ui/code-block"
import { CodeTabs } from "@/components/ui/code-tabs"
import { toast } from "@/components/ui/toast"

const button = `import { Button } from "@/components/ui/button"

export function Save({ onSave }: { onSave: () => Promise<void> }) {
  // A returned Promise keeps the button pending until it settles
  return <Button onClick={onSave}>Save changes</Button>
}`

const diff = `@@ -1,3 +1,3 @@
 :root {
-  --radius: 0.5rem;
+  --radius: 1rem;
 }`

export default function CodeBlockDemo() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-group">
      <CodeBlock
        code={button}
        language="tsx"
        title="save.tsx"
        lineNumbers
        highlightLines={[[4, 5]]}
        onCopy={() => toast.success("Copied save.tsx")}
      />
      <CodeTabs
        aria-label="Setup files"
        files={[
          { title: "app.css", code: '@layer ui-sdk;\n@import "tailwindcss";', language: "css" },
          { title: "theme.diff", code: diff, language: "diff" },
        ]}
      />
      <p className="text-body">
        Inline, <Code>npx shadcn add @eskais/code-block</Code> reads as code inside a sentence.
      </p>
    </div>
  )
}
