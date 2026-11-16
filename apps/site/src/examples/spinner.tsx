import { Spinner } from "@/components/ui/spinner"

export default function SpinnerDemo() {
  return (
    <div className="flex items-center gap-group">
      <Spinner size="sm" />
      <Spinner />
      <Spinner size="lg" />
      <span className="inline-flex items-center gap-inline text-body-sm text-muted-foreground">
        <Spinner label="Syncing projects" />
        Syncing
      </span>
    </div>
  )
}
