import { Button } from "@/components/ui/button"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ButtonDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-items">
      <Button>Deploy</Button>
      <Button variant="secondary">Preview</Button>
      <Button variant="outline">Share</Button>
      <Button variant="ghost">Cancel</Button>
      <Button onClick={() => wait(1500)} pendingAnnouncement="Saving">
        Save (async)
      </Button>
    </div>
  )
}
