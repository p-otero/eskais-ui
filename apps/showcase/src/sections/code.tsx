import { Code, CodeBlock } from "@/components/ui/code-block"
import { CodeTabs } from "@/components/ui/code-tabs"
import { toast } from "@/components/ui/toast"

import { Section } from "../section"

// Touches every syntax tone, so the contrast check measures each on the code surface and on a highlighted line.
const sample = `import { Card, type CardProps } from "@/components/ui/card"

// Every tone: keyword, string, number, comment, function, type, property, tag, punctuation
export function Stat({ label, value = 42 }: { label: string; value?: number }) {
  const ratio = value / 100
  return <Card title={label} data-ratio={ratio.toFixed(2)} />
}`

const diff = `diff --git a/theme.css b/theme.css
@@ -1,3 +1,3 @@
 :root {
-  --radius: 0.5rem;
+  --radius: 1rem;
 }`

function CodeSection() {
  return (
    <Section
      title="Code"
      description="CodeBlock highlights lazily with Lezer and syntax tokens, numbers and highlights lines, shows diffs, and copies; CodeTabs holds several files."
    >
      <div className="flex w-full min-w-0 flex-col gap-group">
        <CodeBlock
          code={sample}
          language="tsx"
          title="stat.tsx"
          lineNumbers
          highlightLines={[[5, 6]]}
          onCopy={() => toast.success("Copied stat.tsx")}
        />
        <CodeBlock code={diff} language="diff" title="theme.css.diff" />
        <CodeBlock code="npx shadcn@latest add @eskais/code-block # then import it" language="bash" />
        <CodeTabs
          aria-label="Theme files"
          files={[
            { title: "app.css", code: '@layer ui-sdk;\n@import "tailwindcss";\n.a { color: red; }', language: "css" },
            { title: "components.json", code: '{ "style": "new-york", "rsc": false }', language: "json" },
          ]}
        />
        <p className="text-body">
          Inline code reads as <Code>npx shadcn add</Code> inside a sentence.
        </p>
      </div>
    </Section>
  )
}

export { CodeSection }
