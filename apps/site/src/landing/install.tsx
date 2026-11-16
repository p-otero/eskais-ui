import { Code, CodeBlock } from "@/components/ui/code-block"
import { SectionHeading } from "@/components/ui/section-heading"
import { Step, Steps } from "@/components/ui/steps"

import { registryUrl } from "../registry"

const componentsJson = `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib"
  },
  "registries": {
    "@eskais": "${registryUrl}"
  }
}`

const stylesheet = `@layer ui-sdk;
@import "tailwindcss";`

const steps = [
  {
    title: "Add the registry",
    body: "One line in components.json. Pin a tag like v0.1.0 instead of main for repeatable installs.",
    code: componentsJson,
    language: "json" as const,
    file: "components.json",
  },
  {
    title: "Declare the UI SDK layer",
    body: "First line of your global stylesheet, so your styles win over UI SDK's behaviour CSS.",
    code: stylesheet,
    language: "css" as const,
    file: "app.css",
  },
  {
    title: "Add components",
    body: "Dependencies come along: the theme, utils and every part a component is built from.",
    code: "npx shadcn@latest add @eskais/theme @eskais/font-geist @eskais/button",
    language: "bash" as const,
    file: "Terminal",
  },
]

function Install() {
  return (
    <section aria-labelledby="install-title" className="flex flex-col gap-section py-section">
      <SectionHeading
        headingId="install-title"
        eyebrow="Install"
        title="Source in your repo, in three steps."
        description={
          <>
            shadcn copies each component into your project, so you own the code. The registry lives at{" "}
            <Code className="text-caption break-all">{registryUrl}</Code>.
          </>
        }
      />
      <Steps aria-label="Install steps">
        {steps.map((step) => (
          <Step key={step.title} title={step.title} description={step.body}>
            <CodeBlock code={step.code} language={step.language} title={step.file} className="flex-1" />
          </Step>
        ))}
      </Steps>
    </section>
  )
}

export { Install }
