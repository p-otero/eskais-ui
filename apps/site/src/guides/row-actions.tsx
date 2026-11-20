import { lazy, Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const Environments = lazy(() => import("./row-actions/environments"))

const usage = `<MasterDetail
  label="Environments"
  followFocus
  renderList={(state) => (
    <List
      aria-label="Worktrees"
      rowActions={(id) => {
        const env = byId.get(id)
        return [
          { id: "open", label: "Open URL", icon: ExternalLinkIcon, href: env.url, newTab: true },
          { id: "copy", label: "Copy URL", icon: CopyIcon, onAction: () => copy(env.url) },
          env.running
            ? { id: "stop", label: "Stop", icon: SquareIcon, tone: "destructive",
                confirm: \`Stops \${env.name}\`, onAction: () => stop(env.id) }
            : { id: "start", label: "Start", icon: PlayIcon, onAction: () => start(env.id) },
        ]
      }}
    >
      {envs.map((env) => (
        <ListItem key={env.id} {...state.itemProps(env.id)} title={env.name} subtitle={env.url} />
      ))}
    </List>
  )}
  renderDetail={(id) => ({ title: byId.get(id).name, content: <EnvironmentDetail id={id} /> })}
/>`

const agentSteps = `await agent.act({ steps: [{ ref: "Copy URL", action: "run", args: ["row-actions"] }] })
// Stop carries data-agent-confirm: allow asks the person first.
await agent.act({ steps: [{ ref: "Stop", action: "run", args: ["main"] }] })`

export default function RowActions() {
  return (
    <Article>
      <DocTitle
        eyebrow="Guides"
        title="Row actions"
        description="Buttons on a list row, like Open, Copy and Start, that keyboards and agents reach without selecting the row or changing a MasterDetail's detail."
      />

      <Suspense fallback={<Skeleton className="h-112 w-full" />}>
        <Environments />
      </Suspense>

      <H2 id="pattern">A grid, not a listbox</H2>
      <P>
        A listbox option can&apos;t hold buttons: screen readers flatten it to its text, and its keys belong to the
        list. So <Code>List rowActions</Code> turns the list into an APG layout grid. Each row is a primary cell, the
        row&apos;s own link or button that selects or opens it, and one cell per action. The grid is still one tab stop,
        and a row&apos;s actions are a key away instead of a Tab each.
      </P>
      <DocTable
        label="Keys in a list with row actions"
        head={["Key", "What it does"]}
        rows={[
          ["Up, Down, j, k", "The row above or below, in the same column (its last cell when it has fewer)."],
          ["Left, Right", "The previous or next cell of the row, following the text direction."],
          ["Home, End", "The row's primary cell or its last action; with Ctrl or ⌘, the grid's first or last cell."],
          ["Page Up, Page Down", "About a screen of rows."],
          ["Enter, Space", "Press the focused cell: the row's link or button, or the action."],
          ["Tab", "Leave the grid; Tab back returns to the cell focused last."],
        ]}
      />
      <Ul>
        <li>
          Selectable (<Code>value</Code>, <Code>onValueChange</Code>), rows carry <Code>aria-selected</Code>, and an
          arrow onto a primary cell or a press on it selects, as in a listbox. Moving through action cells, or pressing
          one, never does.
        </li>
        <li>
          In a <A to="/docs/components/master-detail">MasterDetail</A>, the row&apos;s primary cell opens it, and
          <Code>followFocus</Code> follows the primary cells only: an action on another row leaves the detail where it
          is.
        </li>
        <li>
          On a mouse or trackpad the actions show while the row is hovered, holds focus or is selected;{" "}
          <Code>rowActionsVisibility=&quot;always&quot;</Code> keeps them shown. A touch screen always shows them, and
          each button&apos;s hit area reaches 44px.
        </li>
        <li>
          An action with <Code>disabled</Code> stays focusable and says why in its tooltip (a string); an action with{" "}
          <Code>href</Code> is a link, for navigation only.
        </li>
      </Ul>
      <Pre code={usage} title="environments.tsx" />

      <H2 id="api">ListRowAction</H2>
      <DocTable
        label="ListRowAction"
        head={["Field", "What it does"]}
        rows={[
          [
            <Code key="f">id</Code>,
            "The same on every row that offers the action; agents run it by its label and the row's id.",
          ],
          [<Code key="f">label</Code>, "Names the button, its tooltip with an icon, and the action for agents."],
          [<Code key="f">icon</Code>, "A lucide icon: the button shows only the icon."],
          [
            <Code key="f">onAction(details)</Code>,
            "Runs on a press and on an agent's run; details.cancel() refuses it.",
          ],
          [<Code key="f">href, newTab</Code>, "Makes it a link, like opening the row's URL."],
          [<Code key="f">disabled</Code>, "true, or why it can't run on this row now."],
          [
            <Code key="f">confirm</Code>,
            "The data-agent-confirm sentence: an agent asks a person first. Use it for anything destructive.",
          ],
          [<Code key="f">tone</Code>, '"destructive" colours the button.'],
        ]}
      />
      <P>
        <Code>rowActionLabels</Code> renames the buttons (<Code>button(action, title)</Code>) and the actions agents see
        (<Code>group(action)</Code>), for instance when two lists on a page share an action.
      </P>

      <H2 id="agents">Agents</H2>
      <P>
        Agents see one component per action, named by its label, whose <Code>run(id)</Code> takes the row&apos;s id and
        lists the rows that offer it, rendered or not. The rows&apos; own buttons stay out of the snapshot, so a long
        list doesn&apos;t fill it. A row that doesn&apos;t offer the action, a disabled one, or a run the app cancels
        fails the step with why, and a <Code>confirm</Code> action waits for the person through your <Code>allow</Code>.
      </P>
      <Pre code={agentSteps} title="agent.ts" />
    </Article>
  )
}
