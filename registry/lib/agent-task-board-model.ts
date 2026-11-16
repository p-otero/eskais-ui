import { effectiveAgent, type AttemptView, type TaskStatus, type TaskView } from "@/lib/agent-task-types"
import type { Quantity } from "@/lib/quantity"

interface TaskFilters {
  project?: string
  profile?: string
  model?: string
  query?: string
  /** Stage ids; a task matches when its location is in any of them. */
  stage?: string[]
}

interface ColumnConfig {
  status: TaskStatus
  hidden?: boolean
  collapsed?: boolean
}

interface StatusColumn {
  status: TaskStatus
  tasks: TaskView[]
  collapsed: boolean
  /** Only on the `todo` column. */
  groups?: { ready: TaskView[]; waiting: TaskView[] }
}

interface FilterOptions {
  projects: string[]
  profiles: string[]
  models: string[]
}

type SortKey = "id" | "title" | "status" | "updatedAt" | "attempts" | "cost"
type SortDirection = "ascending" | "descending"

interface BoardSummary {
  total: number
  byStatus: Record<TaskStatus, number>
  /** `rated` counts tasks whose `acceptedFirstPass` is known. */
  acceptedFirstPass: { accepted: number; rated: number }
  cost: Quantity
  awaitingDecision: number
}

const TASK_STATUSES: readonly TaskStatus[] = ["proposed", "todo", "working", "review", "blocked", "done", "cancelled"]
const HIDDEN_BY_DEFAULT: ReadonlySet<TaskStatus> = new Set(["cancelled"])
const UNKNOWN: Quantity = { value: null, quality: "unknown" }
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

function taskModels(task: TaskView): Set<string> {
  return new Set(task.attempts.map((attempt) => effectiveAgent(attempt).model))
}

function filterTasks(tasks: readonly TaskView[], filters: TaskFilters = {}): TaskView[] {
  const query = filters.query?.trim().toLowerCase()
  return tasks.filter(
    (task) =>
      (!filters.project || task.project === filters.project) &&
      (!filters.profile || task.profile === filters.profile) &&
      (!filters.model || task.attempts.some((attempt) => effectiveAgent(attempt).model === filters.model)) &&
      (!filters.stage?.length || (task.location !== undefined && filters.stage.includes(task.location.stage))) &&
      (!query || [task.id, task.title, task.goal].some((text) => text?.toLowerCase().includes(query))),
  )
}

/** Proposals and the to-do tasks that aren't ready yet: what isn't on its way. */
function backlogGroups(tasks: readonly TaskView[]): { proposed: TaskView[]; notReady: TaskView[] } {
  return {
    proposed: tasks.filter((task) => task.status === "proposed"),
    notReady: tasks.filter((task) => task.status === "todo" && !isReady(task)),
  }
}

/** How many tasks are in each stage, by stage id. */
function countByStage(tasks: readonly TaskView[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of tasks) {
    if (task.location) counts[task.location.stage] = (counts[task.location.stage] ?? 0) + 1
  }
  return counts
}

function isReady(task: TaskView): boolean {
  return task.ready ?? task.dependsOn.every((dependency) => dependency.status === "done")
}

function columnOrder(columns: readonly ColumnConfig[]): TaskStatus[] {
  const configured = columns.map((column) => column.status).filter((status) => TASK_STATUSES.includes(status))
  return [...new Set([...configured, ...TASK_STATUSES])]
}

function groupByStatus(tasks: readonly TaskView[], columns: readonly ColumnConfig[] = []): StatusColumn[] {
  const byStatus = new Map<TaskStatus, TaskView[]>(TASK_STATUSES.map((status) => [status, []]))
  for (const task of tasks) byStatus.get(task.status)?.push(task)
  const config = new Map(columns.map((column) => [column.status, column]))

  return columnOrder(columns)
    .filter((status) => !(config.get(status)?.hidden ?? HIDDEN_BY_DEFAULT.has(status)))
    .map((status) => {
      const list = byStatus.get(status) ?? []
      const column: StatusColumn = { status, tasks: list, collapsed: config.get(status)?.collapsed ?? false }
      if (status === "todo") {
        column.groups = { ready: list.filter(isReady), waiting: list.filter((task) => !isReady(task)) }
      }
      return column
    })
}

function sortedDistinct(values: Iterable<string | undefined>): string[] {
  return [...new Set([...values].filter((value): value is string => Boolean(value)))].toSorted(collator.compare)
}

function filterOptions(tasks: readonly TaskView[]): FilterOptions {
  return {
    projects: sortedDistinct(tasks.map((task) => task.project)),
    profiles: sortedDistinct(tasks.map((task) => task.profile)),
    models: sortedDistinct(tasks.flatMap((task) => [...taskModels(task)])),
  }
}

function knownValue(quantity: Quantity | undefined): number | null {
  if (!quantity || quantity.quality === "unknown" || quantity.value === null) return null
  return Number.isFinite(quantity.value) ? quantity.value : null
}

/** Unknown when every part is unknown; estimated when any part is estimated or missing, since the sum is then a floor. */
function sumQuantities(parts: readonly (Quantity | undefined)[]): Quantity {
  const known = parts.filter((part): part is Quantity => knownValue(part) !== null)
  if (known.length === 0) return UNKNOWN
  const value = known.reduce((total, part) => total + (part.value ?? 0), 0)
  if (known.length < parts.length || known.some((part) => part.quality === "estimated")) {
    return { value, quality: "estimated" }
  }
  if (known.length === 1 && known[0]) return { value, quality: known[0].quality }
  return { value, quality: "derived" }
}

function taskCost(task: TaskView): Quantity {
  if (task.usage) return task.usage.costUsd
  if (task.attempts.length === 0) return UNKNOWN
  return sumQuantities(task.attempts.map((attempt) => attempt.usage?.costUsd ?? UNKNOWN))
}

function attemptCount(task: TaskView): number {
  return task.counts?.attempts ?? task.attempts.length
}

/** The attempt `activeAttemptId` names, or else the latest one. */
function activeAttempt(task: TaskView): AttemptView | undefined {
  return task.attempts.find((attempt) => attempt.id === task.activeAttemptId) ?? task.attempts.at(-1)
}

const comparators: Record<Exclude<SortKey, "cost">, (a: TaskView, b: TaskView) => number> = {
  id: (a, b) => collator.compare(a.id, b.id),
  title: (a, b) => collator.compare(a.title, b.title),
  status: (a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status),
  updatedAt: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
  attempts: (a, b) => attemptCount(a) - attemptCount(b),
}

function sortTasks(tasks: readonly TaskView[], key: SortKey, direction: SortDirection = "ascending"): TaskView[] {
  const sign = direction === "ascending" ? 1 : -1
  if (key !== "cost") return tasks.toSorted((a, b) => sign * comparators[key](a, b))
  return tasks.toSorted((a, b) => {
    const left = knownValue(taskCost(a))
    const right = knownValue(taskCost(b))
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    return sign * (left - right)
  })
}

function hasRun(task: TaskView): boolean {
  return task.usage !== undefined || task.attempts.length > 0
}

function needsDecision(task: TaskView): boolean {
  return Boolean(task.decisionNeeded) || (task.status === "proposed" && task.analysisMode === "review")
}

function summarize(tasks: readonly TaskView[]): BoardSummary {
  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<TaskStatus, number>
  let accepted = 0
  let rated = 0
  let awaitingDecision = 0
  for (const task of tasks) {
    byStatus[task.status] += 1
    if (task.acceptedFirstPass !== undefined) rated += 1
    if (task.acceptedFirstPass) accepted += 1
    if (needsDecision(task)) awaitingDecision += 1
  }
  return {
    total: tasks.length,
    byStatus,
    acceptedFirstPass: { accepted, rated },
    cost: sumQuantities(tasks.filter(hasRun).map(taskCost)),
    awaitingDecision,
  }
}

export {
  TASK_STATUSES,
  activeAttempt,
  attemptCount,
  backlogGroups,
  columnOrder,
  countByStage,
  filterOptions,
  filterTasks,
  groupByStatus,
  isReady,
  needsDecision,
  sortTasks,
  sumQuantities,
  summarize,
  taskCost,
}
export type { BoardSummary, ColumnConfig, FilterOptions, SortDirection, SortKey, StatusColumn, TaskFilters }
