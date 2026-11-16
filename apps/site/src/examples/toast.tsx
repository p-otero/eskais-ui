import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-items">
      <Button variant="outline" onClick={() => toast("Run queued", { description: "Starts in about a minute" })}>
        Queue a run
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.success("Task archived", {
            description: "Index the docs",
            action: { label: "Undo", onAction: () => toast("Restored") },
          })
        }
      >
        Archive with undo
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(wait(1500), {
            loading: "Deploying Apollo",
            success: "Apollo is live",
            error: "Deploy failed",
          })
        }
      >
        Deploy
      </Button>
    </div>
  )
}
