import { CodeBlock } from "@/components/ui/code-block"
import { SectionHeading } from "@/components/ui/section-heading"

import { registryUrl, releaseTag, uiSdkVersion } from "../registry"

const repository = "https://github.com/p-otero/eskais-ui"

const setupPrompt = `Set up Eskais UI in this React project: the components, the agent skills and the mockup CLI. It needs React 19 or newer, Tailwind CSS v4 and a components.json; if there is none, run npx shadcn@latest init first. Install with the project's package manager. If a release-age policy (pnpm's minimumReleaseAge, Renovate) blocks an install, stop and ask me instead of changing it.

1. Add the registry, pinned to the ${releaseTag} release:
   npx shadcn@latest registry add "@eskais=${registryUrl}"
   shadcn reads only the root tsconfig.json: if the @/ alias lives in tsconfig.app.json, copy its paths up.
2. Put @layer ui-sdk; on the first line of the global stylesheet, above @import "tailwindcss".
3. Install @ui-sdk/react and @ui-sdk/core at exactly ${uiSdkVersion}, the version the registry pins (npm install -E, pnpm add -E or bun add -E).
4. Add the theme, the Geist font and the lint rules. --overwrite replaces the lib/utils.ts that shadcn init wrote:
   npx shadcn@latest add @eskais/theme @eskais/font-geist @eskais/lint-rules --overwrite -y
   If the project lints with oxlint, extend eskais-ui.oxlintrc.json from its .oxlintrc.json.
5. Add the agent skills to .agents/skills, with UI SDK's own skill beside them:
   npx shadcn@latest add @eskais/eskais-ui-skill @eskais/eskais-perf-skill @eskais/eskais-mockup-skill -y
   cp -r node_modules/@ui-sdk/core/skills/ui-sdk .agents/skills/
   If you read skills from .claude/skills, link each of the four folders there.
6. Set up the mockup CLI. It isn't on npm yet: it runs from a checkout of the repository with Bun 1.4 or newer (ask me before installing Bun). Clone it next to this project and check that it reads the project:
   git clone --depth 1 --branch ${releaseTag} ${repository} ../eskais-ui
   bun ../eskais-ui/packages/mockup/src/cli.ts inspect
7. Add a note to AGENTS.md, creating it if needed: before building or changing a screen, read .agents/skills/eskais-ui/SKILL.md and .agents/skills/ui-sdk/SKILL.md, and .agents/skills/eskais-perf/SKILL.md for long lists, effects and motion; for a mockup, follow .agents/skills/eskais-mockup/SKILL.md. Add components with npx shadcn@latest add @eskais/<name>, then set @ui-sdk/react and @ui-sdk/core back to ${uiSdkVersion} exactly, since shadcn writes a caret range.

When you're done, tell me what you installed and anything you skipped.`

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
