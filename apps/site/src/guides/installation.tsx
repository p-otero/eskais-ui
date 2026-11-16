import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { A, Article, Code, DocTitle, H2, H3, Ol, P, Pre, Ul } from "../docs/prose"
import { registryUrl } from "../registry"

const componentsJson = `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "tsx": true,
  "tailwind": { "css": "src/index.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {
    "@eskais": "${registryUrl}"
  }
}`

const tsconfig = `{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}`

const stylesheet = `@layer ui-sdk;
@import "tailwindcss";
/* shadcn adds the theme's tokens, base rules and @custom-variant dark below. */`

export default function Installation() {
  return (
    <Article>
      <DocTitle
        eyebrow="Getting started"
        title="Installation"
        description="Eskais UI is a shadcn registry: components arrive in your project as source you own, with their UI SDK, Tailwind and token dependencies."
      />

      <H2 id="requirements">Requirements</H2>
      <Ul>
        <li>React 19 and React DOM 19 or newer.</li>
        <li>Tailwind CSS v4.</li>
        <li>
          A <Code>components.json</Code> from <Code>npx shadcn@latest init</Code>. Registry code runs in the browser and
          in any Node, npm or pnpm project: it imports nothing from Bun or Node.
        </li>
      </Ul>

      <H2 id="registry">1. Add the registry</H2>
      <P>
        Add <Code>@eskais</Code> to <Code>registries</Code> once. Replace <Code>main</Code> with a tag such as{" "}
        <Code>v0.1.0</Code> for repeatable installs.
      </P>
      <Pre code={componentsJson} language="json" title="components.json" />

      <H2 id="aliases">2. Make the aliases resolve</H2>
      <P>
        shadcn writes <Code>registry:ui</Code> files to <Code>aliases.ui</Code> and <Code>registry:lib</Code> files to{" "}
        <Code>aliases.lib</Code>, and rewrites the registry's <Code>@/components/ui</Code>, <Code>@/lib</Code> and{" "}
        <Code>@/lib/utils</Code> imports to yours, so any prefix works (<Code>~/components/ui</Code>, <Code>#ui</Code>
        …). Set all four: <Code>components</Code>, <Code>ui</Code>, <Code>utils</Code> and <Code>lib</Code>.
      </P>
      <Alert tone="warning">
        <AlertTitle>Put the paths in the root tsconfig.json</AlertTitle>
        <AlertDescription>
          shadcn reads only the root tsconfig.json: it ignores tsconfig.app.json and references, and writes into a
          literal @/ folder when an alias doesn't resolve. Vite's template keeps its paths in tsconfig.app.json, so copy
          them up.
        </AlertDescription>
      </Alert>
      <Pre code={tsconfig} language="json" title="tsconfig.json" />

      <H2 id="stylesheet">3. Declare the UI SDK layer</H2>
      <P>
        Put <Code>@layer ui-sdk;</Code> first in your global stylesheet, above <Code>@import "tailwindcss"</Code>, so
        your utilities win over UI SDK's behaviour CSS.
      </P>
      <Pre code={stylesheet} language="css" title="src/index.css" />

      <H2 id="add">4. Add components</H2>
      <Pre code="npx shadcn@latest add @eskais/theme @eskais/font-geist @eskais/button" language="bash" />
      <P>Dependencies come along: a component brings the parts it's built from, the theme and utils.</P>
      <Ul>
        <li>
          <Code>theme</Code> brings <Code>utils</Code>, whose <Code>cn</Code> knows the theme's utilities. Merge classes
          with it: a plain tailwind-merge drops <Code>text-meta</Code> from{" "}
          <Code>cn("text-meta", "text-muted-foreground")</Code>. If <Code>shadcn init</Code> already wrote{" "}
          <Code>lib/utils.ts</Code>, add with <Code>--overwrite</Code>.
        </li>
        <li>
          <Code>font-geist</Code> bundles Geist and Geist Mono from npm (no font CDN). Without it the theme falls back
          to the system font. <Code>font-inter</Code> is the alternative.
        </li>
      </Ul>

      <H2 id="appearance">5. Connect the appearance</H2>
      <P>
        Dark mode, density and palettes are attributes on <Code>&lt;html&gt;</Code>. Create the appearance once, apply
        it before the first render, and keep it in sync with <Code>Appearance</Code>. See{" "}
        <A to="/docs/theming">Theming</A>.
      </P>
      <Pre
        title="src/main.tsx"
        code={`import { Appearance, createAppearance } from "@/components/ui/appearance"

const appearance = createAppearance({ colorScheme: "system" })
appearance.apply()

createRoot(root).render(
  <Appearance appearance={appearance}>
    <App />
  </Appearance>,
)`}
      />

      <H2 id="lint">Optional: lint rules</H2>
      <P>
        <Code>npx shadcn@latest add @eskais/lint-rules</Code> adds an oxlint config with the <Code>react</Code> and{" "}
        <Code>ui-tailwind</Code> presets of <Code>@p-otero/oxlint-rules</Code> (hook and React Compiler checks, spacing
        role tokens) and the <Code>@shadcn/lint</Code> design-system rules (<Code>no-restyle</Code>,{" "}
        <Code>no-raw-colors</Code>, <Code>no-arbitrary-values</Code>…). Extend it from your <Code>.oxlintrc.json</Code>.
      </P>

      <H2 id="testing">Optional: test helpers</H2>
      <P>
        <Code>npx shadcn@latest add @eskais/test-utils</Code> adds Testing Library queries that skip UI SDK's live
        regions: <Code>getToast</Code>, <Code>queryToasts</Code>, <Code>queryAlerts</Code>, <Code>ignoreAnnouncer</Code>{" "}
        and <Code>resetAnnouncer</Code> for your test setup.
      </P>

      <H2 id="next">Next steps</H2>
      <Ol>
        <li>
          <A to="/docs/theming">Pick your colours and density</A>.
        </li>
        <li>
          <A to="/docs/agents">Create the agent bridge</A> so agents can operate your UI with approval.
        </li>
        <li>
          <A to="/docs/components">Browse the components</A>.
        </li>
      </Ol>
      <H3 id="ai">Using an AI coding agent?</H3>
      <P>
        Install the <Code>eskais-ui</Code> and <Code>ui-sdk</Code> skills: they teach your agent the conventions on this
        site, from spacing roles to the agent test every interface gets.
      </P>
    </Article>
  )
}
