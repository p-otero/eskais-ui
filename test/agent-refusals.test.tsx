import { mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { activityLog } from "@/components/ui/activity-log-primitive"
import { agentTaskBoard } from "@/components/ui/agent-task-board-primitive"
import { agentTaskMoves } from "@/components/ui/agent-task-moves-primitive"
import { agentTaskProposals } from "@/components/ui/agent-task-proposals-primitive"
import { attachments } from "@/components/ui/attachments-primitive"
import { boardTransfer } from "@/components/ui/board-transfer-primitive"
import { chalkboard } from "@/components/ui/chalkboard-primitive"
import { codeBlock } from "@/components/ui/code-block-primitive"
import { commitHistory, type CommitLookup } from "@/components/ui/commit-history-primitive"
import { confirmButton } from "@/components/ui/confirm-button-primitive"
import { conversation } from "@/components/ui/conversation-primitive"
import { dataTable } from "@/components/ui/data-table-primitive"
import { descriptionValue } from "@/components/ui/description-list-primitive"
import { formRoot } from "@/components/ui/form-primitive"
import { gitTree, type GitTreeLookup } from "@/components/ui/git-tree-primitive"
import { inlineEdit } from "@/components/ui/inline-edit-primitive"
import { ledMatrix } from "@/components/ui/led-matrix-primitive"
import { lightbox } from "@/components/ui/lightbox-primitive"
import { logViewer } from "@/components/ui/log-viewer-primitive"
import { createLogStore } from "@/components/ui/log-viewer-store"
import { link } from "@/components/ui/link-primitive"
import { liveSky } from "@/components/ui/live-sky-primitive"
import { list } from "@/components/ui/list-primitive"
import { masterDetail } from "@/components/ui/master-detail-primitive"
import { modelScan } from "@/components/ui/model-scan-primitive"
import { nativeSelect } from "@/components/ui/native-select-primitive"
import { mixer } from "@/components/ui/mixer-primitive"
import { neonSign } from "@/components/ui/neon-sign-primitive"
import { prismPicker } from "@/components/ui/prism-picker-primitive"
import { safeDial } from "@/components/ui/safe-dial-primitive"
import { sunArc } from "@/components/ui/sun-arc-primitive"
import { vinylScrubber } from "@/components/ui/vinyl-scrubber-primitive"
import { searchField } from "@/components/ui/search-field-primitive"
import { serverFilters } from "@/components/ui/server-filters-primitive"
import { sidebar } from "@/components/ui/sidebar-primitive"
import { sortable } from "@/components/ui/sortable-primitive"
import { teletext } from "@/components/ui/teletext-primitive"
import { ActionRefusedError, parseActionRefusal } from "@/lib/action-refusal"

import { sampleTasks } from "./fixtures/agent-tasks"

const agent = createAgent()

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

test("log viewer: a refused filter, search or wrap fails the step and keeps the view; no errors to step to fails", async () => {
  const store = createLogStore({ schedule: (notify) => notify() })
  store.append([
    { text: "ready", source: "api" },
    { text: "connected", source: "db" },
  ])
  const view = mounted(
    mount(
      logViewer,
      { store, onHiddenSourcesChange: refuseAgent, onQueryChange: refuseAgent, onWrapChange: refuseAgent },
      `<root aria-label="Logs"><log aria-label="Logs"></log></root>`,
    ),
  )
  await failsWith("Logs", "filter", "filter was refused by the app.", ["api"])
  await failsWith("Logs", "search", "search was refused by the app.", ["ready"])
  await failsWith("Logs", "setWrap", "setWrap was refused by the app.", [true])
  await failsWith("Logs", "nextError", "nextError has no errors to go to.")
  await failsWith("Logs", "previousError", "previousError has no errors to go to.")
  expect([view.state.hiddenSources, view.state.query, view.state.wrap, view.state.count]).toEqual([[], "", false, 2])
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

test("model scan: a refused start, cancel, retry, restart or download fails the step; a stage that forbids one says so", async () => {
  const callbacks = {
    onStart: vi.fn(refuseAgent),
    onCancel: vi.fn(refuseAgent),
    onRetry: vi.fn(refuseAgent),
    onStartOver: vi.fn(refuseAgent),
    onDownload: vi.fn(refuseAgent),
  }
  const markup = `<root aria-label="Scan"><photo></photo><effect></effect><points></points></root>`
  const photo = mounted(mount(modelScan, { stage: "photo", ...callbacks }, markup))
  await failsWith("Scan", "start", "start was refused by the app.")
  await failsWith("Scan", "download", "download isn't available before a scan starts.")
  expect(photo.state.stage).toBe("photo")
  photo.unmount()
  const running = mounted(mount(modelScan, { stage: "building", ...callbacks }, markup))
  await failsWith("Scan", "cancel", "cancel was refused by the app.")
  await failsWith("Scan", "retry", "retry isn't available while the scan runs.")
  expect(running.state.stage).toBe("building")
  running.unmount()
  const ready = mounted(mount(modelScan, { stage: "ready", ...callbacks }, markup))
  await failsWith("Scan", "download", "download was refused by the app.")
  await failsWith("Scan", "restart", "restart was refused by the app.")
  await failsWith("Scan", "cancel", "cancel isn't available once the model is ready.")
  ready.unmount()
  const failed = mounted(mount(modelScan, { stage: "error", ...callbacks }, markup))
  await failsWith("Scan", "retry", "retry was refused by the app.")
  failed.unmount()
  const bare = mounted(mount(modelScan, { stage: "ready" }, markup))
  await failsWith("Scan", "download", "download isn't offered by the app.")
  expect(bare.state.stage).toBe("ready")
  for (const callback of Object.values(callbacks)) expect(callback).toHaveBeenCalledOnce()
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

test("prism picker: a refused turn, a wavelength outside the spectrum, a purple or a disabled picker fail the step", async () => {
  let value = 520
  const slider = { getValue: () => value, setValue: vi.fn((_next: number): boolean => false) }
  mounted(mount(prismPicker, { slider }, `<root aria-label="Prism colour"></root>`))
  await failsWith("Prism colour", "setWavelength", "setWavelength was refused by the app.", [470])
  await failsWith("Prism colour", "setHue", "setHue was refused by the app.", [200])
  await failsWith("Prism colour", "setWavelength", "takes 380 to 700 nm, the visible spectrum, not 900", [900])
  await failsWith("Prism colour", "setHue", "can't reach 330°: magentas and purples", [330])
  expect(value).toBe(520)
  slider.setValue.mockImplementation((next: number) => {
    value = next
    return true
  })
  mounted(mount(prismPicker, { slider, disabled: true }, `<root aria-label="Disabled prism"></root>`))
  await failsWith(
    "Disabled prism",
    "setWavelength",
    "setWavelength isn't available while the picker is disabled",
    [470],
  )
  expect(value).toBe(520)
})

test("sun arc: a refused move, a time off the clock, a polar sunrise or a disabled arc fail the step", async () => {
  const slider = { getValue: () => 600, setValue: vi.fn((_next: number): boolean => false) }
  const day = { kind: "day" as const, sunrise: 519, sunset: 1083, noon: 801 }
  mounted(mount(sunArc, { slider, day }, `<root aria-label="Meeting time"></root>`))
  await failsWith("Meeting time", "setTime", "setTime was refused by the app.", ["17:45"])
  await failsWith("Meeting time", "sunrise", "sunrise was refused by the app.")
  await failsWith("Meeting time", "setTime", 'takes minutes from 0 to 1439 or "HH:MM"', ["24:10"])
  const night = { kind: "polar-night" as const, sunrise: undefined, sunset: undefined, noon: 715 }
  mounted(mount(sunArc, { slider, day: night }, `<root aria-label="Arctic time"></root>`))
  await failsWith("Arctic time", "sunset", "the sun doesn't rise on this day here (polar night)")
  const calibrate = vi.fn((): boolean => false)
  mounted(mount(sunArc, { slider, day, calibrate }, `<root aria-label="Photo arc"></root>`))
  await failsWith("Photo arc", "calibrate", "calibrate was refused by the app.", [200])
  await failsWith("Photo arc", "calibrate", "takes a field of view from 20 to 130°, not 170", [200, 170])
  await failsWith("Meeting time", "calibrate", "calibrate isn't available without a photo", [200])
  expect(calibrate).toHaveBeenCalledOnce()
  mounted(mount(sunArc, { slider, day, disabled: true }, `<root aria-label="Disabled arc"></root>`))
  await failsWith("Disabled arc", "solarNoon", "solarNoon isn't available while the picker is disabled")
  expect(slider.setValue).toHaveBeenCalledTimes(2)
})

test("mixer: a refused change, a locked channel, room the locks don't leave or a wrong split fail the step", async () => {
  const channels = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]
  const values = { a: 50, b: 30, c: 20 }
  const commit = vi.fn((): boolean => false)
  const commitLock = vi.fn((): boolean => false)
  mounted(mount(mixer, { channels, values, locked: ["c"], commit, commitLock }, `<root aria-label="Split"></root>`))
  await failsWith("Split", "setChannel", "setChannel was refused by the app.", ["a", 60])
  await failsWith("Split", "lock", "lock was refused by the app.", ["a"])
  await failsWith("Split", "setChannel", "can't move Gamma: it is locked", ["c", 10])
  await failsWith("Split", "setChannel", "locked channels hold 20 of 100, so it can take at most 80", ["a", 90])
  await failsWith("Split", "setAll", "needs values that sum to 100, not 90", [[50, 20, 20]])
  await failsWith("Split", "setAll", "can't move Gamma: it is locked at 20", [{ a: 40, b: 30, c: 30 }])
  await failsWith("Split", "setChannel", 'has no channel "z"', ["z", 10])
  mounted(mount(mixer, { channels, values, locked: ["b", "c"], commit, commitLock }, `<root aria-label="Held"></root>`))
  await failsWith("Held", "setChannel", "every other channel is locked", ["a", 40])
  expect(commit).toHaveBeenCalledOnce()
})

test("safe dial: a refused code, a wrong count, a number off the dial or a disabled dial fail the step", async () => {
  const code = { getValue: () => "", setValue: vi.fn((_next: string): boolean => false) }
  mounted(mount(safeDial, { code, length: 3, numbers: 40 }, `<root aria-label="Vault"></root>`))
  await failsWith("Vault", "enter", "enter was refused by the app.", ["12-07-39"])
  await failsWith("Vault", "enter", "takes 3 numbers, not 2", ["12-07"])
  await failsWith("Vault", "enter", "can't dial 45: the dial runs from 0 to 39", [[12, 45, 7]])
  mounted(mount(safeDial, { code, disabled: true }, `<root aria-label="Locked vault"></root>`))
  await failsWith("Locked vault", "enter", "enter isn't available while the dial is disabled", ["1234"])
  expect(code.setValue).toHaveBeenCalledOnce()
})

test("vinyl scrubber: a refused seek or play, a time past the end or an unknown duration fail the step", async () => {
  const seek = vi.fn((): boolean => false)
  const setPlaying = vi.fn((): boolean => false)
  mounted(mount(vinylScrubber, { duration: 240, seek, setPlaying }, `<root aria-label="Track"></root>`))
  await failsWith("Track", "seek", "seek was refused by the app.", [30])
  await failsWith("Track", "play", "play was refused by the app.")
  await failsWith("Track", "seek", 'takes 0 to 240 seconds or "m:ss", not 900', [900])
  mounted(mount(vinylScrubber, { duration: 0, seek, setPlaying }, `<root aria-label="Loading"></root>`))
  await failsWith("Loading", "seek", "seek isn't available until the media's duration is known", [30])
  expect(seek).toHaveBeenCalledOnce()
  expect(setPlaying).toHaveBeenCalledOnce()
})

test("live sky: denied location, a missing place, a bad coordinate or simulated weather fail the step", async () => {
  const handlers = {
    setLocation: vi.fn(),
    geolocate: vi.fn(() => Promise.resolve({ latitude: 0, longitude: 0 })),
    refresh: vi.fn(() => Promise.resolve()),
  }
  mounted(mount(liveSky, { handlers, geolocation: "denied", hasLocation: false }, `<root aria-label="Sky"></root>`))
  await failsWith("Sky", "geolocate", "geolocate isn't available: the person denied location access in the browser")
  await failsWith("Sky", "refresh", "refresh isn't available before the sky has a place")
  await failsWith("Sky", "setLocation", "can't look a place up by name here", ["Vigo"])
  await failsWith("Sky", "setLocation", "takes a latitude from -90 to 90", [95, 0])
  expect(handlers.geolocate).not.toHaveBeenCalled()
  expect(handlers.setLocation).not.toHaveBeenCalled()
  mounted(mount(liveSky, { handlers, geolocation: "unsupported" }, `<root aria-label="Old browser sky"></root>`))
  await failsWith("Old browser sky", "geolocate", "geolocate isn't available: this browser can't tell where it is")
  mounted(mount(liveSky, { handlers, simulated: true, hasLocation: true }, `<root aria-label="Demo sky"></root>`))
  await failsWith("Demo sky", "refresh", "refresh isn't available while the sky shows simulated weather")
  expect(handlers.refresh).not.toHaveBeenCalled()
  await failsWith("Demo sky", "calibrate", "calibrate isn't available without a photo", [200])
  const calibrate = vi.fn(() => true)
  mounted(mount(liveSky, { handlers: { ...handlers, calibrate } }, `<root aria-label="Photo sky"></root>`))
  await failsWith("Photo sky", "calibrate", "takes a field of view from 20 to 130°, not 200", [180, 200])
  await failsWith("Photo sky", "calibrate", "takes a horizon from 0 to 1 down the photo, not 1.5", [180, 70, 1.5])
  expect(calibrate).not.toHaveBeenCalled()
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

test("parseActionRefusal tells a refusal from another failure in agent.act()'s step error", async () => {
  mounted(
    mount(
      gitTree,
      { lookup: tree, defaultExpanded: ["src"], onExpandedChange: refuseAgent },
      `<root aria-label="Files"></root>`,
    ),
  )
  const refused = await agent.act({ steps: [{ ref: "Files", action: "collapse", args: ["src"] }] })
  expect(refused.error?.message).toBe("collapse was refused by the app. [refused:collapse]")
  expect(parseActionRefusal(refused.error)).toEqual({
    action: "collapse",
    kind: "refused",
    text: "collapse was refused by the app.",
  })
  const other = await agent.act({ steps: [{ ref: "Files", action: "open", args: ["src/a.ts"] }] })
  expect(other.ok).toBe(false)
  expect(parseActionRefusal(other.error)).toBeNull()
  const missing = await agent.act({ steps: [{ ref: "Nothing by this name", action: "open" }] })
  expect(parseActionRefusal(missing.error?.message)).toBeNull()

  mounted(mount(conversation, { hasOlder: false, onLoadOlder: vi.fn() }, `<root aria-label="Chat"><log></log></root>`))
  const unavailableStep = await agent.act({ steps: [{ ref: "Chat", action: "loadOlder" }] })
  expect(parseActionRefusal(unavailableStep.error)).toMatchObject({ action: "loadOlder", kind: "unavailable" })
})

test("parseActionRefusal reads the error, a message the bridge prefixed, and leaves redacted ones alone", () => {
  const error = new ActionRefusedError("start", "unavailable", "start isn't available while listening.")
  expect(error.message).toBe("start isn't available while listening. [unavailable:start]")
  expect(error.text).toBe("start isn't available while listening.")
  expect(parseActionRefusal(error)).toEqual({ action: "start", kind: "unavailable", text: error.text })
  expect(parseActionRefusal(`start on Voice (c2) failed: ${error.message}`)).toMatchObject({ action: "start" })
  expect(parseActionRefusal("start on Voice (c2) failed: [redacted]")).toBeNull()
  expect(parseActionRefusal(new Error('Card "a" can\'t be moved.'))).toBeNull()
  expect(parseActionRefusal(undefined)).toBeNull()
})

test("led matrix: refused messages or pause, and messages with no text, fail the step and the sign keeps going", async () => {
  const view = mounted(
    mount(
      ledMatrix,
      { defaultMessages: ["Open"], onMessagesChange: refuseAgent, onPausedChange: refuseAgent },
      `<root aria-label="Shop sign"></root>`,
    ),
  )
  await failsWith("Shop sign", "setMessages", "setMessages was refused by the app.", [["Closed"]])
  await failsWith("Shop sign", "pause", "pause was refused by the app.")
  await failsWith("Shop sign", "setMessages", "setMessages takes a list of messages with text", [["  "]])
  expect(view.state.messages).toEqual(["Open"])
  expect(view.state.paused).toBe(false)
})

test("neon sign: a refused switch fails the step and the tubes stay as they were", async () => {
  const view = mounted(mount(neonSign, { onOnChange: refuseAgent }, `<root aria-label="Studio"></root>`))
  await failsWith("Studio", "turnOff", "turnOff was refused by the app.")
  expect(view.state.on).toBe(true)
})

test("chalkboard: a refused write, or content that isn't text or blocks, fails the step and the board keeps its words", async () => {
  const view = mounted(
    mount(chalkboard, { defaultContent: "# Soup", onContentChange: refuseAgent }, `<root aria-label="Menu"></root>`),
  )
  await failsWith("Menu", "write", "write was refused by the app.", ["# Stew"])
  await failsWith("Menu", "write", "write takes text, a line each", [[{ type: "poster" }]])
  expect(view.state.content).toBe("# Soup")
})

test("teletext: a missing page, a page out of range, a colour key with no link or a refused tune fail the step", async () => {
  const pages = {
    100: {
      title: "Index",
      rows: [],
      fastext: { red: { page: 101, label: "News" }, green: { page: 300, label: "Sport" } },
    },
    101: { title: "News", rows: [] },
  }
  const view = mounted(mount(teletext, { pages }, `<root aria-label="Teletext"></root>`))
  await failsWith("Teletext", "goToPage", "goToPage can't find page 555: this service has 100, 101", [555])
  await failsWith("Teletext", "goToPage", "goToPage takes a page from 100 to 899, not 42", [42])
  await failsWith("Teletext", "fastext", "fastext has no blue link on page 100", ["blue"])
  await failsWith("Teletext", "fastext", "fastext can't find page 300", ["green"])
  await failsWith("Teletext", "fastext", "fastext takes red, green, yellow or blue, not purple", ["purple"])
  expect(view.state.page).toBe(100)
  const refused = mounted(
    mount(teletext, { pages, onPageChange: refuseAgent }, `<root aria-label="Refusing set"></root>`),
  )
  await failsWith("Refusing set", "goToPage", "goToPage was refused by the app.", [101])
  expect(refused.state.page).toBe(100)
})
