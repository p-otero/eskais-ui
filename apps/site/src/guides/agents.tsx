import { A, Article, Code, DocTable, DocTitle, H2, Ol, P, Pre, Ul } from "../docs/prose"

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

const refuse = `<VoiceInput
  state={state}
  onStart={(details) => {
    // People can dictate; an agent's start fails with "start was refused by the app."
    if (details.source === "agent") return details.cancel()
    startListening()
  }}
/>`

const register = `import { createAgent, registerTools } from "@ui-sdk/react/agent"

export const agent = createAgent({ allow })

// For a real browser agent in production, or only in dev and test builds:
if (import.meta.env.DEV || import.meta.env.MODE === "test") {
  registerTools(agent, { allow: (step) => !step.confirm })
}`

const playwright = `import { chromium, expect, test } from "@playwright/test"

test("an agent can't start dictation the app keeps for people", async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--enable-features=WebMCP"] })
  const page = await browser.newPage()
  const cdp = await page.context().newCDPSession(page)
  const tools = new Map()
  const responses = new Map()
  cdp.on("WebMCP.toolsAdded", ({ tools: added }) => added.forEach((tool) => tools.set(tool.name, tool)))
  cdp.on("WebMCP.toolResponded", ({ invocationId, output }) => responses.get(invocationId)?.(output))
  await cdp.send("WebMCP.enable")
  await page.goto("http://localhost:5173/dictation")
  await expect.poll(() => tools.has("act")).toBe(true)

  const call = async (toolName, input) => {
    const { frameId } = tools.get(toolName)
    const { invocationId } = await cdp.send("WebMCP.invokeTool", { frameId, toolName, input })
    const output = await new Promise((resolve) => responses.set(invocationId, resolve))
    return typeof output === "string" ? JSON.parse(output) : output
  }

  const result = await call("act", { steps: [{ ref: "Voice input", action: "start" }] })
  expect(result.ok).toBe(false)
  expect(result.error.message).toContain("start was refused by the app.")
  await expect(page.getByRole("group", { name: "Voice input" })).toHaveAttribute("data-state", "idle")
  await browser.close()
})`

const standIn = `// Before the page loads, in the test only: what registerTools needs from document.modelContext.
await page.addInitScript(() => {
  if (document.modelContext) return
  const tools = new Map()
  Object.defineProperty(document, "modelContext", {
    value: {
      registerTool: async (tool) => void tools.set(tool.name, tool),
      getTools: async () => [...tools.values()],
      executeTool: async (tool, input) => JSON.stringify(await tools.get(tool.name).execute(input, {})),
    },
  })
})

const result = await page.evaluate(async () => {
  const act = (await document.modelContext.getTools()).find((tool) => tool.name === "act")
  const steps = [{ ref: "Voice input", action: "start" }]
  return JSON.parse(await document.modelContext.executeTool(act, { steps }))
})`

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

      <H2 id="refusals">When an action can't run</H2>
      <P>
        UI SDK's bridge reports <Code>ok: true</Code> for any action that returns, so an Eskais component throws when an
        agent's action doesn't run. <Code>agent.act()</Code> resolves with <Code>ok: false</Code> and an{" "}
        <Code>error.message</Code> that says why, and stops there.
      </P>
      <DocTable
        label="Why an action fails"
        head={["Why", "error.message"]}
        rows={[
          [
            <>
              Your callback called <Code>details.cancel()</Code>
            </>,
            <Code key="refused">start was refused by the app.</Code>,
          ],
          ["The state doesn't offer it", <Code key="state">start isn't available while listening.</Code>],
          [
            "The component wasn't given the callback",
            <Code key="offered">reset isn't offered: there is no onResetRequest.</Code>,
          ],
        ]}
      />
      <Pre code={refuse} />
      <Ul>
        <li>
          A person's press that the app refuses does nothing and throws nothing. Only a call with no press behind it (an
          agent's step, a controller, your code) throws, an <Code>ActionRefusedError</Code> from{" "}
          <Code>@/lib/action-refusal</Code> with <Code>action</Code> and <Code>kind</Code>.
        </li>
        <li>
          Actions that name an end state (<Code>open</Code>, <Code>close</Code>, <Code>setCollapsed</Code>) succeed when
          it's already there; actions that move (<Code>start</Code>, <Code>next</Code>, <Code>undo</Code>) fail when
          there's nowhere to go.
        </li>
        <li>
          UI SDK's own components keep UI SDK's rule: a cancelled <Code>setValue</Code> reports <Code>ok: true</Code>{" "}
          with no change, so read the step's <Code>changes</Code> and the returned <Code>values</Code> there.
        </li>
      </Ul>

      <H2 id="end-to-end">Testing agent actions end to end</H2>
      <P>
        UI SDK's supported way to drive a page's agent from outside is WebMCP: <Code>registerTools</Code> publishes{" "}
        <Code>snapshot</Code>, <Code>query</Code> and <Code>act</Code> through <Code>document.modelContext</Code>, and
        the browser's agent, or your test, calls them. Nothing test-only goes in the app.
      </P>
      <Pre code={register} title="agent.ts" language="ts" />
      <P>
        Chrome 158 and later have <Code>document.modelContext</Code> with <Code>--enable-features=WebMCP</Code>.
        Playwright lists the tools and calls them over the DevTools protocol, as a browser agent does (Playwright's
        protocol types don't list the <Code>WebMCP</Code> domain yet, so a TypeScript test casts the session):
      </P>
      <Pre code={playwright} title="dictation.spec.ts" language="ts" />
      <P>
        On a browser without WebMCP, the test gives <Code>registerTools</Code> something to register into, and calls{" "}
        <Code>executeTool</Code> from inside the page. Check what the step did in the page too, not only{" "}
        <Code>result.ok</Code>.
      </P>
      <Pre code={standIn} language="ts" />

      <H2 id="test">The agent test</H2>
      <P>
        Test every interface the way an agent uses it: take a snapshot, act by label, and check that destructive steps
        wait for a person. The <Code>ui-sdk</Code> skill's <Code>references/agent-ready.md</Code> has the recipe.
      </P>
    </Article>
  )
}
