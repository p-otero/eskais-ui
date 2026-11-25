import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"

import { ActivityLog, undoToast } from "@/components/ui/activity-log"
import { actorOf, createActivityLog, type ActivityLog as ActivityLogStore } from "@/components/ui/activity-log-store"
import { activityLog as activityLogPrimitive } from "@/components/ui/activity-log-primitive"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToastStack, createToaster } from "@/components/ui/toast"
import { getToast } from "@/lib/test-utils"

import { axeViolations } from "./axe"

const agent = createAgent()
const approving = createAgent({ allow: () => true })

let logs: ActivityLogStore[] = []
let clock = Date.parse("2026-11-18T10:00:00Z")

function startLog(bridge = agent) {
  const log = createActivityLog(bridge, { now: () => clock })
  logs.push(log)
  return log
}

afterEach(() => {
  for (const log of logs) log.destroy()
  logs = []
})

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

const flush = () =>
  act(async () => {
    await tick()
    while (logs.some((log) => log.getSnapshot().busy)) await tick()
    await tick()
  })

async function toggle(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(switchNamed(name))
}

function Settings() {
  return (
    <>
      <Switch aria-label="Notifications" />
      <Switch aria-label="Dark mode" />
      <Switch aria-label="Beta features" />
    </>
  )
}

const switchNamed = (name: string) => screen.getByRole("switch", { name })
const checked = (name: string) => switchNamed(name).getAttribute("aria-checked") === "true"
const descriptions = (log: ActivityLogStore) => log.getSnapshot().entries.map((entry) => entry.description)

test("actorOf maps UI SDK's sources to who made the change", () => {
  expect(["agent", "keyboard", "mouse", "touch", "pen", "virtual", "programmatic"].map(actorOf)).toEqual([
    "agent",
    "person",
    "person",
    "person",
    "person",
    "person",
    "app",
  ])
})

// Workaround: jsdom's events aren't trusted, so UI SDK reports Testing Library's clicks as "programmatic", the app's
// actor; tooling/activity-check.mjs checks a person's clicks in Chrome.
test("records an agent's changes and the page's own with who, what and when", async () => {
  const user = userEvent.setup()
  const log = startLog()
  render(<Settings />)
  await toggle(user, "Notifications")
  clock += 60_000
  const result = await agent.act({ steps: [{ ref: "Dark mode", action: "setChecked", args: [true] }] })
  await flush()
  expect(result.ok, result.error?.message).toBe(true)

  const { entries, position } = log.getSnapshot()
  expect(position).toBe(2)
  expect(entries.map(({ actor, label, value, at }) => ({ actor, label, value, at }))).toEqual([
    { actor: "app", label: "Notifications", value: true, at: Date.parse("2026-11-18T10:00:00Z") },
    { actor: "agent", label: "Dark mode", value: true, at: Date.parse("2026-11-18T10:01:00Z") },
  ])
  expect(descriptions(log)).toEqual(["You set Notifications to true", "Agent set Dark mode to true"])
})

test("undo, redo and seek restore the controls; a new change drops what was ahead", async () => {
  const user = userEvent.setup()
  const log = startLog()
  render(<Settings />)
  await toggle(user, "Notifications")
  await toggle(user, "Dark mode")
  await toggle(user, "Beta features")

  await act(() => log.undo())
  expect(checked("Beta features")).toBe(false)
  expect(log.canRedo()).toBe(true)
  await act(() => log.seek(0))
  expect([checked("Notifications"), checked("Dark mode")]).toEqual([false, false])
  await act(() => log.redo())
  expect(checked("Notifications")).toBe(true)
  expect(log.getSnapshot().position).toBe(1)

  await toggle(user, "Beta features")
  expect(descriptions(log)).toEqual(["You set Notifications to true", "You set Beta features to true"])
  expect(log.canRedo()).toBe(false)
})

test("records of the app's own interleave with control changes, in order", async () => {
  const user = userEvent.setup()
  const log = startLog()
  const calls: string[] = []
  render(<Settings />)
  await toggle(user, "Notifications")
  log.record({
    label: "Fix login",
    description: "Agent moved Fix login to Done",
    actor: "agent",
    undo: () => calls.push(`undo at ${String(log.getSnapshot().entries.length)}`),
    redo: () => calls.push("redo"),
  })
  await toggle(user, "Dark mode")

  await act(() => log.seek(0))
  await flush()
  expect([checked("Notifications"), checked("Dark mode")]).toEqual([false, false])
  await act(() => log.seek(3))
  await flush()
  expect(calls).toEqual(["undo at 3", "redo"])
  expect([checked("Notifications"), checked("Dark mode")]).toEqual([true, true])
})

test("undoActor takes back only the agent's changes, records included", async () => {
  const user = userEvent.setup()
  const log = startLog()
  const undo = vi.fn()
  render(<Settings />)
  await agent.act({ steps: [{ ref: "Dark mode", action: "setChecked", args: [true] }] })
  await flush()
  await toggle(user, "Notifications")
  log.record({ label: "Task", description: "Agent archived Task", actor: "agent", undo, redo: vi.fn() })

  await act(() => log.undoActor("agent"))
  expect([checked("Dark mode"), checked("Notifications")]).toEqual([false, true])
  expect(undo).toHaveBeenCalledOnce()
  expect(log.getSnapshot().entries.map((entry) => entry.reverted)).toEqual([true, false, true])
})

test("the list shows entries newest first; pressing one seeks to just after it", async () => {
  const user = userEvent.setup()
  const log = startLog()
  const { container } = render(
    <>
      <Settings />
      <ActivityLog log={log} label="Activity" now={clock} />
    </>,
  )
  const list = screen.getByRole("group", { name: "Activity" })
  expect(within(list).getByText("No changes yet")).toBeTruthy()
  expect(within(list).getByRole("button", { name: "Undo" }).hasAttribute("disabled")).toBe(true)

  await toggle(user, "Notifications")
  await toggle(user, "Dark mode")
  const rows = within(list).getAllByRole("listitem")
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining("You set Dark mode to true"),
    expect.stringContaining("You set Notifications to true"),
    "Start",
  ])
  const newest = within(rows[0] as HTMLElement).getByRole("button")
  expect(newest.getAttribute("aria-current")).toBe("step")

  await user.click(within(rows[1] as HTMLElement).getByRole("button"))
  await flush()
  expect(checked("Dark mode")).toBe(false)
  expect(newest.getAttribute("data-state")).toBe("undone")
  expect(newest.textContent).toContain("Undone")
  expect(
    within(rows[1] as HTMLElement)
      .getByRole("button")
      .getAttribute("aria-current"),
  ).toBe("step")
  expect(await axeViolations(container)).toEqual([])
})

test("Cmd/Ctrl+Z undoes and Shift+Cmd/Ctrl+Z redoes, but not while typing in a field", async () => {
  const user = userEvent.setup()
  const log = startLog()
  render(
    <>
      <Settings />
      <Input aria-label="Notes" />
      <ActivityLog log={log} label="Activity" />
    </>,
  )
  await toggle(user, "Notifications")
  await user.keyboard("{Control>}z{/Control}")
  await flush()
  expect(checked("Notifications")).toBe(false)
  await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}")
  await flush()
  expect(checked("Notifications")).toBe(true)

  await user.click(screen.getByRole("textbox", { name: "Notes" }))
  await user.keyboard("{Control>}z{/Control}")
  await flush()
  expect(checked("Notifications")).toBe(true)
})

test("an agent reads the entries and calls undo, redo and seek; a long seek back needs a person", async () => {
  const user = userEvent.setup()
  const log = startLog()
  render(
    <>
      <Settings />
      <ActivityLog log={log} label="Activity" confirmAbove={1} />
    </>,
  )
  await toggle(user, "Notifications")
  await toggle(user, "Dark mode")
  await toggle(user, "Beta features")
  await flush()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const activity = components.find((entry) => entry.component === "activity-log")
  expect(activity?.label).toBe("Activity")
  expect(activity?.actions).toEqual(["undo", "redo", "seek"])
  expect(activity?.value).toBe(3)

  const read = await agent.query({ within: "Activity" })
  expect(JSON.stringify(read)).toContain("You set Dark mode to true")

  const undone = await agent.act({ steps: [{ ref: "Activity", action: "undo" }] })

  await flush()
  expect(undone.ok, undone.error?.message).toBe(true)
  expect(checked("Beta features")).toBe(false)
  const redone = await agent.act({ steps: [{ ref: "Activity", action: "redo" }] })
  await flush()
  expect(redone.ok, redone.error?.message).toBe(true)
  expect(checked("Beta features")).toBe(true)

  const near = await agent.act({ steps: [{ ref: "Activity", action: "seek", args: [2] }] })
  await flush()
  expect(near.ok, near.error?.message).toBe(true)
  await act(() => log.seek(3))
  const far = await agent.act({ steps: [{ ref: "Activity", action: "seek", args: [0] }] })
  await flush()
  expect(far.ok).toBe(false)
  expect(far.error?.message).toContain("Undo the last 3 changes")
  expect(checked("Notifications")).toBe(true)

  const byLabel = await approving.act({
    steps: [{ ref: "Activity", action: "seek", args: ["You set Notifications to true"] }],
  })
  await flush()
  expect(byLabel.ok, byLabel.error?.message).toBe(true)
  expect([checked("Notifications"), checked("Dark mode")]).toEqual([true, false])
})

test("undoToast offers Undo, which steps the log back", async () => {
  const user = userEvent.setup()
  const log = startLog()
  const toaster = createToaster()
  function Archive() {
    const [, setCount] = useState(0)
    return (
      <>
        <Switch
          aria-label="Archived"
          onCheckedChange={() => {
            setCount((count) => count + 1)
            undoToast("Archived", { log, toaster })
          }}
        />
        <ToastStack toaster={toaster} />
      </>
    )
  }
  render(<Archive />)
  await toggle(user, "Archived")
  await flush()
  await user.click(within(getToast("Archived")).getByRole("button", { name: "Undo" }))
  await flush()
  expect(checked("Archived")).toBe(false)
  toaster.dismiss()
})

test("primitive: renders on the server from a log's snapshot", () => {
  const log = {
    getSnapshot: () => ({ entries: [], position: 0, busy: false }),
    subscribe: () => () => {},
    undo: async () => [],
    redo: async () => [],
    seek: async () => [],
  }
  checkServer(activityLogPrimitive, { log }, `<root aria-label="Activity"><entry value="0">Start</entry></root>`)
})
