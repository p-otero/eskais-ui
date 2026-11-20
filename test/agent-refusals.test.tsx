import { mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { activityLog } from "@/components/ui/activity-log-primitive"
import { agentTaskBoard } from "@/components/ui/agent-task-board-primitive"
import { agentTaskMoves } from "@/components/ui/agent-task-moves-primitive"
import { agentTaskProposals } from "@/components/ui/agent-task-proposals-primitive"
import { attachments } from "@/components/ui/attachments-primitive"
import { boardTransfer } from "@/components/ui/board-transfer-primitive"
import { codeBlock } from "@/components/ui/code-block-primitive"
import { commitHistory, type CommitLookup } from "@/components/ui/commit-history-primitive"
import { confirmButton } from "@/components/ui/confirm-button-primitive"
import { conversation } from "@/components/ui/conversation-primitive"
import { dataTable } from "@/components/ui/data-table-primitive"
import { descriptionValue } from "@/components/ui/description-list-primitive"
import { formRoot } from "@/components/ui/form-primitive"
import { gitTree, type GitTreeLookup } from "@/components/ui/git-tree-primitive"
import { inlineEdit } from "@/components/ui/inline-edit-primitive"
import { lightbox } from "@/components/ui/lightbox-primitive"
import { link } from "@/components/ui/link-primitive"
import { list } from "@/components/ui/list-primitive"
import { masterDetail } from "@/components/ui/master-detail-primitive"
import { nativeSelect } from "@/components/ui/native-select-primitive"
import { searchField } from "@/components/ui/search-field-primitive"
import { serverFilters } from "@/components/ui/server-filters-primitive"
import { sidebar } from "@/components/ui/sidebar-primitive"
import { sortable } from "@/components/ui/sortable-primitive"
import { ActionRefusedError } from "@/lib/action-refusal"

import { sampleTasks } from "./fixtures/agent-tasks"

const agent = createAgent()

// What an app does to keep an agent away from a change while a person can still make it.
const refuseAgent = (_value: unknown, details: { source: string; cancel: () => void }) => {
  if (details.source === "agent") details.cancel()
}

const views: { unmount: () => void }[] = []
function mounted<View extends { unmount: () => void }>(view: View) {
  views.push(view)
  return view
}
afterEach(() => {
  for (const view of views.splice(0)) view.unmount()
  vi.unstubAllGlobals()
})

async function failsWith(ref: string, action: string, message: string, args?: unknown[]) {
  const result = await agent.act({ steps: [{ ref, action, ...(args ? { args } : {}) }] })
  expect(result.ok, `${ref} ${action}`).toBe(false)
  expect(result.error?.message).toContain(message)
}

const commits: CommitLookup = {
  find: (ref) =>
    ref === "c1" || ref === "m1"
      ? { id: ref, hash: `${ref}hash`, subject: ref, ...(ref === "m1" ? { merge: true } : {}) }
      : undefined,
  entries: () => [
    { value: "c1", label: "c1" },
    { value: "m1", label: "m1" },
  ],
} as CommitLookup

const tree: GitTreeLookup = {
  kind: (path) => (path === "src" ? "folder" : path === "src/a.ts" ? "file" : undefined),
  entries: () => [
    { value: "src", label: "src" },
    { value: "src/a.ts", label: "src/a.ts" },
  ],
} as GitTreeLookup

test("activity log: undo and redo with nothing to take back fail the step", async () => {
  const log = {
    getSnapshot: () => ({ entries: [], position: 0, busy: false }),
    subscribe: () => () => {},
    undo: vi.fn(async () => []),
    redo: vi.fn(async () => []),
    seek: vi.fn(async () => []),
  }
  const view = mounted(mount(activityLog, { log }, `<root aria-label="Activity"></root>`))
  await failsWith("Activity", "undo", "undo has nothing to undo.")
  await failsWith("Activity", "redo", "redo has nothing to redo.")
  expect(log.undo).not.toHaveBeenCalled()
  expect(view.state.value).toBe(0)
})

test("agent task board: a refused view, filter, selection, thread or link fails the step", async () => {
  const attempt = sampleTasks.flatMap((task) => task.attempts ?? []).find((each) => each.thread)
  const withLink = sampleTasks.find((task) => (task.links ?? []).length > 0)
  const view = mounted(
    mount(
      agentTaskBoard,
      {
        tasks: sampleTasks,
        onViewChange: refuseAgent,
        onFiltersChange: refuseAgent,
        onSelectedTaskIdChange: refuseAgent,
        onOpenThread: refuseAgent,
        onOpenLink: refuseAgent,
      },
      `<root aria-label="Agent tasks"></root>`,
    ),
  )
  await failsWith("Agent tasks", "setView", "setView was refused by the app.", ["table"])
  await failsWith("Agent tasks", "filter", "filter was refused by the app.", [{ query: "login" }])
  await failsWith("Agent tasks", "selectTask", "selectTask was refused by the app.", [sampleTasks[0]?.id])
  if (attempt) await failsWith("Agent tasks", "openThread", "openThread was refused by the app.", [attempt.id])
  if (withLink) {
    const href = withLink.links?.[0]?.href
    await failsWith("Agent tasks", "openLink", "openLink was refused by the app.", [withLink.id, href])
  }
  expect(view.state.view).toBe("board")
  expect(view.state.selectedTaskId).toBeNull()
})

test("agent task moves and proposals: a refused move or decision fails the step", async () => {
  const task = sampleTasks.find((each) => each.status === "todo") ?? sampleTasks[0]!
  const onMoveTask = vi.fn(refuseAgent)
  mounted(
    mount(
      agentTaskMoves,
      { tasks: sampleTasks, statuses: ["todo", "working", "done"], agentApproval: "allow", onMoveTask },
      `<root aria-label="Task moves"></root>`,
    ),
  )
  await failsWith("Task moves", "moveTask", "moveTask was refused by the app.", [task.id, "done"])
  expect(onMoveTask).toHaveBeenCalledOnce()

  const proposed = sampleTasks.find((each) => each.status === "proposed")!
  const onApproveProposal = vi.fn(refuseAgent)
  mounted(
    mount(
      agentTaskProposals,
      { tasks: sampleTasks, mode: "live", agentApproval: "allow", onApproveProposal },
      `<root aria-label="Proposals"></root>`,
    ),
  )
  await failsWith("Proposals", "approveProposal", "approveProposal was refused by the app.", [proposed.id])
  expect(onApproveProposal).toHaveBeenCalledOnce()
})

test("attachments: a refused open fails the step and opens nothing", async () => {
  const open = vi.fn()
  mounted(
    mount(
      attachments,
      {
        attachments: [{ id: "log", kind: "file", name: "build.log", src: "/build.log", alt: "" }],
        open,
        onOpen: refuseAgent,
      },
      `<root aria-label="Files"></root>`,
    ),
  )
  await failsWith("Files", "openAttachment", "openAttachment was refused by the app.", ["log"])
  expect(open).not.toHaveBeenCalled()
})

test("board: a refused move fails the step and leaves the card where it was", async () => {
  const view = mounted(
    mount(
      boardTransfer,
      { defaultValue: { todo: ["a"], done: [] }, agentMoves: true, onValueChange: refuseAgent },
      `<root aria-label="Board"><list value="todo"><card value="a">a</card></list><list value="done"></list></root>`,
    ),
  )
  await failsWith("Board", "move", "move was refused by the app.", ["a", "done", 0])
  expect(view.state.value).toEqual({ todo: ["a"], done: [] })
})

test("code block and description value: copy without a clipboard or text fails the step", async () => {
  vi.stubGlobal("navigator", { ...navigator, clipboard: undefined })
  const code = mounted(mount(codeBlock, { text: "bun i" }, `<root aria-label="Install"></root>`))
  await failsWith("Install", "copy", "copy isn't available: the page has no clipboard access.")
  const value = mounted(mount(descriptionValue, { text: "" }, `<root aria-label="Commit"></root>`))
  await failsWith("Commit", "copy", "copy has nothing to copy.")
  expect([code.state.copied, value.state.copied]).toEqual([false, false])
})

test("commit history: a refused selection, expansion or branch fails the step", async () => {
  const view = mounted(
    mount(
      commitHistory,
      {
        lookup: commits,
        onSelectedChange: refuseAgent,
        onExpandedChange: refuseAgent,
        onDetailsChange: refuseAgent,
        onOpenCommit: refuseAgent,
        branches: ["main", "dev"],
        branch: "main",
        onBranchChange: refuseAgent,
      },
      `<root aria-label="History"></root>`,
    ),
  )
  await failsWith("History", "select", "select was refused by the app.", ["c1"])
  await failsWith("History", "expand", "expand was refused by the app.", ["m1"])
  await failsWith("History", "expandDetails", "expandDetails was refused by the app.", ["c1"])
  await failsWith("History", "openCommit", "openCommit was refused by the app.", ["c1"])
  await failsWith("History", "selectBranch", "selectBranch was refused by the app.", ["dev"])
  expect(view.state).toMatchObject({ selected: null, expanded: [], details: [] })
})

// The bridge waits for a component whose action is still running, and leaves a disabled one out, so a confirm button
// refuses only calls from app code.
test("confirm button: confirm from code while its confirmation runs throws", () => {
  const onConfirm = vi.fn(() => new Promise<void>(() => {}))
  const view = mounted(mount(confirmButton, { onConfirm }, `<root aria-label="Delete"></root>`))
  expect(view.api.confirm()).toBe(true)
  expect(() => view.api.confirm()).toThrow("confirm isn't available while its confirmation runs.")
  expect(view.api.confirm(new MouseEvent("click"), "trigger-press")).toBe(false)
  expect(onConfirm).toHaveBeenCalledOnce()
})

test("conversation: loading older messages with none to load fails the step", async () => {
  const onLoadOlder = vi.fn()
  mounted(mount(conversation, { hasOlder: false, onLoadOlder }, `<root aria-label="Chat"><log></log></root>`))
  await failsWith("Chat", "loadOlder", "loadOlder has nothing older to load.")
  expect(onLoadOlder).not.toHaveBeenCalled()
})

test("data table: a refused sort, selection or page fails the step", async () => {
  const view = mounted(
    mount(
      dataTable,
      {
        sortableColumns: ["name"],
        rowItems: [{ value: "r1", label: "Row 1" }],
        pageCount: 3,
        onSortChange: refuseAgent,
        onSelectionChange: refuseAgent,
        onPageChange: refuseAgent,
      },
      `<root aria-label="Users"></root>`,
    ),
  )
  await failsWith("Users", "sortBy", "sortBy was refused by the app.", ["name"])
  await failsWith("Users", "setSelection", "setSelection was refused by the app.", [["r1"]])
  await failsWith("Users", "setPage", "setPage was refused by the app.", [2])
  expect(view.state).toMatchObject({ sort: null, selection: [], page: 1 })
})

test("form: reset without onResetRequest fails the step", async () => {
  mounted(mount(formRoot, { named: true }, `<root aria-label="Profile"></root>`))
  await failsWith("Profile", "reset", "reset isn't offered: there is no onResetRequest.")
  const onResetRequest = vi.fn()
  mounted(mount(formRoot, { named: true, onResetRequest }, `<root aria-label="Address"></root>`))
  expect((await agent.act({ steps: [{ ref: "Address", action: "reset" }] })).ok).toBe(true)
  expect(onResetRequest).toHaveBeenCalledOnce()
})

test("git tree: a refused expansion or open fails the step", async () => {
  const onOpenFile = vi.fn(refuseAgent)
  const view = mounted(
    mount(
      gitTree,
      { lookup: tree, defaultExpanded: ["src"], onExpandedChange: refuseAgent, onOpenFile },
      `<root aria-label="Files"></root>`,
    ),
  )
  await failsWith("Files", "collapse", "collapse was refused by the app.", ["src"])
  await failsWith("Files", "open", "open was refused by the app.", ["src/a.ts"])
  expect(view.state.expanded).toEqual(["src"])
})

test("inline edit: a refused rename fails the step and keeps the text", async () => {
  const view = mounted(
    mount(
      inlineEdit,
      { defaultValue: "Apollo", onValueChange: refuseAgent },
      `<root aria-label="Name"><display>Apollo</display><trigger aria-label="Rename"></trigger></root>`,
    ),
  )
  await failsWith("Name", "rename", "rename was refused by the app.", ["Atlas"])
  await failsWith("Name", "cancel", "cancel isn't available while not editing.")
  expect(view.state.value).toBe("Apollo")
})

test("lightbox: stepping past the last image or a refused step fails the step", async () => {
  const view = mounted(
    mount(lightbox, { index: 2, count: 3, onIndexChange: refuseAgent }, `<root aria-label="Screens"></root>`),
  )
  await failsWith("Screens", "next", "next isn't available on the last item.")
  await failsWith("Screens", "previous", "previous was refused by the app.")
  expect(view.state.index).toBe(2)
})

test("link: a refused follow fails the step", async () => {
  const onFollow = vi.fn(refuseAgent)
  mounted(mount(link, { href: "/settings", onFollow }, `<root aria-label="Settings"></root>`))
  await failsWith("Settings", "follow", "follow was refused by the app.")
  expect(onFollow).toHaveBeenCalledWith("/settings", expect.objectContaining({ source: "agent" }))
})

test("list: a refused select fails the step and activates nothing", async () => {
  const activate = vi.fn(() => true)
  mounted(
    mount(
      list,
      { entries: [{ value: "a", label: "Alpha" }], activate, onSelect: refuseAgent },
      `<root aria-label="Rows"></root>`,
    ),
  )
  await failsWith("Rows", "select", "select was refused by the app.", ["a"])
  expect(activate).not.toHaveBeenCalled()
})

test("master detail: a refused open fails the step and keeps the detail closed", async () => {
  const view = mounted(
    mount(
      masterDetail,
      { entries: [{ id: "a", label: "Alpha" }], onSelectedIdChange: refuseAgent },
      `<root aria-label="Inbox"></root>`,
    ),
  )
  await failsWith("Inbox", "open", "open was refused by the app.", ["a"])
  expect(view.state.selectedId).toBeNull()
})

test("native select: a refused value fails the step and keeps the value", async () => {
  const view = mounted(
    mount(
      nativeSelect,
      {
        items: [
          { value: "eu", label: "Europe" },
          { value: "us", label: "United States" },
        ],
        defaultValue: "eu",
        onValueChange: refuseAgent,
      },
      `<root aria-label="Region"></root>`,
    ),
  )
  await failsWith("Region", "setValue", "setValue was refused by the app.", ["us"])
  expect(view.state.value).toBe("eu")
})

test("search field: a refused search fails the step", async () => {
  const input = { getValue: () => "login", clear: () => true, focus: () => {} }
  const onSearch = vi.fn(refuseAgent)
  mounted(mount(searchField, { input, onSearch }, `<root aria-label="Search"><input aria-label="Query" /></root>`))
  await failsWith("Search", "submit", "submit was refused by the app.")
  expect(onSearch).toHaveBeenCalledOnce()
})

test("server filters: filters without apply or clear fail the step", async () => {
  mounted(
    mount(serverFilters, { fields: [{ value: "status", label: "Status" }] }, `<root aria-label="Filters"></root>`),
  )
  await failsWith("Filters", "filter", "filter isn't offered: there is no apply.", ["status", "open"])
  await failsWith("Filters", "clearFilters", "clearFilters isn't offered: there is no clear.")
  const apply = vi.fn()
  mounted(mount(serverFilters, { apply, fields: [] }, `<root aria-label="Other filters"></root>`))
  expect((await agent.act({ steps: [{ ref: "Other filters", action: "filter", args: ["status", "open"] }] })).ok).toBe(
    true,
  )
  expect(apply).toHaveBeenCalledWith("status", "open")
})

test("sidebar: a refused collapse fails the step and keeps it open", async () => {
  const view = mounted(mount(sidebar, { onCollapsedChange: refuseAgent }, `<root aria-label="Navigation"></root>`))
  await failsWith("Navigation", "collapse", "collapse was refused by the app.")
  expect(view.state.collapsed).toBe(false)
  expect((await agent.act({ steps: [{ ref: "Navigation", action: "expand" }] })).ok).toBe(true)
})

test("sortable: a refused reorder fails the step and keeps the order", async () => {
  const view = mounted(
    mount(
      sortable,
      { defaultValue: ["apple", "banana"], agentMoves: true, onValueChange: refuseAgent },
      `<root aria-label="Fruits"><entry value="apple">apple</entry><entry value="banana">banana</entry></root>`,
    ),
  )
  await failsWith("Fruits", "reorder", "reorder was refused by the app.", [["banana", "apple"]])
  await failsWith("Fruits", "move", "move was refused by the app.", ["banana", 0])
  expect(view.state.value).toEqual(["apple", "banana"])
})

test("a refusal from app code is an ActionRefusedError with its kind; a press gets false", () => {
  const view = mounted(mount(sidebar, { onCollapsedChange: refuseAgent }, `<root aria-label="Navigation"></root>`))
  expect(view.api.collapse({ reason: "trigger-press" })).toBe(true)
  const refusing = mounted(
    mount(sidebar, { onCollapsedChange: (_value, details) => details.cancel() }, `<root aria-label="Other"></root>`),
  )
  expect(refusing.api.collapse({ reason: "trigger-press" })).toBe(false)
  let caught: unknown
  try {
    refusing.api.collapse()
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(ActionRefusedError)
  expect(caught).toMatchObject({ action: "collapse", kind: "refused" })
})
