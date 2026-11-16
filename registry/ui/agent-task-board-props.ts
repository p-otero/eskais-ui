import type { ReactNode } from "react"

import type { ColumnConfig, TaskFilters } from "@/lib/agent-task-board-model"
import type { TaskView, ThreadRef } from "@/lib/agent-task-types"
import type { AgentApproval, BoardView } from "@/components/ui/agent-task-board-primitive"
import type { AgentTaskBoardLabelsInput } from "@/components/ui/agent-task-labels"

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
  selectedTaskId?: string | null
  defaultSelectedTaskId?: string | null
  onSelectTask?: (id: string | null) => void
  labels?: AgentTaskBoardLabelsInput
  formatCurrency?: (usd: number) => string
  renderThreadLink?: (thread: ThreadRef) => ReactNode
  onOpenThread?: (thread: ThreadRef) => void
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

type AgentTaskBoardProps = AgentTaskBoardBaseProps &
  (
    | {
        mode: "snapshot"
        /** The snapshot's "now": every time is relative to it, and the banner shows it. */
        generatedAt: string
      }
    | { mode: "live"; generatedAt?: string }
  )

export type { AgentTaskBoardBaseProps, AgentTaskBoardProps, BoardDensity, DetailPresentation }
