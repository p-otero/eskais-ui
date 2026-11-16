"use client"

import type { ComponentProps } from "react"

import type { Stage, StageSize } from "@/components/ui/stage-track"
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group"
import type { Tone } from "@/lib/tone"
import { cnState } from "@/lib/utils"

const dotClassNames = {
  default: "bg-primary",
  neutral: "bg-muted-foreground",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
} satisfies Record<Tone | "default", string>

type StageFilterProps = Omit<ComponentProps<typeof ToggleGroup<string>>, "children" | "multiple" | "orientation"> & {
  stages: readonly Stage[]
  /** How many items are in each stage, by stage id. */
  counts?: Readonly<Record<string, number>>
  /** Several stages at once (the default), or one, which pressing again clears. */
  multiple?: boolean
  size?: StageSize
  locale?: string
}

// A filter is a set of pressed toggles: nothing pressed means no filter, so a toggle group fits, where a
// segmented control would always hold one value.
function StageFilter({ stages, counts, multiple = true, size = "md", locale, className, ...props }: StageFilterProps) {
  const format = new Intl.NumberFormat(locale)
  return (
    <ToggleGroup<string>
      multiple={multiple}
      data-slot="stage-filter"
      className={cnState("flex-wrap", className)}
      {...props}
    >
      {stages.map((stage) => {
        const count = counts?.[stage.id]
        return (
          <Toggle
            key={stage.id}
            value={stage.id}
            variant="outline"
            size={size === "sm" ? "sm" : "default"}
            data-stage={stage.id}
            className="group/stage"
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full group-data-pressed/stage:bg-current ${dotClassNames[stage.tone ?? "default"]}`}
            />
            {stage.label}
            {count !== undefined && (
              <>
                {" "}
                <span className="text-caption text-muted-foreground tabular-nums group-data-pressed/stage:text-primary-foreground">
                  {format.format(count)}
                </span>
              </>
            )}
          </Toggle>
        )
      })}
    </ToggleGroup>
  )
}

export { StageFilter }
export type { StageFilterProps }
