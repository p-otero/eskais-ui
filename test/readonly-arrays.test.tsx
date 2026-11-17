import { useAsyncOptions } from "@ui-sdk/react/async-options"
import type { ComponentProps } from "react"
import { expect, test } from "vitest"

import type { AgentTaskBoardProps } from "@/components/ui/agent-task-board"
import type { AttemptTimelineProps } from "@/components/ui/attempt-timeline"
import type { Combobox } from "@/components/ui/combobox"
import type { DataTableProps } from "@/components/ui/data-table"
import type { DependencyChipsProps } from "@/components/ui/dependency-chips"
import type { MobileNavProps } from "@/components/ui/mobile-nav"
import type { NativeSelectProps } from "@/components/ui/native-select"
import type { SelectOption, SelectProps } from "@/components/ui/select"
import type { SiteHeaderItem, SiteHeaderProps } from "@/components/ui/site-header"
import type { Stage, StageTrackProps } from "@/components/ui/stage-track"
import type { StageFilter } from "@/components/ui/stage-filter"
import type { FormStep, StepFormProps } from "@/components/ui/step-form"
import type { Token, TokenInputLabelProps, TokenInputTextProps } from "@/components/ui/token-input"
import type { UsageTableProps } from "@/components/ui/usage"
import type { AttemptView, TaskView } from "@/lib/agent-task-types"

// Each `true` compiles only while the prop accepts a readonly array; `bun run typecheck` is the real check.
type Accepts<Prop, Value> = [Value] extends [Prop] ? true : false

type Option = SelectOption<string>
type Item = { value: string; label: string }

const typeChecks = {
  selectOptions: true satisfies Accepts<SelectProps<string>["options"], readonly Option[]>,
  selectGroups: true satisfies Accepts<
    SelectProps<string>["options"],
    readonly { label: string; options: readonly Option[] }[]
  >,
  nativeSelect: true satisfies Accepts<NativeSelectProps["options"], readonly Option[]>,
  comboboxItems: true satisfies Accepts<ComponentProps<typeof Combobox<string>>["items"], readonly Item[]>,
  stageFilter: true satisfies Accepts<ComponentProps<typeof StageFilter>["stages"], readonly Stage[]>,
  stageTrack: true satisfies Accepts<StageTrackProps["stages"], readonly Stage[]>,
  mobileNav: true satisfies Accepts<MobileNavProps["items"], readonly MobileNavProps["items"][number][]>,
  mobileNavOverflow: true satisfies Accepts<MobileNavProps["overflow"], readonly MobileNavProps["items"][number][]>,
  siteHeader: true satisfies Accepts<SiteHeaderProps["items"], readonly SiteHeaderItem[]>,
  dataTableRows: true satisfies Accepts<DataTableProps<Item>["rows"], readonly Item[]>,
  dataTableSelection: true satisfies Accepts<DataTableProps<Item>["selection"], readonly string[]>,
  tokenInputLabels: true satisfies Accepts<TokenInputLabelProps["value"], readonly string[]>,
  tokenInputText: true satisfies Accepts<TokenInputTextProps["defaultValue"], readonly (string | Token)[]>,
  dependencyChips: true satisfies Accepts<
    DependencyChipsProps["items"],
    readonly DependencyChipsProps["items"][number][]
  >,
  attempts: true satisfies Accepts<AttemptTimelineProps["attempts"], readonly AttemptView[]>,
  steps: true satisfies Accepts<StepFormProps<never>["steps"], readonly FormStep<never>[]>,
  usageColumns: true satisfies Accepts<
    UsageTableProps["columns"],
    readonly NonNullable<UsageTableProps["columns"]>[number][]
  >,
  boardTasks: true satisfies Accepts<AgentTaskBoardProps["tasks"], readonly TaskView[]>,
  boardStages: true satisfies Accepts<AgentTaskBoardProps["stages"], readonly Stage[]>,
}

// What useAsyncOptions returns feeds Select, Combobox and Command as is.
function AsyncResults() {
  const results = useAsyncOptions(async (): Promise<Option[]> => [])
  const options: SelectProps<string>["options"] = results.items
  return options
}

test("every options and items prop takes a readonly array", () => {
  expect(Object.values(typeChecks).every(Boolean)).toBe(true)
  expect(AsyncResults).toBeTypeOf("function")
})
