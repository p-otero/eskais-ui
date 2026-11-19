import { A, Article, Code, DocTitle, H2, Ol, P, Pre, Ul } from "../docs/prose"

const bridge = `import { createConfirm } from "@ui-sdk/react/alert-dialog"
import { createAgent } from "@ui-sdk/react/agent"

// The approval is its own top-layer dialog: a modal the agent opened makes the rest of the page inert.
export const approval = createConfirm<{ sentence: string }>()

export const agent = createAgent({
  allow: (step, { signal }) => {
    if (!step.confirm) return true
    signal.addEventListener("abort", () => approval.controller.close(), { once: true })
    return approval({ sentence: step.confirm })
  },
})`

const act = `const result = await agent.act({
  steps: [
    { ref: "Project name", action: "setValue", args: ["Atlas"] },
    { ref: "Delete project", action: "press", args: ["Delete forever"] },
  ],
})`

const confirm = `<ConfirmDialog
  trigger="Delete project"
  title="Delete Apollo?"
  confirmLabel="Delete forever"
  tone="destructive"
  agentConfirm="Deletes the Apollo project and its files"
  onConfirm={deleteProject}
/>`

export default function Agents() {
  return (
    <Article>
      <DocTitle
        eyebrow="Get started"
        title="Agents"
        description="Every operable control is a UI SDK part, so an agent reads the page by accessible names and acts through the same parts a person uses."
      />

      <H2 id="how">How it works</H2>
      <Ol>
        <li>
          UI SDK registers each component as it mounts: its kind, label, state and the actions it accepts (
          <Code>setValue</Code>, <Code>press</Code>, <Code>select</Code>…).
        </li>
        <li>
          <Code>agent.snapshot()</Code> lists them; <Code>agent.act()</Code> runs steps that name a component in the
          words of the task.
        </li>
        <li>
          A control marked <Code>data-agent-confirm</Code> asks your <Code>allow</Code> callback first, with the
          sentence the mark carries.
        </li>
      </Ol>
      <P>
        Every component page on this site has a <strong>Read the preview as an agent</strong> button that runs a real
        snapshot of its example. The landing page lets an agent archive a workspace while you approve.
      </P>

      <H2 id="bridge">Create one bridge</H2>
      <Pre code={bridge} title="agent.ts" language="ts" />
      <P>
        Render the approval as an <Code>AlertDialog</Code> with <Code>approval.controller</Code>. To publish the tools
        to the browser's agent, call <Code>registerTools</Code> from the same entry (WebMCP).
      </P>
      <Pre code={act} language="ts" />

      <H2 id="confirm">Mark what needs a person</H2>
      <Ul>
        <li>
          Destructive actions carry <Code>data-agent-confirm</Code> with a sentence that says what happens.
        </li>
        <li>
          <Code>ConfirmDialog</Code> with <Code>tone="destructive"</Code> requires <Code>agentConfirm</Code>;{" "}
          <Code>FormActions tone="destructive" confirm</Code> does the same for a form.
        </li>
        <li>
          <Code>data-agent-hidden</Code> keeps a region out of snapshots; password, card and one-time-code fields are
          redacted without a mark.
        </li>
      </Ul>
      <Pre code={confirm} />

      <H2 id="custom">Behaviour UI SDK doesn't ship</H2>
      <P>
        Components like <A to="/docs/components/search-field">SearchField</A>,{" "}
        <A to="/docs/components/native-select">NativeSelect</A>, <A to="/docs/components/sidebar">Sidebar</A> and{" "}
        <A to="/docs/components/agent-task-board">AgentTaskBoard</A> are <Code>definePrimitive</Code> primitives with
        explicit <Code>agent.actions</Code>, rendered with <Code>createParts</Code>. A bare <Code>&lt;button&gt;</Code>{" "}
        or <Code>&lt;select&gt;</Code> is invisible to agents.
      </P>

      <H2 id="test">The agent test</H2>
      <P>
        Test every interface the way an agent uses it: take a snapshot, act by label, and check that destructive steps
        wait for a person. The <Code>ui-sdk</Code> skill's <Code>references/agent-ready.md</Code> has the recipe.
      </P>
    </Article>
  )
}
