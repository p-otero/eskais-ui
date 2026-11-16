import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { FilterBar, FilterBarButton } from "@/components/ui/filter-bar"
import { Floating, FloatingContent } from "@/components/ui/floating"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"

import { Section } from "../section"

const runs = [
  "Index the docs",
  "Backfill usage",
  "Write the migration",
  "Design the schema",
  "Review the auth flow",
  "Cache price lookups",
  "Rotate the API keys",
  "Trim old attempts",
  "Translate the labels",
  "Profile the board",
]

function FloatingSection() {
  const [flat, setFlat] = useState(false)
  return (
    <Section
      title="Floating"
      description="A bar that sticks to the bottom of its scroll container on the floating elevation: a deeper shadow and a blurred, translucent fill. Flat elevation drops both."
    >
      <div className="flex w-full flex-col gap-3" data-elevation={flat ? "flat" : undefined}>
        <Field>
          <Switch checked={flat} onCheckedChange={setFlat} />
          <FieldLabel>Flat elevation</FieldLabel>
        </Field>
        <div className="h-72 w-full overflow-hidden rounded-surface border">
          <ScrollArea className="h-full">
            <ScrollAreaViewport render={<section />} aria-label="Runs">
              <ul className="flex flex-col">
                {runs.map((run, index) => (
                  <li
                    key={run}
                    className="flex items-center justify-between border-b px-4 py-3 text-sm odd:bg-muted/50"
                  >
                    <span>{run}</span>
                    <span className="text-muted-foreground">{index < 3 ? "Selected" : "Idle"}</span>
                  </li>
                ))}
              </ul>
              <Floating side="bottom" align="center">
                <FloatingContent>
                  <FilterBar label="Selection actions" className="w-auto flex-nowrap">
                    <span className="px-2 text-muted-foreground">3 selected</span>
                    <FilterBarButton variant="ghost" onClick={() => toast("3 runs archived")}>
                      Archive
                    </FilterBarButton>
                    <FilterBarButton variant="ghost" onClick={() => toast("3 runs retried")}>
                      Retry
                    </FilterBarButton>
                    <FilterBarButton
                      variant="destructive"
                      data-agent-confirm="Deletes the 3 selected runs"
                      onClick={() => toast.error("3 runs deleted")}
                    >
                      Delete
                    </FilterBarButton>
                  </FilterBar>
                </FloatingContent>
              </Floating>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar>
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
          </ScrollArea>
        </div>
      </div>
    </Section>
  )
}

export { FloatingSection }
