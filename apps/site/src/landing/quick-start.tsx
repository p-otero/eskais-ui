import { CodeBlock } from "@/components/ui/code-block"
import { SectionHeading } from "@/components/ui/section-heading"

import { registryUrl, releaseTag, skillsCliVersion, uiSdkVersion } from "../registry"

const setupPrompt = `Set up Eskais UI in this React project (React 19 or newer, Tailwind CSS v4): the components, the agent skills and the mockup CLI. Use the project's package manager, and its runner where you see <x>: npx with npm, pnpm dlx with pnpm, bunx with Bun. Every command below works the same in bash and PowerShell. If a release-age policy (minimumReleaseAge in pnpm, Bun or Renovate) blocks an install, stop and ask me instead of changing it.

1. shadcn reads only the root tsconfig.json, and init fails without an @/ alias there: if the alias lives in tsconfig.app.json, copy its paths up; if there is none, add "paths": { "@/*": ["./src/*"] } to both (no baseUrl: TypeScript 7 rejects it) and the same alias to the bundler (resolve.alias in vite.config). Then, if there is no components.json, create one (it asks nothing):
   <x> shadcn@latest init -b base -p nova
2. Add the registry, pinned to the ${releaseTag} release:
   <x> shadcn@latest registry add "@eskais=${registryUrl}"
3. Install UI SDK at exactly ${uiSdkVersion}, the version the registry pins (npm install -E, pnpm add -E or bun add -E):
   npm install -E @ui-sdk/react@${uiSdkVersion} @ui-sdk/core@${uiSdkVersion}
4. Put @layer ui-sdk; on the first line of the global stylesheet, above @import "tailwindcss". Then add the theme, the Geist font, the lint rules and the mockup CLI (--overwrite replaces the lib/utils.ts that init wrote):
   <x> shadcn@latest add @eskais/theme @eskais/font-geist @eskais/lint-rules @eskais/eskais-mockup-cli --yes --overwrite
   If the project lints with oxlint, extend eskais-ui.oxlintrc.json from its .oxlintrc.json.
5. Add the Eskais skills from the same release to .agents/skills. If you are Claude Code, add -a claude-code to this step and the next: it links them into .claude/skills.
   <x> skills@${skillsCliVersion} add p-otero/eskais-ui@${releaseTag} --full-depth --skill eskais-ui --skill eskais-perf --skill eskais-mockup -a universal -y
6. Add UI SDK's own skill, from the version you installed:
   <x> skills@${skillsCliVersion} add ./node_modules/@ui-sdk/core/skills/ui-sdk -a universal -y
7. Check that the mockup CLI reads the project. It needs Bun 1.4 or newer; ask me before installing Bun.
   bun .agents/tools/eskais-mockup/cli.ts inspect
8. Add a note to AGENTS.md, creating it if needed: before building or changing a screen, use the eskais-ui and ui-sdk skills, eskais-perf for long lists, effects and motion, and eskais-mockup for a mockup; add components with <x> shadcn@latest add @eskais/<name>. With npm, after every add, set @ui-sdk/react and @ui-sdk/core in package.json back to ${uiSdkVersion} exactly: npm writes a caret range, while pnpm and Bun keep the exact version.

When you're done, tell me what you installed, what you skipped and why, and the output of the inspect check.`

const buildPrompt = `Build a team settings page with Eskais UI: a profile form with name, email and avatar, notification switches, and a danger zone that deletes the workspace after a confirm dialog. Mock it up first with the eskais-mockup skill and show me every screen in light and dark, then build it from the components and add the agent test.`

function QuickStart() {
  return (
    <section aria-labelledby="quick-start-title" className="flex flex-col gap-section py-section">
      <SectionHeading
        headingId="quick-start-title"
        eyebrow="Quick start"
        title="Set up everything with one prompt."
        description="Paste this into your agent and it will set up everything for you: the components and theme, the agent skills and the mockup CLI."
      />
      <div className="flex flex-col gap-group">
        <CodeBlock
          code={setupPrompt}
          language="plaintext"
          title="Setup prompt"
          wrap
          maxHeight="24rem"
          labels={{ copy: "Copy setup prompt" }}
        />
        <p className="text-body text-muted-foreground">Then ask your agent to build something:</p>
        <CodeBlock
          code={buildPrompt}
          language="plaintext"
          title="Example prompt"
          wrap
          labels={{ copy: "Copy example prompt" }}
        />
      </div>
    </section>
  )
}

export { buildPrompt, QuickStart, setupPrompt }
