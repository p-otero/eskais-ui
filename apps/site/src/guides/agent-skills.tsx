import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { A, Article, Code, DocTable, DocTitle, H2, H3, P, Pre, Ul } from "../docs/prose"
import { releaseTag, skillsCliVersion } from "../registry"

const skillsCli = `npx skills@${skillsCliVersion}`

const installAll = `${skillsCli} add p-otero/eskais-ui@${releaseTag} --full-depth --skill eskais-ui --skill eskais-perf --skill eskais-mockup -a universal -y`

const installShadcn =
  "npx shadcn@latest add @eskais/eskais-ui-skill @eskais/eskais-perf-skill @eskais/eskais-mockup-skill"

const layout = `.agents/skills/
  eskais-ui/
    SKILL.md                         # which component to reach for, install, agents, style
    references/
      forms.md                       # Form, FormDialog, StepDialog, floating labels
      lists-and-navigation.md        # fast links, shortcuts, long lists, ⌘K search
      styling.md                     # spacing, tone, elevation, motion, type, icons
      toasts-and-testing.md          # toasts and Testing Library helpers
      agent-task-board.md            # AgentTaskBoard
  eskais-perf/
    SKILL.md
  eskais-mockup/
    SKILL.md
  ui-sdk/                            # from node_modules/@ui-sdk/core/skills
    SKILL.md
    references/…`

const uiSdk = `${skillsCli} add ./node_modules/@ui-sdk/core/skills/ui-sdk -a universal -y`

const claudeLink = `mkdir -p .claude/skills
ln -s ../../.agents/skills/eskais-ui .claude/skills/eskais-ui
ln -s ../../.agents/skills/eskais-perf .claude/skills/eskais-perf
ln -s ../../.agents/skills/eskais-mockup .claude/skills/eskais-mockup
ln -s ../../.agents/skills/ui-sdk .claude/skills/ui-sdk`

const claudeJunction = `New-Item -ItemType Directory -Force .claude\\skills
foreach ($skill in "eskais-ui", "eskais-perf", "eskais-mockup", "ui-sdk") {
  New-Item -ItemType Junction -Path ".claude\\skills\\$skill" -Target ".agents\\skills\\$skill"
}`

const agentsMd = `## UI work

Before building or changing a screen, read .agents/skills/eskais-ui/SKILL.md and
.agents/skills/ui-sdk/SKILL.md, and .agents/skills/eskais-perf/SKILL.md for long lists,
effects and motion. For a mockup, follow .agents/skills/eskais-mockup/SKILL.md.`

export default function AgentSkills() {
  return (
    <Article>
      <DocTitle
        eyebrow="Get started"
        title="Agent skills"
        description="Three skills teach a coding agent to build with Eskais UI. Vercel's skills CLI writes them into .agents/skills in your project, from the same release as your components."
      />

      <H2 id="install">Install</H2>
      <P>
        Install them with Vercel's <A href="https://github.com/vercel-labs/skills">skills CLI</A>, pinned to the release
        your <Code>components.json</Code> names (see <A to="/docs/installation">Installation</A>). The command is the
        same in bash and PowerShell; with pnpm or Bun, run it with <Code>pnpm dlx</Code> or <Code>bunx</Code>:
      </P>
      <Pre code={installAll} language="bash" />
      <P>
        <Code>-a universal</Code> writes them to <Code>.agents/skills</Code>, which most agents read;{" "}
        <A href="#agents">add your agent</A> when it looks elsewhere. <Code>--full-depth</Code> finds{" "}
        <Code>eskais-mockup</Code>, which lives beside the mockup CLI in the repository, and <Code>-y</Code> asks
        nothing. The CLI records each skill's source and release in <Code>skills-lock.json</Code>. Commit both, so every
        agent and teammate reads the same version, and run the command again with a newer tag to update them. The CLI
        sends anonymous usage data unless <Code>DISABLE_TELEMETRY=1</Code> is set.
      </P>
      <H3 id="shadcn">With shadcn</H3>
      <P>
        The skills are also registry items. Each is a <Code>registry:file</Code> item whose files target{" "}
        <Code>~/.agents/skills/&lt;skill&gt;/</Code>, where <Code>~</Code> is your project's root, so shadcn writes them
        byte for byte from the ref in your <Code>components.json</Code>. Run it again with <Code>--overwrite</Code> to
        update them. shadcn writes only to <Code>.agents/skills</Code>: link them yourself for an agent that looks
        elsewhere (<A href="#claude-code">Claude Code</A>).
      </P>
      <Pre code={installShadcn} language="bash" />

      <H2 id="skills">The skills</H2>
      <DocTable
        label="Eskais agent skills"
        head={["Skill", "What it's for", "Select with", "Lands in"]}
        rows={[
          [
            <Code key="s">eskais-ui</Code>,
            "Building screens with the components: which one to reach for, install and aliases, forms, lists and navigation, styling tokens, toasts and testing, the AgentTaskBoard, and how agents operate the UI. The SKILL.md is the map; the references load only when a task needs them.",
            <Code key="i">--skill eskais-ui</Code>,
            <Code key="l">.agents/skills/eskais-ui/</Code>,
          ],
          [
            <Code key="s">eskais-perf</Code>,
            "Keeping screens fast: virtualized rows instead of thousands of mapped ones, effects in hooks, code React Compiler can compile, transform and opacity motion, fast links for navigation only, blur off large animated surfaces, and measuring with the React Profiler and the Performance panel.",
            <Code key="i">--skill eskais-perf</Code>,
            <Code key="l">.agents/skills/eskais-perf/SKILL.md</Code>,
          ],
          [
            <Code key="s">eskais-mockup</Code>,
            <>
              Building a throwaway, offline HTML mockup of a screen from your own components with the{" "}
              <A to="/docs/mockups">mockup CLI</A>, in five levels, and validating it. The CLI needs Bun 1.4 or newer.
            </>,
            <Code key="i">--skill eskais-mockup</Code>,
            <Code key="l">.agents/skills/eskais-mockup/SKILL.md</Code>,
          ],
        ]}
      />
      <Pre code={layout} language="plaintext" title="After the install" />

      <H3 id="ui-sdk">The ui-sdk skill</H3>
      <P>
        <Code>eskais-ui</Code> builds on UI SDK's own skill, which explains parts, controllers, agents and the agent
        test. It ships inside <Code>@ui-sdk/core</Code>, which the components install, so add it from there and it
        matches the UI SDK version you run:
      </P>
      <Pre code={uiSdk} language="bash" />

      <H2 id="agents">Point your agent at .agents/skills</H2>
      <P>
        A skill is a folder with a <Code>SKILL.md</Code>: a name and a description the agent reads up front, and
        instructions it loads when a task matches. Where each agent looks, from its own documentation:
      </P>
      <DocTable
        label="Where coding agents read skills"
        head={["Agent", "Reads skills from", "What to do"]}
        rows={[
          [
            "Codex",
            <>
              <Code key="a">.agents/skills</Code> in every folder from where it starts up to the repository root, and{" "}
              <Code key="b">~/.agents/skills</Code>; it follows symlinks
            </>,
            "Nothing: the installed skills load as they are.",
          ],
          [
            "Cursor",
            <>
              <Code key="a">.agents/skills</Code> and <Code key="b">.cursor/skills</Code> in the project (and nested
              folders), the same under <Code key="c">~</Code>, and <Code key="d">.claude/skills</Code> and{" "}
              <Code key="e">.codex/skills</Code> for compatibility
            </>,
            "Nothing: the installed skills load as they are.",
          ],
          [
            "Claude Code",
            <>
              <Code key="a">.claude/skills/&lt;name&gt;/SKILL.md</Code> in the project (and nested folders) and{" "}
              <Code key="b">~/.claude/skills</Code>; not <Code key="c">.agents/skills</Code>. A skill folder may be a
              symlink
            </>,
            "Add -a claude-code to the install, below.",
          ],
          [
            "Other agents",
            "Check the agent's documentation",
            "If it doesn't read .agents/skills, link the folders where it looks, or name the files in AGENTS.md, below.",
          ],
        ]}
      />
      <P>
        Sources: <A href="https://learn.chatgpt.com/docs/build-skills">Codex skills</A>,{" "}
        <A href="https://cursor.com/docs/skills">Cursor skills</A>,{" "}
        <A href="https://code.claude.com/docs/en/skills">Claude Code skills</A>.
      </P>

      <H3 id="claude-code">Claude Code</H3>
      <P>
        Add <Code>-a claude-code</Code> to both skills commands: the CLI keeps the one copy in{" "}
        <Code>.agents/skills</Code> and links each skill into <Code>.claude/skills</Code>. On Windows the link is a
        junction, which stores an absolute path, so keep <Code>.claude/skills</Code> out of the repository there and run
        the install on each machine. <Code>-a</Code> takes any agent the CLI knows, such as <Code>cursor</Code> or{" "}
        <Code>codex</Code>, and repeats.
      </P>
      <P>If you installed with shadcn, link the folders yourself. On macOS and Linux:</P>
      <Pre code={claudeLink} language="bash" />
      <P>
        On Windows, Git Bash's <Code>ln -s</Code> copies the folder instead of linking it unless symlinks are enabled.
        Make junctions from PowerShell instead; they need no administrator rights but store an absolute path, so make
        them on each machine and keep <Code>.claude/skills</Code> out of the repository:
      </P>
      <Pre code={claudeJunction} language="plaintext" title="PowerShell" />

      <H3 id="agents-md">Any agent that reads AGENTS.md</H3>
      <P>
        An agent that doesn't discover skills still follows its instructions file. Name the skills there, so it opens
        them before UI work:
      </P>
      <Pre code={agentsMd} language="md" title="AGENTS.md" />

      <H2 id="keep">Keep them current</H2>
      <Ul>
        <li>
          The skills describe the components at the registry ref in your <Code>components.json</Code>. Update them
          together: when you move <Code>components.json</Code> to a new release, rerun the install with that tag (or{" "}
          <Code>--overwrite</Code> the shadcn items), and add the ui-sdk skill again after you update UI SDK.
        </li>
        <li>
          Your own conventions belong in your <Code>AGENTS.md</Code>, not in the installed skill: an update replaces the
          skill's files.
        </li>
      </Ul>
      <Alert tone="info">
        <AlertTitle>Mockups need the CLI</AlertTitle>
        <AlertDescription>
          <Code>eskais-mockup</Code> teaches the loop; the CLI it runs is its own item, run with Bun 1.4 or newer:{" "}
          <Code>npx shadcn@latest add @eskais/eskais-mockup-cli</Code> puts it in{" "}
          <Code>.agents/tools/eskais-mockup</Code>. See <A to="/docs/mockups#install">Mockups</A>.
        </AlertDescription>
      </Alert>
    </Article>
  )
}
