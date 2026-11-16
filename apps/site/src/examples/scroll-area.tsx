import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"

const runs = Array.from({ length: 20 }, (_, index) => `Run #${1240 + index}`)

export default function ScrollAreaDemo() {
  return (
    <ScrollArea className="h-56 w-64 rounded-surface border bg-card">
      <ScrollAreaViewport render={<section />} aria-label="Recent runs">
        <ul className="flex flex-col">
          {runs.map((run) => (
            <li key={run} className="border-b px-inset-item py-inset-item text-body-sm last:border-0">
              {run}
            </li>
          ))}
        </ul>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar>
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollArea>
  )
}
