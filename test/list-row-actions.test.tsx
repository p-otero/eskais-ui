import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { CopyIcon, PlayIcon, SquareIcon } from "lucide-react"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { List, ListGroup, ListItem } from "@/components/ui/list-item"
import type { ListRowAction } from "@/components/ui/list-row-actions"
import { MasterDetail } from "@/components/ui/master-detail"

import { axeViolations } from "./axe"

afterEach(cleanup)

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

type Env = { id: string; name: string; url: string; running: boolean }

const envs: Env[] = [
  { id: "web", name: "Web preview", url: "http://localhost:5173", running: true },
  { id: "api", name: "API staging", url: "http://localhost:8080", running: false },
  { id: "docs", name: "Docs site", url: "http://localhost:4000", running: true },
]

type Log = { action: string; id: string; source?: string }

function actionsFor(env: Env, log: Log[], options: { refuseCopy?: boolean } = {}): ListRowAction[] {
  return [
    {
      id: "copy",
      label: "Copy URL",
      icon: CopyIcon,
      onAction: (details) => {
        if (options.refuseCopy) details.cancel()
        else log.push({ action: "copy", id: env.id, source: details.source })
      },
    },
    env.running
      ? {
          id: "stop",
          label: "Stop",
          icon: SquareIcon,
          tone: "destructive",
          confirm: `Stops ${env.name}`,
          onAction: () => log.push({ action: "stop", id: env.id }),
        }
      : {
          id: "start",
          label: "Start",
          icon: PlayIcon,
          disabled: env.id === "api" ? "No port free" : undefined,
          onAction: () => log.push({ action: "start", id: env.id }),
        },
  ]
}

function Envs({
  log,
  selectable = false,
  onValueChange,
  refuseCopy,
  grouped = false,
}: {
  log: Log[]
  selectable?: boolean
  onValueChange?: (id: string | null) => void
  refuseCopy?: boolean
  grouped?: boolean
}) {
  const [value, setValue] = useState<string | null>("web")
  const byId = new Map(envs.map((env) => [env.id, env]))
  const rows = envs.map((env) => <ListItem key={env.id} id={env.id} title={env.name} subtitle={env.url} />)
  return (
    <List
      aria-label="Environments"
      value={selectable ? value : undefined}
      onValueChange={
        selectable
          ? (id) => {
              setValue(id)
              onValueChange?.(id)
            }
          : undefined
      }
      rowActions={(id) => {
        const env = byId.get(id)
        return env ? actionsFor(env, log, { refuseCopy }) : undefined
      }}
    >
      {grouped ? <ListGroup label="Local">{rows}</ListGroup> : rows}
    </List>
  )
}

const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) })

test("rows with actions form a grid: a row is a primary cell and one cell per action", async () => {
  const { container } = render(<Envs log={[]} />)
  const grid = screen.getByRole("grid", { name: "Environments" })
  expect(grid.getAttribute("data-slot")).toBe("list")
  expect(within(grid).getAllByRole("row")).toHaveLength(3)
  const web = rowOf("Web preview")
  expect(within(web).getAllByRole("gridcell")).toHaveLength(3)
  expect(within(web).getByRole("button", { name: "Copy URL" })).toBeTruthy()
  expect(within(web).getByRole("button", { name: "Stop" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("the grid is one tab stop; Left and Right reach a row's actions, Up and Down keep the column", async () => {
  const user = userEvent.setup()
  render(
    <>
      <button type="button">Before</button>
      <Envs log={[]} />
      <button type="button">After</button>
    </>,
  )
  screen.getByRole("button", { name: "Before" }).focus()
  await user.tab()
  const webPrimary = within(rowOf("Web preview")).getByRole("button", { name: "Web preview" })
  expect(document.activeElement).toBe(webPrimary)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }))

  webPrimary.focus()
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(within(rowOf("Web preview")).getByRole("button", { name: "Copy URL" }))
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(within(rowOf("Web preview")).getByRole("button", { name: "Stop" }))
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(within(rowOf("Web preview")).getByRole("button", { name: "Stop" }))
  await user.keyboard("{ArrowDown}")
  expect(document.activeElement).toBe(within(rowOf("API staging")).getByRole("button", { name: "Start" }))
  await user.keyboard("j")
  expect(document.activeElement).toBe(within(rowOf("Docs site")).getByRole("button", { name: "Stop" }))
  await user.keyboard("{Home}")
  expect(document.activeElement).toBe(within(rowOf("Docs site")).getByRole("button", { name: "Docs site" }))
  await user.keyboard("{Control>}{Home}{/Control}")
  expect(document.activeElement).toBe(webPrimary)
  await user.keyboard("{Control>}{End}{/Control}")
  expect(document.activeElement).toBe(within(rowOf("Docs site")).getByRole("button", { name: "Stop" }))
})

test("Enter on an action runs it without selecting the row; arrows in the primary column select", async () => {
  const user = userEvent.setup()
  const log: Log[] = []
  const onValueChange = vi.fn()
  render(<Envs log={log} selectable onValueChange={onValueChange} />)
  const web = rowOf("Web preview")
  expect(web.getAttribute("aria-selected")).toBe("true")

  within(web).getByRole("button", { name: "Web preview" }).focus()
  await user.keyboard("{ArrowDown}")
  expect(onValueChange).toHaveBeenLastCalledWith("api")
  expect(rowOf("API staging").getAttribute("aria-selected")).toBe("true")

  await user.keyboard("{ArrowRight}{ArrowDown}")
  expect(document.activeElement).toBe(within(rowOf("Docs site")).getByRole("button", { name: "Copy URL" }))
  expect(onValueChange).toHaveBeenCalledTimes(1)
  await user.keyboard("{Enter}")
  await user.keyboard(" ")
  expect(log).toEqual([
    { action: "copy", id: "docs", source: "programmatic" },
    { action: "copy", id: "docs", source: "programmatic" },
  ])
  expect(onValueChange).toHaveBeenCalledTimes(1)
  expect(rowOf("API staging").getAttribute("aria-selected")).toBe("true")
})

test("a press on an action runs it without selecting the row; a press on the row selects it", async () => {
  const user = userEvent.setup()
  const log: Log[] = []
  const onValueChange = vi.fn()
  render(<Envs log={log} selectable onValueChange={onValueChange} />)
  await user.click(within(rowOf("Docs site")).getByRole("button", { name: "Stop" }))
  expect(log).toEqual([{ action: "stop", id: "docs" }])
  expect(onValueChange).not.toHaveBeenCalled()

  await user.click(within(rowOf("Docs site")).getByRole("button", { name: "Docs site" }))
  expect(onValueChange).toHaveBeenLastCalledWith("docs")
  expect(rowOf("Docs site").getAttribute("aria-selected")).toBe("true")
})

test("a disabled action stays focusable, says why, and doesn't run", async () => {
  const user = userEvent.setup()
  const log: Log[] = []
  render(<Envs log={log} />)
  const start = within(rowOf("API staging")).getByRole("button", { name: "Start" })
  expect(start.getAttribute("aria-disabled")).toBe("true")
  await user.click(start)
  expect(log).toEqual([])
})

test("groups are row groups named by their label", async () => {
  const { container } = render(<Envs log={[]} grouped />)
  expect(screen.getByRole("rowgroup", { name: "Local" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("agents run each action by its label with the row's id; destructive ones need a person", async () => {
  const log: Log[] = []
  render(<Envs log={log} />)
  const snapshot = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of snapshot) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = snapshot.map((entry) => entry.label)
  for (const label of ["Copy URL", "Stop", "Start"]) expect(labels).toContain(label)
  expect(labels.filter((label) => label === "Copy URL")).toHaveLength(1)

  const copy = await agent.act({ steps: [{ ref: "Copy URL", action: "run", args: ["api"] }] })
  expect(copy.ok, copy.error?.message).toBe(true)
  expect(log).toEqual([{ action: "copy", id: "api", source: "agent" }])

  const stop = { steps: [{ ref: "Stop", action: "run", args: ["web"] }] }
  approve = false
  expect((await agent.act(stop)).ok).toBe(false)
  expect(log).toHaveLength(1)
  approve = true
  const stopped = await agent.act(stop)
  expect(stopped.ok, stopped.error?.message).toBe(true)
  expect(log.at(-1)).toEqual({ action: "stop", id: "web" })
  approve = false
})

test("an agent's action on a row that can't take it fails with why, and nothing runs", async () => {
  const log: Log[] = []
  render(<Envs log={log} refuseCopy />)
  const disabled = await agent.act({ steps: [{ ref: "Start", action: "run", args: ["api"] }] })
  expect(disabled.ok).toBe(false)
  expect(disabled.error?.message).toContain('run isn\'t available on "API staging": No port free.')

  const missing = await agent.act({ steps: [{ ref: "Start", action: "run", args: ["web"] }] })
  expect(missing.ok).toBe(false)
  expect(missing.error?.message).toContain('No row "web" offers this action')

  const refused = await agent.act({ steps: [{ ref: "Copy URL", action: "run", args: ["docs"] }] })
  expect(refused.ok).toBe(false)
  expect(refused.error?.message).toContain("run was refused by the app.")
  expect(log).toEqual([])
})

test("in a MasterDetail, an action on another row doesn't change the detail", async () => {
  const user = userEvent.setup()
  const log: Log[] = []
  const byId = new Map(envs.map((env) => [env.id, env]))
  render(
    <div style={{ width: 1200, height: 600 }}>
      <MasterDetail
        label="Environments"
        followFocus
        defaultSelectedId="web"
        items={envs.map((env) => ({ id: env.id, label: env.name }))}
        renderList={(state) => (
          <List
            aria-label="Environment list"
            rowActions={(id) => {
              const env = byId.get(id)
              return env ? actionsFor(env, log) : undefined
            }}
          >
            {envs.map((env) => (
              <ListItem key={env.id} {...state.itemProps(env.id)} title={env.name} />
            ))}
          </List>
        )}
        renderDetail={(id) => ({ title: `Detail of ${byId.get(id)?.name ?? id}`, content: <p>{id}</p> })}
      />
    </div>,
  )
  expect(screen.getByRole("heading", { name: "Detail of Web preview" })).toBeTruthy()
  const docsCopy = within(rowOf("Docs site")).getByRole("button", { name: "Copy URL" })
  fireEvent.focus(docsCopy)
  await user.click(docsCopy)
  expect(log).toEqual([{ action: "copy", id: "docs", source: "programmatic" }])
  expect(screen.getByRole("heading", { name: "Detail of Web preview" })).toBeTruthy()
  await user.click(within(rowOf("Docs site")).getByRole("button", { name: "Docs site" }))
  expect(screen.getByRole("heading", { name: "Detail of Docs site" })).toBeTruthy()
})
