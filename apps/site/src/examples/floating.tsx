import { FilterBar, FilterBarButton } from "@/components/ui/filter-bar"
import { Floating, FloatingContent } from "@/components/ui/floating"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/toast"

const runs = ["Index the docs", "Backfill usage", "Write the migration", "Design the schema", "Review the auth flow"]

export default function FloatingDemo() {
  return (
    <div className="h-64 w-full overflow-hidden rounded-surface border bg-background">
      <ScrollArea className="h-full">
        <ScrollAreaViewport render={<section />} aria-label="Runs">
          <ul className="flex flex-col pb-section">
            {runs.map((run) => (
              <li key={run} className="border-b px-inset-item py-inset-item text-body-sm">
                {run}
              </li>
            ))}
          </ul>
          <Floating side="bottom" align="center">
            <FloatingContent>
              <FilterBar label="Selection actions" className="w-auto flex-nowrap">
                <span className="px-inset-item text-muted-foreground">3 selected</span>
                <FilterBarButton variant="ghost" onClick={() => toast("3 runs archived")}>
                  Archive
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
  )
}
