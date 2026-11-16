import type { ReactNode } from "react"

import type { ColumnConfig, TaskFilters } from "@/lib/agent-task-board-model"
import type { TaskLink, TaskStatus, TaskView, ThreadRef } from "@/lib/agent-task-types"
import type { Tone } from "@/lib/tone"
import type { AgentAvatars } from "@/components/ui/agent-avatar"
import type { AgentApproval, BoardView } from "@/components/ui/agent-task-board-primitive"
import type { AgentTaskBoardLabelsInput } from "@/components/ui/agent-task-labels"
import type { Stage } from "@/components/ui/stage-track"

type ProposalCallback = (id: string) => void | Promise<void>

interface AgentTaskBoardBaseProps {
  tasks: TaskView[]
  /** "Now" in live mode, for tests and deterministic screenshots only. */
  now?: string
  /** BCP 47; defaults to the page's `lang`. */
  locale?: string
  /** IANA; defaults to the browser's. */
  timeZone?: string
  view?: BoardView
  defaultView?: BoardView
  onViewChange?: (view: BoardView) => void
  filters?: TaskFilters
  defaultFilters?: TaskFilters
  onFiltersChange?: (filters: TaskFilters) => void
  columns?: ColumnConfig[]
  onColumnsChange?: (columns: ColumnConfig[]) => void
  /** `"tint"` (default) marks each column with its tone: a dot, a top border and a faint wash. */
  columnAccent?: ColumnAccent
  /** Overrides `taskStatusAccentTones`; the cards' status icons follow. */
  columnTones?: Partial<Record<TaskStatus, Tone>>
  selectedTaskId?: string | null
  defaultSelectedTaskId?: string | null
  onSelectTask?: (id: string | null) => void
  labels?: AgentTaskBoardLabelsInput
  formatCurrency?: (usd: number) => string
  renderThreadLink?: (thread: ThreadRef) => ReactNode
  onOpenThread?: (thread: ThreadRef) => void
  /** Replaces the default link in the detail's list of links. */
  renderLink?: (link: TaskLink) => ReactNode
  /** Takes over a link's click and the agent's `openLink`; without it, links navigate to their `href`. */
  onOpenLink?: (link: TaskLink, task: TaskView) => void
  /** Replaces the attachment strip of `task.attachments` in the detail's main column. */
  renderAttachments?: (task: TaskView) => ReactNode
  /** Replaces the stage track of `task.location` in the detail's side column. */
  renderLocation?: (task: TaskView) => ReactNode
  /**
   * The host's controls for one task, such as a copy-command button, at the end of its backlog row after
   * Approve/Reject. Shows in snapshot mode too. Use UI SDK parts (the registry's `Button`) with a name that
   * says which task they act on, so agents can press them.
   */
  renderBacklogActions?: (task: TaskView) => ReactNode
  /** The same at the end of a board card, after Approve/Reject. Keep it stable (`useCallback`): cards are memoized. */
  renderCardActions?: (task: TaskView) => ReactNode
  /**
   * The pipeline `task.location` points into, in order. Cards show the stage as a pill, the detail as a
   * track, and the toolbar gets a row of stage toggles that filters by it.
   */
  stages?: Stage[]
  /** Images, icons or names per provider id. No logos ship; agents show initials on a provider color otherwise. */
  agentAvatars?: AgentAvatars
  /** Live mode only. A returned Promise keeps the button pending and shows its error. */
  onApproveProposal?: ProposalCallback
  onRejectProposal?: ProposalCallback
  agentApproval?: AgentApproval
  /**
   * How a selected task's detail shows. `"dialog"` (default) and `"drawer"` are modal and leave the
   * board's layout alone; `"side"` keeps the board usable beside a non-modal panel.
   */
  detailPresentation?: DetailPresentation
  /** `"auto"` (default) switches to compact shape and spacing while the board is 75rem wide or less. */
  density?: BoardDensity
  className?: string
}

type DetailPresentation = "dialog" | "drawer" | "side"
type BoardDensity = "comfortable" | "compact" | "auto"
type ColumnAccent = "tint" | "none"

type AgentTaskBoardProps = AgentTaskBoardBaseProps &
  (
    | {
        mode: "snapshot"
        /** The snapshot's "now": every time is relative to it, and the banner shows it. */
        generatedAt: string
      }
    | { mode: "live"; generatedAt?: string }
  )

export type { AgentTaskBoardBaseProps, AgentTaskBoardProps, BoardDensity, ColumnAccent, DetailPresentation }
