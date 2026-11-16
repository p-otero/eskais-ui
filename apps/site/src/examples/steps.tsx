import { CodeBlock } from "@/components/ui/code-block"
import { Step, Steps } from "@/components/ui/steps"

export default function StepsDemo() {
  return (
    <Steps aria-label="Set up the theme">
      <Step title="Add the registry" description="One line in components.json.">
        <CodeBlock code={'"@eskais": "https://…/{name}.json"'} language="json" title="components.json" />
      </Step>
      <Step title="Declare the layer" description="First line of your stylesheet.">
        <CodeBlock code={'@layer ui-sdk;\n@import "tailwindcss";'} language="css" title="app.css" />
      </Step>
      <Step title="Add components" description="Dependencies come along.">
        <CodeBlock code="npx shadcn@latest add @eskais/theme" language="bash" title="Terminal" />
      </Step>
    </Steps>
  )
}
