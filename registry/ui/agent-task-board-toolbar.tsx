"use client"

import type { FilterOptions, TaskFilters } from "@/lib/agent-task-board-model"
import { formatInstant } from "@/lib/time"
import type { AgentTaskBoardController, BoardView } from "@/components/ui/agent-task-board-primitive"
import type { AgentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { SearchField } from "@/components/ui/search-field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ChoiceKey = "project" | "profile" | "model"

const choiceSources = { project: "projects", profile: "profiles", model: "models" } as const
const anyLabel = { project: "allProjects", profile: "anyProfile", model: "anyModel" } as const

type FilterSelectProps = {
  name: ChoiceKey
  options: FilterOptions
  filters: TaskFilters
  labels: AgentTaskBoardLabels
  controller: AgentTaskBoardController
}

// "" stands for "any": the primitive's filter treats an empty value as clearing that filter.
function FilterSelect({ name, options, filters, labels, controller }: FilterSelectProps) {
  const items = [
    { value: "", label: labels.filters[anyLabel[name]] },
    ...options[choiceSources[name]].map((value) => ({ value, label: value })),
  ]
  return (
    <Field className="min-w-40 flex-1">
      <FieldLabel>{labels.filters[name]}</FieldLabel>
      <Select
        items={items}
        value={filters[name] ?? ""}
        onValueChange={(value) => controller.filter({ [name]: value || null }, { reason: "item-press" })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <span className="min-w-0 truncate">{item.label}</span>
              <SelectItemIndicator />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

type AgentTaskBoardToolbarProps = {
  options: FilterOptions
  filters: TaskFilters
  view: BoardView
  labels: AgentTaskBoardLabels
  controller: AgentTaskBoardController
  /** Shown as the snapshot banner. */
  generatedAt?: string
  locale?: string
  timeZone?: string
}

function AgentTaskBoardToolbar({
  options,
  filters,
  view,
  labels,
  controller,
  generatedAt,
  locale,
  timeZone,
}: AgentTaskBoardToolbarProps) {
  const filtered = Object.values(filters).some(Boolean)
  const choices = (["project", "profile", "model"] as const).filter((name) => options[choiceSources[name]].length > 0)
  return (
    <div data-slot="agent-task-board-toolbar" className="@container/agent-task-board-toolbar flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {generatedAt && (
          <p data-slot="agent-task-board-snapshot" className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="size-4"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <time dateTime={generatedAt}>{labels.snapshot(formatInstant(generatedAt, { locale, timeZone }))}</time>
          </p>
        )}
        <SegmentedControl<BoardView>
          aria-label={labels.views.group}
          className="ml-auto"
          value={view}
          onValueChange={(next) => next && controller.setView(next, { reason: "item-press" })}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="board">{labels.views.board}</SegmentedControlItem>
          <SegmentedControlItem value="table">{labels.views.table}</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <div className="flex">
        <fieldset aria-label={labels.filters.group} className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
          <SearchField
            label={labels.filters.search}
            clearLabel={labels.filters.clearSearch}
            placeholder={labels.filters.searchPlaceholder}
            value={filters.query ?? ""}
            onValueChange={(value) => controller.filter({ query: value || null }, { reason: "input-change" })}
            className="min-w-56 flex-2"
          />
          {choices.map((name) => (
            <FilterSelect
              key={name}
              name={name}
              options={options}
              filters={filters}
              labels={labels}
              controller={controller}
            />
          ))}
          {filtered && (
            <Button
              variant="ghost"
              onClick={() =>
                controller.filter({ project: null, profile: null, model: null, query: null }, { reason: "clear-press" })
              }
            >
              {labels.filters.clear}
            </Button>
          )}
        </fieldset>
      </div>
    </div>
  )
}

export { AgentTaskBoardToolbar }
export type { AgentTaskBoardToolbarProps }
