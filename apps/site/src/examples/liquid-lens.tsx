import { CopyIcon, PlayIcon, ShareIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Floating, FloatingContent } from "@/components/ui/floating"
import { LiquidLens } from "@/components/ui/liquid-lens"
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@/components/ui/scroll-area"

const tracks = [
  "Northern lights",
  "Glass harbour",
  "Slow tide",
  "Paper moons",
  "Copper wire",
  "Quiet engines",
  "Salt and cedar",
  "Late trains",
  "Blue hour",
  "Open water",
]

export default function LiquidLensDemo() {
  return (
    <div
      data-theme="liquid"
      className="w-full max-w-md overflow-hidden rounded-surface border bg-linear-135 from-info-soft via-violet-soft to-warning-soft"
    >
      <LiquidLens />
      <ScrollArea className="h-72">
        <ScrollAreaViewport render={<section />} aria-label="Queue">
          <ul className="flex flex-col">
            {tracks.map((track, index) => (
              <li
                key={track}
                className="flex items-center justify-between border-b px-inset-item py-inset-item text-body"
              >
                <span>{track}</span>
                <span className="font-mono text-caption text-muted-foreground">{`${String(3 + (index % 3))}:${String(10 + index * 4)}`}</span>
              </li>
            ))}
          </ul>
          <Floating side="bottom" align="center">
            <FloatingContent>
              <Button variant="ghost" size="icon" aria-label="Previous">
                <SkipBackIcon />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Play">
                <PlayIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next">
                <SkipForwardIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Copy link">
                <CopyIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Share">
                <ShareIcon />
              </Button>
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
