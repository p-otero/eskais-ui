import type { TaskStatus } from "@/lib/agent-task-types"

interface ProposalLabels {
  /** Accessible name of the agent-only proposals group. */
  group: string
  approve: string
  approveName: (taskId: string) => string
  approving: string
  reject: string
  rejectName: (taskId: string) => string
  rejectTitle: (taskId: string) => string
  rejectDescription: string
  /** Must not repeat the reject trigger's words: an agent's press matches whole words. */
  rejectConfirm: string
  rejecting: string
  cancel: string
  approveAgentConfirm: (taskId: string) => string
  rejectAgentConfirm: (taskId: string) => string
  /** The board-level mark, shared by every proposal. */
  agentConfirm: string
}

/**
 * Labels of the pieces the board composes (AgentBadge, LivenessIndicator,
 * UsageTable, AttemptTimeline), keyed by component, each its own Partial labels.
 * Typed loosely until those components land; narrow it then.
 */
type AgentTaskBoardComponentLabels = Record<string, Record<string, unknown>>

interface AgentTaskBoardLabels {
  board: string
  columns: Record<TaskStatus, string>
  ready: string
  waiting: string
  filters: {
    group: string
    project: string
    allProjects: string
    profile: string
    anyProfile: string
    model: string
    anyModel: string
    search: string
    searchPlaceholder: string
    clear: string
  }
  views: { group: string; board: string; table: string }
  summary: {
    group: string
    total: string
    acceptedFirstPass: string
    acceptedFirstPassValue: (accepted: number, rated: number) => string
    cost: string
    awaitingDecision: string
  }
  proposals: ProposalLabels
  snapshot: (date: string) => string
  empty: { board: string; column: string; filtered: string; attempts: string }
  errors: { approveFailed: string; rejectFailed: string; unknown: string }
  components: AgentTaskBoardComponentLabels
}

/** Every top-level key optional, and every object one level down optional too. */
type AgentTaskBoardLabelsInput = {
  [Key in keyof AgentTaskBoardLabels]?: AgentTaskBoardLabels[Key] extends (...args: never[]) => unknown
    ? AgentTaskBoardLabels[Key]
    : AgentTaskBoardLabels[Key] extends object
      ? Partial<AgentTaskBoardLabels[Key]>
      : AgentTaskBoardLabels[Key]
}

const agentTaskBoardLabels: AgentTaskBoardLabels = {
  board: "Agent tasks",
  columns: {
    proposed: "Proposed",
    todo: "To do",
    working: "Working",
    review: "Review",
    blocked: "Blocked",
    done: "Done",
    cancelled: "Cancelled",
  },
  ready: "Ready",
  waiting: "Waiting on dependencies",
  filters: {
    group: "Filters",
    project: "Project",
    allProjects: "All projects",
    profile: "Profile",
    anyProfile: "Any profile",
    model: "Model",
    anyModel: "Any model",
    search: "Search tasks",
    searchPlaceholder: "Search by ID, title or goal",
    clear: "Clear filters",
  },
  views: { group: "View", board: "Board", table: "Table" },
  summary: {
    group: "Summary",
    total: "Tasks",
    acceptedFirstPass: "Accepted first pass",
    acceptedFirstPassValue: (accepted, rated) => `${accepted} of ${rated}`,
    cost: "Estimated cost",
    awaitingDecision: "Awaiting a decision",
  },
  proposals: {
    group: "Proposal decisions",
    approve: "Approve",
    approveName: (taskId) => `Approve proposal ${taskId}`,
    approving: "Approving proposal",
    reject: "Reject",
    rejectName: (taskId) => `Reject proposal ${taskId}`,
    rejectTitle: (taskId) => `Reject proposal ${taskId}?`,
    rejectDescription: "No agent starts on it, and it leaves the board.",
    rejectConfirm: "Discard it",
    rejecting: "Rejecting proposal",
    cancel: "Cancel",
    approveAgentConfirm: (taskId) => `Approves proposal ${taskId}, which starts agents`,
    rejectAgentConfirm: (taskId) => `Rejects proposal ${taskId}`,
    agentConfirm: "Approves or rejects a task proposal; approving starts agents",
  },
  snapshot: (date) => `Snapshot · ${date}`,
  empty: {
    board: "No tasks yet.",
    column: "Nothing here.",
    filtered: "No tasks match these filters.",
    attempts: "No attempts yet.",
  },
  errors: {
    approveFailed: "Couldn't approve the proposal.",
    rejectFailed: "Couldn't reject the proposal.",
    unknown: "Something went wrong.",
  },
  components: {},
}

const agentTaskBoardLabelsEs: AgentTaskBoardLabels = {
  board: "Tareas de agentes",
  columns: {
    proposed: "Propuestas",
    todo: "Por hacer",
    working: "En curso",
    review: "En revisión",
    blocked: "Bloqueadas",
    done: "Hechas",
    cancelled: "Canceladas",
  },
  ready: "Listas",
  waiting: "Esperando dependencias",
  filters: {
    group: "Filtros",
    project: "Proyecto",
    allProjects: "Todos los proyectos",
    profile: "Perfil",
    anyProfile: "Cualquier perfil",
    model: "Modelo",
    anyModel: "Cualquier modelo",
    search: "Buscar tareas",
    searchPlaceholder: "Busca por ID, título u objetivo",
    clear: "Quitar filtros",
  },
  views: { group: "Vista", board: "Tablero", table: "Tabla" },
  summary: {
    group: "Resumen",
    total: "Tareas",
    acceptedFirstPass: "Aceptadas a la primera",
    acceptedFirstPassValue: (accepted, rated) => `${accepted} de ${rated}`,
    cost: "Coste estimado",
    awaitingDecision: "Pendientes de decisión",
  },
  proposals: {
    group: "Decisiones sobre propuestas",
    approve: "Aprobar",
    approveName: (taskId) => `Aprobar propuesta ${taskId}`,
    approving: "Aprobando propuesta",
    reject: "Rechazar",
    rejectName: (taskId) => `Rechazar propuesta ${taskId}`,
    rejectTitle: (taskId) => `¿Rechazar la propuesta ${taskId}?`,
    rejectDescription: "Ningún agente empezará con ella y saldrá del tablero.",
    rejectConfirm: "Descartarla",
    rejecting: "Rechazando propuesta",
    cancel: "Cancelar",
    approveAgentConfirm: (taskId) => `Aprueba la propuesta ${taskId}, lo que pone agentes a trabajar`,
    rejectAgentConfirm: (taskId) => `Rechaza la propuesta ${taskId}`,
    agentConfirm: "Aprueba o rechaza una propuesta de tarea; aprobar pone agentes a trabajar",
  },
  snapshot: (date) => `Instantánea · ${date}`,
  empty: {
    board: "Todavía no hay tareas.",
    column: "Nada por aquí.",
    filtered: "Ninguna tarea coincide con estos filtros.",
    attempts: "Todavía no hay intentos.",
  },
  errors: {
    approveFailed: "No se pudo aprobar la propuesta.",
    rejectFailed: "No se pudo rechazar la propuesta.",
    unknown: "Algo ha fallado.",
  },
  components: {},
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Merges overrides into `base` two levels deep, so `{ filters: { anyModel } }` keeps the other filter labels. */
function mergeLabels(
  base: AgentTaskBoardLabels,
  ...overrides: (AgentTaskBoardLabelsInput | undefined)[]
): AgentTaskBoardLabels {
  const merged: Record<string, unknown> = { ...base }
  for (const override of overrides) {
    for (const [key, value] of Object.entries(override ?? {})) {
      if (value === undefined) continue
      const current = merged[key]
      merged[key] = isPlainObject(current) && isPlainObject(value) ? { ...current, ...value } : value
    }
  }
  return merged as unknown as AgentTaskBoardLabels
}

export { agentTaskBoardLabels, agentTaskBoardLabelsEs, mergeLabels }
export type { AgentTaskBoardComponentLabels, AgentTaskBoardLabels, AgentTaskBoardLabelsInput, ProposalLabels }
