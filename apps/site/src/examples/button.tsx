import { ArchiveIcon, CopyIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ButtonDemo() {
  return (
    <div className="flex flex-col items-center gap-group">
      <div className="flex flex-wrap items-center justify-center gap-items">
        <Button>Deploy</Button>
        <Button variant="secondary">Preview</Button>
        <Button variant="outline">Share</Button>
        <Button variant="ghost">Cancel</Button>
        <Button onClick={() => wait(1500)} pendingAnnouncement="Saving">
          Save (async)
        </Button>
      </div>
      <div className="flex items-center gap-inline">
        <Button variant="ghost" size="icon" aria-label="Copy link">
          <CopyIcon />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Archive">
          <ArchiveIcon />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Delete" tooltip="Moves the draft to the trash">
          <Trash2Icon />
        </Button>
      </div>
    </div>
  )
}
