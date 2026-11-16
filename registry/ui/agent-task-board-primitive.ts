import {
  createChange,
  createController,
  definePrimitive,
  dispatch,
  type ChangeDetails,
  type ChangeOptions,
} from "@ui-sdk/core"

import { filterOptions, type TaskFilters } from "@/lib/agent-task-board-model"
import type { AttemptView, TaskLink, TaskView, ThreadRef } from "@/lib/agent-task-types"

type BoardView = "board" | "table" | "backlog"
type BoardMode = "snapshot" | "live"
type AgentApproval = "confirm" | "allow" | "deny"

type ViewChangeReason = "item-press" | "imperative"
type FiltersChangeReason = "item-press" | "input-change" | "clear-press" | "imperative"
type SelectReason = "item-press" | "close-press" | "escape-key" | "outside-press" | "imperative"
type OpenThreadReason = "item-press" | "link-press" | "imperative"
type OpenLinkReason = "link-press" | "imperative"

type AgentTaskBoardOptions = {
  tasks?: TaskView[]
  /** Stage ids the `stage` filter accepts; without it, the stages the tasks' locations name. */
  stageIds?: readonly string[]
  view?: BoardView
  defaultView?: BoardView
  onViewChange?: (view: BoardView, details: ChangeDetails<ViewChangeReason>) => void
  filters?: TaskFilters
  defaultFilters?: TaskFilters
  onFiltersChange?: (filters: TaskFilters, details: ChangeDetails<FiltersChangeReason>) => void
  selectedTaskId?: string | null
  defaultSelectedTaskId?: string | null
  /** The contract's `onSelectTask`; the root component maps one onto the other. */
  onSelectedTaskIdChange?: (id: string | null, details: ChangeDetails<SelectReason>) => void
  onOpenThread?: (thread: ThreadRef, details: ChangeDetails<OpenThreadReason> & { attemptId: string }) => void
  onOpenLink?: (link: TaskLink, details: ChangeDetails<OpenLinkReason> & { taskId: string }) => void
  controller?: AgentTaskBoardController
}

interface AgentTaskBoardController {
  setView: (view: BoardView, options?: ChangeOptions<ViewChangeReason>) => boolean | undefined
  filter: (partial: FilterChange, options?: ChangeOptions<FiltersChangeReason>) => boolean | undefined
  selectTask: (id: string | null, options?: ChangeOptions<SelectReason>) => boolean | undefined
  openThread: (attemptId: string, options?: ChangeOptions<OpenThreadReason>) => boolean | undefined
  openLink: (taskId: string, link: string, options?: ChangeOptions<OpenLinkReason>) => boolean | undefined
}

type FilterChange = Partial<Record<Exclude<keyof TaskFilters, "stage">, string | null>> & {
  stage?: readonly string[] | string | null
}

const VIEWS: readonly BoardView[] = ["board", "table", "backlog"]
const FILTER_KEYS = ["project", "profile", "model", "query", "stage"] as const
const CHOICE_KEYS = { project: "projects", profile: "profiles", model: "models" } as const

function reasonOf<Reason extends string>(options: unknown): { reason: Reason | "imperative"; event?: Event } {
  if (typeof options !== "object" || options === null) return { reason: "imperative" }
  const { reason = "imperative", event } = options as ChangeOptions<Reason>
  return { reason, event: event instanceof Event ? event : undefined }
}

// The agent bridge passes action arguments unchecked, so every action validates its own.
function checkStages(value: unknown, allowed: readonly string[]): string[] | undefined {
  const list = typeof value === "string" ? [value] : value
  if (!Array.isArray(list) || list.some((stage) => typeof stage !== "string")) {
    throw new TypeError(`Filter "stage" takes a list of stage ids, or null to clear it.`)
  }
  for (const stage of list) {
    if (!allowed.includes(stage)) throw new RangeError(`No stage "${stage}". Choices: ${allowed.join(", ")}.`)
  }
  return list.length > 0 ? [...new Set(list as string[])] : undefined
}

function stageChoices(tasks: readonly TaskView[], stageIds: readonly string[] | undefined): string[] {
  return stageIds ? [...stageIds] : [...new Set(tasks.flatMap((task) => (task.location ? [task.location.stage] : [])))]
}

function checkFilters(
  partial: unknown,
  current: TaskFilters,
  tasks: readonly TaskView[],
  stageIds: readonly string[] | undefined,
): TaskFilters {
  if (typeof partial !== "object" || partial === null || Array.isArray(partial)) {
    throw new TypeError(`filter takes an object with any of: ${FILTER_KEYS.join(", ")}.`)
  }
  const choices = filterOptions(tasks)
  const next: TaskFilters = { ...current }
  for (const [key, value] of Object.entries(partial)) {
    if (!(FILTER_KEYS as readonly string[]).includes(key)) {
      throw new TypeError(`Unknown filter "${key}". Filters: ${FILTER_KEYS.join(", ")}.`)
    }
    const filterKey = key as keyof TaskFilters
    if (value === null || value === undefined || value === "") {
      delete next[filterKey]
      continue
    }
    if (filterKey === "stage") {
      const stages = checkStages(value, stageChoices(tasks, stageIds))
      if (stages) next.stage = stages
      else delete next.stage
      continue
    }
    if (typeof value !== "string") throw new TypeError(`Filter "${key}" takes text, or null to clear it.`)
    if (filterKey !== "query") {
      const allowed = choices[CHOICE_KEYS[filterKey]]
      if (!allowed.includes(value)) throw new RangeError(`No ${key} "${value}". Choices: ${allowed.join(", ")}.`)
    }
    next[filterKey] = value
  }
  return next
}

function findAttempt(tasks: readonly TaskView[], attemptId: string): AttemptView | undefined {
  for (const task of tasks) {
    const attempt = task.attempts.find((candidate) => candidate.id === attemptId)
    if (attempt) return attempt
  }
  return undefined
}

const agentTaskBoard = definePrimitive({
  name: "agent-task-board",
  options: {
    tasks: "list",
    stageIds: "list",
    view: "string",
    defaultView: "string",
    onViewChange: "callback",
    filters: "value",
    defaultFilters: "value",
    onFiltersChange: "callback",
    selectedTaskId: "value",
    defaultSelectedTaskId: "value",
    onSelectedTaskIdChange: "callback",
    onOpenThread: "callback",
    onOpenLink: "callback",
    controller: "value",
  },
  state: (options: AgentTaskBoardOptions) => ({
    view: options.view ?? options.defaultView ?? ("board" as BoardView),
    filters: options.filters ?? options.defaultFilters ?? {},
    selectedTaskId:
      options.selectedTaskId !== undefined ? options.selectedTaskId : (options.defaultSelectedTaskId ?? null),
  }),
  sync: (options) => ({
    ...(options.view === undefined ? {} : { view: options.view }),
    ...(options.filters === undefined ? {} : { filters: options.filters }),
    ...(options.selectedTaskId === undefined ? {} : { selectedTaskId: options.selectedTaskId }),
  }),
  controlled: ["view", "filters", "selectedTaskId"],
  api: (context) => {
    const change = createChange(context)
    const tasks = () => context.options().tasks ?? []
    return {
      setView(view: unknown, options?: ChangeOptions<ViewChangeReason>) {
        if (!VIEWS.includes(view as BoardView)) throw new TypeError(`setView takes one of: ${VIEWS.join(", ")}.`)
        return change("view", view as BoardView, reasonOf(options))
      },
      filter(partial: unknown, options?: ChangeOptions<FiltersChangeReason>) {
        const next = checkFilters(partial, context.store.get().filters, tasks(), context.options().stageIds)
        return change("filters", next, reasonOf(options))
      },
      selectTask(id: unknown, options?: ChangeOptions<SelectReason>) {
        if (id !== null && !tasks().some((task) => task.id === id)) {
          throw new RangeError(`No task "${String(id)}". Pass a task id from the board, or null to close it.`)
        }
        return change("selectedTaskId", id as string | null, reasonOf(options))
      },
      openThread(attemptId: unknown, options?: ChangeOptions<OpenThreadReason>) {
        const attempt = typeof attemptId === "string" ? findAttempt(tasks(), attemptId) : undefined
        if (!attempt) throw new RangeError(`No attempt "${String(attemptId)}" on the board.`)
        if (!attempt.thread) throw new RangeError(`Attempt "${attempt.id}" has no thread.`)
        if (!context.options().onOpenThread) throw new Error("This board doesn't open threads.")
        const details = { ...reasonOf(options), attemptId: attempt.id }
        return !dispatch(context, "onOpenThread", attempt.thread, details)
      },
      openLink(taskId: unknown, link: unknown, options?: ChangeOptions<OpenLinkReason>) {
        const task = tasks().find((candidate) => candidate.id === taskId)
        if (!task) throw new RangeError(`No task "${String(taskId)}" on the board.`)
        const links = task.links ?? []
        const found = links.find((candidate) => candidate.href === link || candidate.label === link)
        if (!found) {
          const choices = links.map((candidate) => candidate.label).join(", ") || "none"
          throw new RangeError(`Task "${task.id}" has no link "${String(link)}". Links: ${choices}.`)
        }
        if (!context.options().onOpenLink) throw new Error("This board doesn't open links.")
        return !dispatch(context, "onOpenLink", found, { ...reasonOf(options), taskId: task.id })
      },
      tasks: () => tasks().map((task) => ({ value: task.id, label: `${task.id} ${task.title}` })),
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "region",
      attrs: (state) => ({ "data-view": state.view, "data-selected": state.selectedTaskId === null ? undefined : "" }),
    }),
  }),
  agent: { actions: ["selectTask", "openThread", "openLink", "setView", "filter"], items: (api) => api.tasks() },
})

function createAgentTaskBoardController() {
  return createController<AgentTaskBoardController>()
}

export { agentTaskBoard, createAgentTaskBoardController }
export type {
  AgentApproval,
  AgentTaskBoardController,
  AgentTaskBoardOptions,
  BoardMode,
  BoardView,
  FilterChange,
  OpenLinkReason,
}
