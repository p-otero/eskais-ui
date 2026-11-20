import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { A, Article, Code, DocTitle, H2, H3, Ol, P, Pre, Ul } from "../docs/prose"
import { registryUrl, releaseTag, skillsCliVersion } from "../registry"

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

const subpathImports = `{
  "imports": {
    "#components/*": "./src/components/*",
    "#ui/*": "./src/components/ui/*",
    "#lib/*": "./src/lib/*",
    "#hooks/*": "./src/hooks/*"
  }
}`

const flatImports = `{
  "imports": {
    "#components/*": "./src/components/*",
    "#ui/*": "./src/components/*",
    "#lib/*": "./src/lib/*",
    "#hooks/*": "./src/hooks/*"
  }
}`

const stylesheet = `@layer ui-sdk;
@import "tailwindcss";
/* shadcn adds the theme's tokens, base rules and @custom-variant dark below. */`

const serveRegistry = `npx serve public/r -l 4173
# or, with Node alone:
node -e "require('http').createServer((q, s) => require('fs').createReadStream('public/r' + new URL(q.url, 'http://x').pathname).on('error', () => s.writeHead(404).end()).pipe(s)).listen(4173)"`

const localComponentsJson = `{
  "registries": {
    "@eskais": "http://localhost:4173/{name}.json"
  }
}`

export default function Installation() {
  return (
    <Article>
      <DocTitle
        eyebrow="Get started"
        title="Installation"
        description="Eskais UI is a shadcn registry: components arrive in your project as source you own, with their UI SDK, Tailwind and token dependencies."
      />

      <H2 id="requirements">Requirements</H2>
      <Ul>
        <li>React 19 and React DOM 19 or newer.</li>
        <li>Tailwind CSS v4.</li>
        <li>
          A <Code>components.json</Code> from <Code>npx shadcn@latest init -b base -p nova</Code> (the flags skip its
          questions). Registry code runs in the browser and in any Node project, with npm, pnpm or Bun: it imports
          nothing from Bun or Node.
        </li>
      </Ul>

      <H2 id="registry">1. Add the registry</H2>
      <P>
        Add <Code>@eskais</Code> to <Code>registries</Code> once. The URL pins the latest release through{" "}
        <Code>refs/tags/</Code>, so a branch with the same name can never stand in for the tag; change the tag to
        upgrade, or use <Code>main</Code> for unreleased changes.
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

      <H3 id="subpath-imports">Subpath imports instead of paths</H3>
      <P>
        Subpath imports in <Code>package.json</Code> work instead of <Code>paths</Code>, with no bundler alias: Node,
        TypeScript and Vite all read them. Set the aliases to <Code>#components</Code>, <Code>#ui</Code>,{" "}
        <Code>#lib/utils</Code>, <Code>#lib</Code> and <Code>#hooks</Code>.
      </P>
      <Pre code={subpathImports} language="json" title="package.json" />
      <P>
        shadcn then writes imports with their extension (<Code>#ui/button.tsx</Code>, <Code>#lib/utils.ts</Code>),
        because Node resolves subpath imports to exact files, so add <Code>"allowImportingTsExtensions": true</Code> to{" "}
        <Code>compilerOptions</Code> (it needs <Code>noEmit</Code>, as in Vite's template) and write your own imports
        the same way: <Code>import {"{ Button }"} from "#ui/button.tsx"</Code>.
      </P>
      <P>
        Keep the extension out of the mapping. <Code>ui</Code> holds <Code>.ts</Code> files next to the{" "}
        <Code>.tsx</Code> ones (<Code>form-context.ts</Code>, every <Code>*-primitive.ts</Code>), so a mapping that
        appends one, like <Code>"#ui/components/*": "./src/components/ui/*.tsx"</Code>, can't reach them: shadcn writes{" "}
        <Code>#ui/components/form-context</Code> with no extension, and it resolves to a <Code>.tsx</Code> file that
        doesn't exist.
      </P>

      <H3 id="flat-layout">A flat layout</H3>
      <P>
        A <Code>ui/</Code> folder isn't required. To keep every component in <Code>src/components</Code>, point both
        aliases at that folder; the aliases stay the same.
      </P>
      <Pre code={flatImports} language="json" title="package.json" />
      <P>
        Between components, shadcn writes imports through the first alias that matches, <Code>components</Code>:{" "}
        <Code>form-actions.tsx</Code> imports <Code>#components/form-context.ts</Code>. Both aliases resolve to the same
        file, so your own code can import either way.
      </P>

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

      <H3 id="running-shadcn">Running shadcn</H3>
      <Ul>
        <li>
          <strong>Runner.</strong> Every command here uses <Code>npx shadcn@latest</Code>. With pnpm, run{" "}
          <Code>pnpm dlx shadcn@latest</Code>; with Bun, <Code>bunx shadcn@latest</Code>.
        </li>
        <li>
          <strong>Package manager.</strong> shadcn installs dependencies with the manager it finds from your lockfile,
          or from <Code>packageManager</Code> in <Code>package.json</Code>. In a pnpm project without a lockfile yet,
          set <Code>"packageManager": "pnpm@&lt;version&gt;"</Code>, or shadcn falls back to npm.
        </li>
        <li>
          <strong>Windows paths with a dotted folder.</strong> shadcn 4.23.0 on Windows drops everything after a folder
          whose name starts with a dot, so a project under <Code>{"C:\\Users\\me\\.config\\app"}</Code> gets its files
          written to <Code>{"C:\\Users\\me\\"}</Code>. Run shadcn from a path without dotted folders, or map the project
          to a drive letter first: <Code>{"subst X: C:\\Users\\me\\.config\\app"}</Code>, then run it from{" "}
          <Code>{"X:\\"}</Code> (<Code>subst X: /d</Code> removes the mapping).
        </li>
      </Ul>

      <H3 id="ui-sdk-beta">While UI SDK is in beta</H3>
      <Ul>
        <li>
          With npm, <Code>shadcn add</Code> writes a caret range for <Code>@ui-sdk/*</Code>. Change it to the exact
          version the registry pins, since later betas can break. pnpm and Bun keep the exact version.
        </li>
        <li>
          pnpm 11+ refuses packages younger than <Code>minimumReleaseAge</Code>, and so does Bun when{" "}
          <Code>bunfig.toml</Code> sets one. Every other dependency the registry pins is at least 7 days old, but UI
          SDK's first release is from 2026-11-12: until its pinned beta is old enough, add <Code>@ui-sdk/core</Code> and{" "}
          <Code>@ui-sdk/react</Code> to <Code>minimumReleaseAgeExclude</Code> in <Code>pnpm-workspace.yaml</Code> or to{" "}
          <Code>minimumReleaseAgeExcludes</Code> under <Code>[install]</Code> in <Code>bunfig.toml</Code>.
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
        <Code>no-raw-colors</Code>, <Code>no-arbitrary-values</Code>…), plus <Code>eskais/icon-button-needs-label</Code>
        , which flags an icon-only <Code>Button</Code> or <Code>Toggle</Code> without <Code>size="icon"</Code> and an{" "}
        <Code>aria-label</Code>, and <Code>eskais/scroll-area</Code> as a warning, which flags a bare{" "}
        <Code>overflow-auto</Code>, <Code>overflow-y-auto</Code> or <Code>-scroll</Code> class so scrolling content goes
        in a <Code>ScrollArea</Code> (both come as <Code>eskais-oxlint-plugin.js</Code> beside the config). Extend it
        from your <Code>.oxlintrc.json</Code>.
      </P>

      <H2 id="testing">Optional: test helpers</H2>
      <P>
        <Code>npx shadcn@latest add @eskais/test-utils</Code> adds Testing Library queries that skip UI SDK's live
        regions: <Code>getToast</Code>, <Code>queryToasts</Code>, <Code>queryAlerts</Code>, <Code>ignoreAnnouncer</Code>{" "}
        and <Code>resetAnnouncer</Code> for your test setup.
      </P>

      <H2 id="unreleased">Test unreleased items</H2>
      <P>
        To try a branch before it is released, serve its built registry and point <Code>@eskais</Code> at it, so every
        item and the <Code>@eskais/*</Code> items it depends on come from the branch. In a checkout of the branch, build
        the registry (<Code>public/r</Code>) and serve that folder over HTTP:
      </P>
      <Pre code={serveRegistry} language="bash" />
      <Pre code={localComponentsJson} language="json" title="components.json" />
      <P>
        Then add as usual: <Code>npx shadcn@latest add @eskais/command</Code>. Switch the URL back to the release when
        you're done.
      </P>
      <Ul>
        <li>
          One item can also come from a file, by a relative path:{" "}
          <Code>npx shadcn@latest add ../eskais-ui/public/r/command.json</Code>. Its <Code>@eskais/*</Code> dependencies
          still come from the <Code>@eskais</Code> URL in <Code>components.json</Code>, so with the release URL there
          they pull the released versions back over the branch's. Serve the folder to test a set of items together.
        </li>
        <li>
          On Windows, shadcn 4.23 can't read an absolute path: <Code>C:/…/command.json</Code> fails with "unknown
          scheme" and <Code>file:///C:/…/command.json</Code> with "not implemented". Use a relative path or HTTP.
        </li>
      </Ul>

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
        Install the skills with Vercel's skills CLI: they teach your agent the conventions on this site, from spacing
        roles to the agent test every interface gets, and land in <Code>.agents/skills</Code>. See{" "}
        <A to="/docs/agent-skills">Agent skills</A> for what each one covers and how to point Claude Code, Codex or
        Cursor at them.
      </P>
      <Pre
        code={`npx skills@${skillsCliVersion} add p-otero/eskais-ui@${releaseTag} --full-depth --skill eskais-ui --skill eskais-perf --skill eskais-mockup -a universal -y`}
        language="bash"
      />
      <P>
        To show a screen before building it, sketch it with <A to="/docs/mockups">Mockups</A>: one offline HTML file
        from your own components, checked by a CLI.
      </P>
    </Article>
  )
}
